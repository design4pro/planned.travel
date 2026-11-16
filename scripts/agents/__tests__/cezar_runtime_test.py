import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

source = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('cezar_runtime', source / 'cezar-project-runtime.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cezar-runtime-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.package = self.root / 'package'
        (self.package / 'dist').mkdir(parents=True)
        (self.package / 'package.json').write_text(json.dumps({'name': '@open-mercato/cezar', 'version': runtime.VERSION}))
        (self.package / 'dist/index.js').write_bytes(b'entry')
        (self.package / 'dist/fixture.js').write_bytes(b'original')
        self.enterContext(patch.object(runtime, 'PINS', {'fixture.js': runtime.digest(b'original')}))
        self.enterContext(patch.object(runtime, 'ENTRY_SHA', runtime.digest(b'entry')))
        self.enterContext(patch.object(runtime, 'patched', lambda name, data: data + b' patched'))

    def test_original_and_patched_files_are_accepted_but_drift_is_refused(self):
        rows, extra = runtime.prepare(self.package, b'helper')
        target, backup, original, updated, current = rows[0]
        backup.write_bytes(original)
        target.write_bytes(updated)
        extra.write_bytes(b'helper')
        self.assertEqual(runtime.prepare(self.package, b'helper')[0][0][-1], updated)
        target.write_bytes(b'unreviewed')
        with self.assertRaisesRegex(ValueError, 'drift'):
            runtime.prepare(self.package, b'helper')
        self.assertEqual(target.read_bytes(), b'unreviewed')

    def test_unknown_version_entrypoint_helper_and_symlink_are_refused(self):
        metadata = self.package / 'package.json'
        original = metadata.read_bytes()
        metadata.write_text('{"name":"@open-mercato/cezar","version":"999.0.0"}')
        with self.assertRaisesRegex(ValueError, 'Unsupported'):
            runtime.prepare(self.package, b'helper')
        metadata.write_bytes(original)
        entry = self.package / 'dist/index.js'
        entry.write_bytes(b'other')
        with self.assertRaisesRegex(ValueError, 'entrypoint'):
            runtime.prepare(self.package, b'helper')
        entry.write_bytes(b'entry')
        extra = self.package / 'dist/codex-project-skills.mjs'
        extra.write_bytes(b'other')
        with self.assertRaisesRegex(ValueError, 'implementation drift'):
            runtime.prepare(self.package, b'helper')
        extra.unlink()
        target = self.package / 'dist/fixture.js'
        target.unlink()
        target.symlink_to(entry)
        with self.assertRaisesRegex(ValueError, 'symlinked'):
            runtime.prepare(self.package, b'helper')

    def test_only_the_exact_previous_patch_can_be_upgraded(self):
        target = self.package / 'dist/fixture.js'
        backup = target.with_name('fixture.js.codex-project-original')
        backup.write_bytes(b'original')
        target.write_bytes(b'reviewed previous patch')
        with patch.object(runtime, 'PREVIOUS_PATCHES', {'fixture.js': runtime.digest(target.read_bytes())}):
            rows, _ = runtime.prepare(self.package, b'helper')
            self.assertEqual(rows[0][3], b'original patched')
            target.write_bytes(b'reviewed previous patch plus unreviewed changes')
            with self.assertRaisesRegex(ValueError, 'drift'):
                runtime.prepare(self.package, b'helper')

    def test_node_wrapper_checks_before_exec_and_limits_probes(self):
        bins = self.root / 'bin'
        bins.mkdir()
        library = self.root / 'lib/codex-project'
        library.mkdir(parents=True)
        checker = library / 'cezar-project-runtime.py'
        checker.write_text('raise SystemExit(2)\n')
        wrapper = bins / 'cezar-project-node'
        shutil.copyfile(source / 'cezar-project-node.py', wrapper)
        node = bins / 'node'
        node.write_text('#!/bin/sh\nprintf "%s\\n" "NODE_EXECUTED" "$CEZ_SKILLS_SCOPE" "$CEZ_CODEX_BIN" "$@"\n')
        node.chmod(0o700)
        env = {**os.environ, 'PATH': str(bins) + ':' + os.environ['PATH']}
        def run(*args):
            return subprocess.run([sys.executable, str(wrapper), *args], env=env, capture_output=True, text=True)
        self.assertEqual(run(str(self.package / 'dist/index.js')).returncode, 2)
        self.assertNotIn('NODE_EXECUTED', run(str(self.package / 'dist/index.js')).stdout)
        checker.write_text('raise SystemExit(0)\n')
        result = run(str(self.package / 'dist/index.js'), 'serve')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines()[1:3], ['project', str(bins / 'codex-project')])
        for args in [('-e', 'code'), ('-p', 'other'), (str(self.root / 'unknown.js'),)]:
            self.assertNotEqual(run(*args).returncode, 0)
        self.assertEqual(run('-p', 'process.versions.node').returncode, 0)


if __name__ == '__main__':
    unittest.main()
