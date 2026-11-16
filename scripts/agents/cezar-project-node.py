#!/usr/bin/env python3
"""A Cezar-only Node entrypoint with a checked project-skill catalog."""
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    args = sys.argv[1:]
    node = shutil.which('node')
    if not node:
        raise ValueError('Node is not available on PATH.')
    probes = [['-v'], ['--version'], ['-p', 'process.versions.node']]
    if args in probes:
        os.execv(node, [node, *args])
    if not args or args[0].startswith('-'):
        raise ValueError('Only a reviewed Cezar entrypoint or a Node version probe is allowed.')
    entry = Path(args[0]).resolve(strict=True)
    if entry.name != 'index.js' or entry.parent.name != 'dist':
        raise ValueError('Unrecognized Cezar entrypoint.')
    library = Path(__file__).resolve().parent.parent / 'lib/codex-project'
    result = subprocess.run([sys.executable, str(library / 'cezar-project-runtime.py'), str(entry.parent.parent), 'apply'])
    if result.returncode:
        return result.returncode
    env = dict(os.environ)
    env['CEZ_SKILLS_SCOPE'] = 'project'
    env['CEZ_CODEX_BIN'] = str(Path(__file__).resolve().with_name('codex-project'))
    os.execve(node, [node, str(entry), *args[1:]], env)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as error:
        print(f'cezar-project: {error}', file=sys.stderr)
        raise SystemExit(2)
