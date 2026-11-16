import hashlib
import importlib.util
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('auto_update', SOURCE / 'skills-auto-update.py')
auto = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auto)


def version(root, content, sha):
    path = '.agents/skills/om-example/SKILL.md'
    file = root / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content)
    blob = hashlib.sha1(f'blob {len(content.encode())}\0'.encode() + content.encode()).hexdigest()
    manifest = root / 'scripts/agents/skills-upstream.json'
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps({'sha': sha, 'files': [{'path': path, 'sha': blob, 'mode': '100644'}]}))
    (root / 'skills-lock.json').write_text(json.dumps({'version': 1, 'skills': {'om-example': {'computedHash': hashlib.sha256(content.encode()).hexdigest()}}}))
    guide = root / 'docs/agents/cezar.md'
    guide.parent.mkdir(parents=True, exist_ok=True)
    guide.write_text(f'open-mercato/skills@{sha}\n')


class Interrupted(BaseException):
    pass


class AutoUpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='auto-skills-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        self.common = self.root / '.git'
        version(self.root, '# Old\n', 'a' * 40)
        (self.root / auto.CONFIG).write_text(json.dumps({'enabled': True, 'source': 'open-mercato/skills', 'branch': 'main', 'intervalHours': 6}))
        (self.root / 'scripts/agents/sync-skills.mjs').write_text('// fixture installer\n')
        self.registry = self.root / 'registry.json'
        self.registry.write_text(json.dumps({'projects': [{'root': str(self.root), 'commonDir': str(self.common)}]}))
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                        '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture'], check=True)

    def staged(self):
        base = self.root / '.ai/tmp/skills-auto-update'
        base.mkdir(parents=True, exist_ok=True)
        transaction = Path(tempfile.mkdtemp(dir=base, prefix='transaction-'))
        stage = transaction / 'stage'
        for name in auto.INPUTS:
            source, target = self.root / name, stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(source, target) if source.is_dir() else shutil.copy2(source, target)
        version(stage, '# New\n', 'b' * 40)
        return transaction

    def test_update_preserves_impeccable_and_its_executable_mode(self):
        addon = self.root / '.agents/skills/impeccable/scripts/tool'
        addon.parent.mkdir(parents=True)
        addon.write_bytes(b'#!/bin/sh\necho preserved\n')
        addon.chmod(0o755)
        (addon.parent.parent / 'SKILL.md').write_text('# Impeccable\n')
        self.assertEqual(auto.validate_installed(self.root), 'a' * 40)
        baseline = auto.snapshot(self.root)
        auto.publish(self.root, self.common, self.staged(), baseline, lambda: None)
        self.assertEqual(auto.validate_installed(self.root), 'b' * 40)
        self.assertEqual(addon.read_bytes(), b'#!/bin/sh\necho preserved\n')
        self.assertEqual(addon.stat().st_mode & 0o777, 0o755)

    def test_unknown_addons_and_symlinked_impeccable_are_refused(self):
        unknown = self.root / '.agents/skills/other-tool'
        unknown.mkdir()
        with self.assertRaises(auto.Deferred):
            auto.validate_installed(self.root)
        unknown.rmdir()
        addon = self.root / '.agents/skills/impeccable'
        addon.symlink_to(self.root / '.agents/skills/om-example', target_is_directory=True)
        with self.assertRaises((ValueError, auto.Deferred)):
            auto.validate_installed(self.root)

    def test_concurrent_impeccable_edit_defers_publication(self):
        addon = self.root / '.agents/skills/impeccable/SKILL.md'
        addon.parent.mkdir()
        addon.write_text('# Impeccable\n')
        def prepare(command, **options):
            version(Path(options['cwd']), '# New\n', 'b' * 40)
            addon.write_text('# Concurrent addon edit\n')
            return subprocess.CompletedProcess(command, 0, '', '')
        with self.assertRaises(auto.Deferred):
            auto.update(self.root, self.common, 'b' * 40, lambda: None, prepare)
        self.assertEqual(addon.read_text(), '# Concurrent addon edit\n')
        self.assertEqual(auto.validate_installed(self.root), 'a' * 40)

    def test_success_updates_all_owned_files_and_retains_backup(self):
        baseline = auto.snapshot(self.root)
        transaction = self.staged()
        auto.publish(self.root, self.common, transaction, baseline, lambda: None)
        self.assertEqual(auto.validate_installed(self.root), 'b' * 40)
        self.assertEqual((transaction / 'backup/.agents/skills/om-example/SKILL.md').read_text(), '# Old\n')
        self.assertIn('b' * 40, (self.root / 'docs/agents/cezar.md').read_text())
        self.assertFalse((self.common / 'codex-project-skills-journal.json').exists())
        auto.validate_owned_metadata(self.root, self.common)

    def test_interruption_after_each_rename_blocks_reads_and_rolls_back(self):
        baseline = auto.snapshot(self.root)
        for stop in range(1, 9):
            with self.subTest(step=stop):
                transaction = self.staged()
                def interrupt(step):
                    if step == stop:
                        raise Interrupted()
                with self.assertRaises(Interrupted):
                    auto.publish(self.root, self.common, transaction, baseline, lambda: None, interrupt)
                with self.assertRaises(auto.Deferred):
                    auto.catalog(self.root)
                self.assertTrue(auto.recover(self.root, self.common))
                self.assertEqual(auto.snapshot(self.root), baseline)

    def test_recovery_never_overwrites_unknown_edits(self):
        transaction = self.staged()
        def interrupt(step):
            if step == 2:
                raise Interrupted()
        with self.assertRaises(Interrupted):
            auto.publish(self.root, self.common, transaction, auto.snapshot(self.root), lambda: None, interrupt)
        file = self.root / '.agents/skills/om-example/SKILL.md'
        file.write_text('# User edit after interruption\n')
        with self.assertRaises(auto.Deferred):
            auto.recover(self.root, self.common)
        self.assertEqual(file.read_text(), '# User edit after interruption\n')
        self.assertTrue((self.common / 'codex-project-skills-journal.json').exists())

    def test_running_reader_blocks_publication_across_processes(self):
        process = subprocess.Popen([sys.executable, str(SOURCE / 'skills-auto-update.py'), 'lease', '--repo', str(self.root)],
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            self.assertEqual(process.stdout.readline().strip(), 'locked')
            baseline = auto.snapshot(self.root)
            with self.assertRaises(auto.Deferred):
                auto.publish(self.root, self.common, self.staged(), baseline, lambda: None)
            self.assertEqual(auto.snapshot(self.root), baseline)
        finally:
            process.communicate(timeout=10)

    def test_reader_started_during_publication_waits_for_a_complete_collection(self):
        code = '''import importlib.util,sys,os
from pathlib import Path
s=importlib.util.spec_from_file_location('launcher',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
print('attempting',flush=True)
fd=m.acquire_skills_lease(sys.argv[2])
print(Path(sys.argv[3]).read_text().strip(),flush=True)
os.close(fd)
'''
        readers = []
        def concurrent_reader(step):
            if step != 1:
                return
            process = subprocess.Popen([sys.executable, '-c', code, str(SOURCE / 'codex-project.py'), str(self.common),
                str(self.root / '.agents/skills/om-example/SKILL.md')], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            readers.append(process)
            self.assertEqual(process.stdout.readline().strip(), 'attempting')
            self.assertEqual(select.select([process.stdout], [], [], 0.1)[0], [])
        try:
            auto.publish(self.root, self.common, self.staged(), auto.snapshot(self.root), lambda: None, concurrent_reader)
            output, error = readers[0].communicate(timeout=10)
            self.assertEqual(readers[0].returncode, 0, error)
            self.assertEqual(output.strip(), '# New')
        finally:
            for process in readers:
                if process.poll() is None:
                    process.terminate()
                    process.communicate(timeout=10)

    def test_local_document_edit_during_staging_is_preserved(self):
        guide = self.root / 'docs/agents/cezar.md'
        def prepare(command, **options):
            version(Path(options['cwd']), '# New\n', 'b' * 40)
            guide.write_text('A concurrent documentation edit\n')
            return subprocess.CompletedProcess(command, 0, '', '')
        with self.assertRaises(auto.Deferred):
            auto.update(self.root, self.common, 'b' * 40, lambda: None, prepare)
        self.assertEqual(guide.read_text(), 'A concurrent documentation edit\n')
        self.assertEqual(auto.validate_installed(self.root), 'a' * 40)

    def test_failed_repair_validation_keeps_current_installation(self):
        baseline = auto.snapshot(self.root)
        def fail(command, **options):
            return subprocess.CompletedProcess(command, 1, '', 'Error: Review the changed repair base before updating\n')
        with self.assertRaisesRegex(ValueError, 'repair base'):
            auto.update(self.root, self.common, 'b' * 40, lambda: None, fail)
        self.assertEqual(auto.snapshot(self.root), baseline)
        self.assertEqual(list((self.root / '.ai/tmp/skills-auto-update').glob('transaction-*')), [])

    def test_preexisting_metadata_edits_and_permission_edits_are_preserved(self):
        for name in auto.METADATA:
            with self.subTest(file=name):
                file = self.root / name
                original = file.read_bytes()
                file.write_bytes(original + b'\n')
                with self.assertRaises(auto.Deferred):
                    auto.validate_owned_metadata(self.root, self.common)
                self.assertEqual(file.read_bytes(), original + b'\n')
                file.write_bytes(original)
        file = self.root / '.agents/skills/om-example/SKILL.md'
        file.chmod(0o755)
        with self.assertRaises(auto.Deferred):
            auto.validate_installed(self.root)

    def test_completed_automatic_update_is_valid_even_without_a_commit(self):
        auto.publish(self.root, self.common, self.staged(), auto.snapshot(self.root), lambda: None)
        auto.validate_owned_metadata(self.root, self.common)
        lock = self.root / 'skills-lock.json'
        lock.write_text(lock.read_text() + '\n')
        with self.assertRaises(auto.Deferred):
            auto.validate_owned_metadata(self.root, self.common)

    def test_opt_in_is_bound_to_the_primary_checkout_and_common_directory(self):
        root, common, primary = auto.identity(self.root)
        self.assertTrue(auto.enrolled(root, common, primary, self.registry))
        self.assertFalse(auto.enrolled(root, common / 'other', primary, self.registry))
        self.assertFalse(auto.enrolled(root, common, primary / 'other', self.registry))
        (root / auto.CONFIG).write_text('{"enabled":false}')
        self.assertFalse(auto.enrolled(root, common, primary, self.registry))

    def test_unknown_idle_status_never_allows_installation(self):
        with self.assertRaises(auto.Deferred):
            auto.check_idle('http://example.invalid')
        with self.assertRaises(auto.Deferred):
            auto.check_idle('http://127.0.0.1:1')

    def test_current_version_check_records_real_state_without_installing(self):
        original_git = auto.git
        def git(root, *args):
            return 'a' * 40 + '\trefs/heads/main' if args[0] == 'ls-remote' else original_git(root, *args)
        with patch.object(auto, 'git', git):
            result = auto.execute(self.root, 'update', '', self.registry)
        self.assertEqual(result['status'], 'current')
        self.assertEqual(result['installedSha'], result['latestSha'])
        self.assertTrue((self.root / '.ai/tmp/skills-auto-update/status.json').exists())
        result['updatedAt'] = '2026-11-15T00:00:00Z'
        auto.write_json(self.root / '.ai/tmp/skills-auto-update/status.json', result)
        with patch.object(auto, 'git', git):
            repeated = auto.execute(self.root, 'update', '', self.registry)
        self.assertEqual(repeated['updatedAt'], result['updatedAt'])


if __name__ == '__main__':
    unittest.main()
