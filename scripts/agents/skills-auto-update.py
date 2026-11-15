#!/usr/bin/env python3
"""Install Open Mercato updates only in an explicitly enrolled primary checkout."""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

SOURCE = 'https://github.com/open-mercato/skills.git'
CONFIG = '.agents/skills-updates.json'
TARGETS = ['.agents/skills', 'scripts/agents/skills-upstream.json', 'skills-lock.json', 'docs/agents/cezar.md']
INPUTS = TARGETS + [CONFIG, 'scripts/agents/sync-skills.mjs']
METADATA = TARGETS[1:3]
REGISTRY = Path(pwd.getpwuid(os.getuid()).pw_dir) / '.local/lib/codex-project/skills-auto-update-projects.json'


class Deferred(Exception):
    pass


def git(root, *args):
    env = {key: value for key, value in os.environ.items() if not key.startswith('GIT_')}
    env['GIT_TERMINAL_PROMPT'] = '0'
    return subprocess.check_output(['git', '-C', str(root), *args], env=env, text=True, stderr=subprocess.PIPE, timeout=30).strip()


def identity(root):
    root = root.resolve(strict=True)
    common = Path(git(root, 'rev-parse', '--path-format=absolute', '--git-common-dir')).resolve()
    entries = git(root, 'worktree', 'list', '--porcelain', '-z').split('\0')
    primary = Path(next(entry[9:] for entry in entries if entry.startswith('worktree '))).resolve()
    return root, common, primary


def safe_path(root, relative):
    parts = Path(relative).parts
    if not parts or Path(relative).is_absolute() or '..' in parts:
        raise ValueError('Unsafe project update path.')
    path = root
    for part in parts:
        path = path / part
        if path.is_symlink():
            raise ValueError(f'Refusing a symlinked update path: {relative}')
    return path


def fsync_dir(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_json(path, value):
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.skills-update-')
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        fsync_dir(path.parent)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def fingerprint(path):
    """Full inventory, bytes and executable bits, including empty directories."""
    digest = hashlib.sha256()
    if not path.exists() and not path.is_symlink():
        return None
    def visit(item, relative):
        info = item.lstat()
        if stat.S_ISLNK(info.st_mode):
            raise ValueError(f'Refusing a symlink in update inventory: {item.name}')
        digest.update(relative.encode() + b'\0')
        if stat.S_ISDIR(info.st_mode):
            digest.update(b'd\0')
            for child in sorted(item.iterdir()):
                visit(child, relative + '/' + child.name)
        elif stat.S_ISREG(info.st_mode):
            digest.update(str(info.st_mode & 0o111).encode() + b'\0')
            digest.update(item.read_bytes())
        else:
            raise ValueError('Special files are not permitted in an update.')
    visit(path, '')
    return digest.hexdigest()


def sync_tree(path):
    if path.is_dir():
        for child in path.iterdir():
            sync_tree(child)
        fsync_dir(path)
    else:
        with path.open('rb') as stream:
            os.fsync(stream.fileno())


@contextlib.contextmanager
def usage_lock(common, exclusive=False, allow_journal=False):
    file = common / 'codex-project-skills.lock'
    fd = os.open(file, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, (fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH) | fcntl.LOCK_NB)
        journal = common / 'codex-project-skills-journal.json'
        if not allow_journal and (journal.exists() or journal.is_symlink()):
            raise Deferred('An interrupted skill update needs recovery before skills can be used.')
        yield
    except BlockingIOError:
        raise Deferred('Project skills are in use; installation will retry when readers exit.')
    finally:
        os.close(fd)


def catalog(root):
    root = root.resolve(strict=True)
    try:
        _, common, _ = identity(root)
    except subprocess.CalledProcessError:
        common = None
    output = []
    visited = set()
    def walk(path, depth):
        if depth < 0:
            return
        try:
            path = path.resolve(strict=True)
            if not path.is_relative_to(root) or path in visited or not path.is_dir():
                return
            visited.add(path)
            entry = path / 'SKILL.md'
            if entry.exists() or entry.is_symlink():
                entry = entry.resolve(strict=True)
                if entry.is_relative_to(root) and entry.is_file():
                    output.append({'path': str(entry), 'raw': entry.read_text()})
                return
            for child in sorted(path.iterdir()):
                if child.is_dir():
                    walk(child, depth - 1)
        except FileNotFoundError:
            return
    with usage_lock(common) if common else contextlib.nullcontext():
        walk(root / '.agents/skills', 4)
    return output


def snapshot(root):
    return {name: fingerprint(safe_path(root, name)) for name in INPUTS}


def validate_installed(root):
    manifest = json.loads(safe_path(root, TARGETS[1]).read_text())
    if not re.fullmatch('[a-f0-9]{40}', manifest.get('sha', '')):
        raise ValueError('Invalid installed skills manifest.')
    expected = set()
    for entry in manifest['files']:
        name = entry['path']
        if not re.fullmatch(r'\.agents/skills/om-[a-z0-9-]+/.+', name):
            raise ValueError('Manifest contains a non-Open-Mercato path.')
        path = safe_path(root, name)
        mode = entry.get('mode')
        if mode not in ('100644', '100755') or bool(path.stat().st_mode & 0o111) != (mode == '100755'):
            raise Deferred(f'Local skill permissions must be preserved: {name}')
        data = path.read_bytes()
        actual = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if actual != entry.get('localSha', entry['sha']):
            raise Deferred(f'Local skill edits must be preserved: {name}')
        expected.add(name)
    actual = {str(path.relative_to(root)) for path in safe_path(root, TARGETS[0]).rglob('*') if path.is_file()}
    if actual != expected:
        raise Deferred('The project skill inventory contains local additions or removals.')
    return manifest['sha']


def validate_owned_metadata(root, common):
    """Accept committed metadata or the exact bytes published by our last transaction."""
    installed_path = common / 'codex-project-skills-installed.json'
    if installed_path.is_symlink():
        raise ValueError('Refusing a symlinked installation record.')
    recorded = json.loads(installed_path.read_text()) if installed_path.exists() else {}
    current = {name: fingerprint(safe_path(root, name)) for name in METADATA}
    if recorded.get('root') == str(root) and recorded.get('files') == current:
        return
    try:
        for name in METADATA:
            row = git(root, 'ls-tree', 'HEAD', '--', name).split()
            if len(row) != 4 or row[0] != '100644' or row[1] != 'blob':
                raise Deferred('Installation metadata is not committed or recorded by the updater.')
            data = safe_path(root, name).read_bytes()
            blob = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
            if blob != row[2] or safe_path(root, name).stat().st_mode & 0o111:
                raise Deferred(f'Local installation metadata must be preserved: {name}')
    except subprocess.CalledProcessError:
        raise Deferred('Installation metadata is not committed or recorded by the updater.')


def record_installation(root, common, files, version):
    write_json(common / 'codex-project-skills-installed.json', {
        'root': str(root), 'files': {row['target']: row[version] for row in files if row['target'] in METADATA}
    })


def enrolled(root, common, primary, registry=REGISTRY):
    if root != primary:
        return False
    try:
        records = json.loads(registry.read_text())
        config = json.loads(safe_path(root, CONFIG).read_text())
    except FileNotFoundError:
        return False
    return config == {'enabled': True, 'source': 'open-mercato/skills', 'branch': 'main', 'intervalHours': 6} and {
        'root': str(root), 'commonDir': str(common)
    } in records.get('projects', [])


def recover(root, common):
    journal = common / 'codex-project-skills-journal.json'
    if journal.is_symlink():
        raise ValueError('Refusing a symlinked update journal.')
    if not journal.exists():
        return False
    with usage_lock(common, exclusive=True, allow_journal=True):
        record = json.loads(journal.read_text())
        if record.get('root') != str(root) or [row['target'] for row in record['files']] != TARGETS:
            raise ValueError('Unknown skill update journal; refusing recovery.')
        transaction = safe_path(root, record['transaction'])
        if not str(transaction.relative_to(root)).startswith('.ai/tmp/skills-auto-update/transaction-'):
            raise ValueError('Invalid recovery transaction.')
        # Validate every owned byte before the first recovery mutation.
        for row in record['files']:
            current = fingerprint(safe_path(root, row['target']))
            backup = fingerprint(transaction / 'backup' / row['target'])
            if current not in (None, row['old'], row['new']) or backup not in (None, row['old']):
                raise Deferred('Local edits appeared after an interrupted update; automatic recovery stopped.')
            if current != row['old'] and backup != row['old']:
                raise ValueError('Recovery backup is missing; skills remain blocked.')
        for index, row in enumerate(record['files']):
            target = safe_path(root, row['target'])
            backup = transaction / 'backup' / row['target']
            if fingerprint(target) == row['old']:
                continue
            if target.exists():
                os.rename(target, transaction / f'recovered-new-{index}')
                fsync_dir(transaction)
            os.rename(backup, target)
            fsync_dir(target.parent)
            fsync_dir(backup.parent)
        record_installation(root, common, record['files'], 'old')
        journal.unlink()
        fsync_dir(common)
        return True


def publish(root, common, transaction, baseline, assert_idle, after_move=lambda step: None):
    journal = common / 'codex-project-skills-journal.json'
    with usage_lock(common, exclusive=True):
        assert_idle()
        if snapshot(root) != baseline:
            raise Deferred('Project files changed while the update was prepared; installation deferred.')
        files = []
        for name in TARGETS:
            new = fingerprint(transaction / 'stage' / name)
            if new is None or baseline[name] is None:
                raise ValueError('Incomplete staged update.')
            (transaction / 'backup' / name).parent.mkdir(parents=True, exist_ok=True)
            files.append({'target': name, 'old': baseline[name], 'new': new})
            sync_tree(transaction / 'stage' / name)
            sync_tree(safe_path(root, name))
        # Persist every new ancestor before the journal can refer to it.
        sync_tree(transaction)
        ancestor = transaction.parent
        while ancestor != root:
            fsync_dir(ancestor)
            ancestor = ancestor.parent
        fsync_dir(root)
        if snapshot(root) != baseline:
            raise Deferred('Project files changed while the update was prepared; installation deferred.')
        write_json(journal, {'root': str(root), 'transaction': str(transaction.relative_to(root)), 'files': files})
        step = 0
        for row in files:
            target = safe_path(root, row['target'])
            backup = transaction / 'backup' / row['target']
            os.rename(target, backup)
            fsync_dir(target.parent)
            fsync_dir(backup.parent)
            step += 1
            after_move(step)
            staged = transaction / 'stage' / row['target']
            os.rename(staged, target)
            fsync_dir(target.parent)
            fsync_dir(staged.parent)
            step += 1
            after_move(step)
        if any(fingerprint(safe_path(root, row['target'])) != row['new'] for row in files):
            raise ValueError('Published update verification failed; recovery is required.')
        record_installation(root, common, files, 'new')
        journal.unlink()
        fsync_dir(common)


def update(root, common, latest, assert_idle, run=subprocess.run):
    # Avoid repeatedly downloading a collection while a long-lived Codex reader owns it.
    with usage_lock(common, exclusive=True):
        validate_owned_metadata(root, common)
    base = safe_path(root, '.ai/tmp/skills-auto-update')
    base.mkdir(parents=True, exist_ok=True)
    transaction = Path(tempfile.mkdtemp(dir=base, prefix='transaction-'))
    try:
        return prepare_update(root, common, latest, assert_idle, transaction, run)
    finally:
        journal = common / 'codex-project-skills-journal.json'
        backup = transaction / 'backup'
        has_backup = backup.exists() and any(path.is_file() for path in backup.rglob('*'))
        if not journal.exists() and not journal.is_symlink() and not has_backup:
            shutil.rmtree(transaction)


def prepare_update(root, common, latest, assert_idle, transaction, run):
    base = safe_path(root, '.ai/tmp/skills-auto-update')
    base.mkdir(parents=True, exist_ok=True)
    stage = transaction / 'stage'
    stage.mkdir()
    with usage_lock(common):
        baseline = snapshot(root)
        validate_owned_metadata(root, common)
        validate_installed(root)
        for name in INPUTS:
            source = safe_path(root, name)
            destination = stage / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir():
                shutil.copytree(source, destination)
            else:
                shutil.copy2(source, destination)
        if snapshot(root) != baseline:
            raise Deferred('Local files changed during staging.')
    result = run(['node', str(stage / 'scripts/agents/sync-skills.mjs'), '--ref', latest],
                 cwd=stage, capture_output=True, text=True, timeout=240)
    if result.returncode:
        reason = next((line.strip() for line in result.stderr.splitlines() if line.startswith('Error:')), 'Staged skill validation failed.')
        raise ValueError(reason[:500])
    if validate_installed(stage) != latest:
        raise ValueError('Staged SHA differs from the selected update.')
    try:
        publish(root, common, transaction, baseline, assert_idle)
    except Exception:
        recover(root, common)
        raise
    return str(transaction.relative_to(root))


def check_idle(url):
    # A live, loopback-only Cezar snapshot is required; network failure never means idle.
    from urllib.parse import urlsplit
    from urllib.request import urlopen
    parts = urlsplit(url)
    if parts.scheme != 'http' or parts.hostname != '127.0.0.1' or parts.username or parts.password or parts.query or parts.fragment:
        raise Deferred('A local Cezar status endpoint is required before installation.')
    try:
        with urlopen(url + '/api/v1/workspace/dashboard', timeout=5) as response:
            data = json.load(response)
        counts = data['counts']
        required = {'running', 'monitoring', 'questions', 'reviews', 'queued', 'scheduled'}
        if not required.issubset(counts) or any(counts[key] != 0 for key in required):
            raise Deferred('Cezar has active or pending work; installation deferred.')
        with urlopen(url + '/api/v1/workspace/managers', timeout=5) as response:
            managers = json.load(response)['managers']
        if any(manager.get('status') != 'idle' for manager in managers):
            raise Deferred('A Cezar manager is active; installation deferred.')
    except Deferred:
        raise
    except Exception:
        raise Deferred('Cannot confirm that Cezar is idle; installation deferred.')


def execute(root, action, url, registry=REGISTRY):
    root, common, primary = identity(root)
    if not enrolled(root, common, primary, registry):
        return {'status': 'disabled', 'autoUpdateEnabled': False, 'message': 'Automatic updates are not enabled for this checkout.'}
    base = safe_path(root, '.ai/tmp/skills-auto-update')
    base.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    state = {'status': 'error', 'autoUpdateEnabled': True, 'checkedAt': now, 'updatedAt': None}
    operation = os.open(base / 'operation.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    owns_operation = False
    try:
        try:
            fcntl.flock(operation, fcntl.LOCK_EX | fcntl.LOCK_NB)
            owns_operation = True
        except BlockingIOError:
            return {**state, 'status': 'deferred', 'message': 'Another project update is already running.'}
        previous_path = safe_path(root, '.ai/tmp/skills-auto-update/status.json')
        if previous_path.exists():
            previous = json.loads(previous_path.read_text())
            for key in ('updatedAt', 'backup'):
                if key in previous:
                    state[key] = previous[key]
        recover(root, common)
        with usage_lock(common):
            snapshot(root)
            validate_owned_metadata(root, common)
            installed = validate_installed(root)
        state['installedSha'] = installed
        remote = git(root, 'ls-remote', SOURCE, 'refs/heads/main').split()
        if len(remote) != 2 or remote[1] != 'refs/heads/main' or not re.fullmatch('[a-f0-9]{40}', remote[0]):
            raise ValueError('Unexpected upstream branch response.')
        latest = remote[0]
        state['latestSha'] = latest
        if latest == installed:
            state.update(status='current', message='Project Open Mercato skills are up to date.')
        elif action == 'check':
            state.update(status='available', message='A project skill update is available.')
        else:
            check_idle(url)
            state.update(status='updating', message='Preparing a verified project-only update.')
            write_json(base / 'status.json', state)
            backup = update(root, common, latest, lambda: check_idle(url))
            state.update(status='current', installedSha=latest, updatedAt=datetime.now(timezone.utc).isoformat(), backup=backup,
                         message='Project Open Mercato skills were updated automatically.')
    except Deferred as error:
        state.update(status='deferred', message=str(error))
    except (ValueError, OSError, KeyError, subprocess.SubprocessError) as error:
        state.update(status='error', message=str(error)[:500])
    finally:
        try:
            if owns_operation:
                write_json(base / 'status.json', state)
        finally:
            os.close(operation)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['enroll', 'catalog', 'lease', 'check', 'update'])
    parser.add_argument('--repo', required=True, type=Path)
    parser.add_argument('--cezar-url', default='')
    args = parser.parse_args()
    try:
        if args.action == 'catalog':
            print(json.dumps(catalog(args.repo)))
            return 0
        root, common, primary = identity(args.repo)
        if args.action == 'lease':
            with usage_lock(common):
                print('locked', flush=True)
                sys.stdin.read()
            return 0
        if args.action == 'enroll':
            if root != primary:
                raise ValueError('Enroll the primary checkout, not a linked worktree.')
            config = json.loads(safe_path(root, CONFIG).read_text())
            if config != {'enabled': True, 'source': 'open-mercato/skills', 'branch': 'main', 'intervalHours': 6}:
                raise ValueError('The project has not enabled the supported update policy.')
            REGISTRY.parent.mkdir(parents=True, exist_ok=True)
            data = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else {'projects': []}
            record = {'root': str(root), 'commonDir': str(common)}
            if record not in data['projects']:
                data['projects'].append(record)
                write_json(REGISTRY, data)
            print(json.dumps(record))
        else:
            print(json.dumps(execute(root, args.action, args.cezar_url)))
        return 0
    except subprocess.CalledProcessError:
        # Non-Git catalogs cannot be auto-updated and need no publication lease.
        if args.action == 'lease':
            return 3
        print(json.dumps({'status': 'error', 'message': 'Cannot resolve the Git checkout.'}))
        return 2
    except (ValueError, OSError, Deferred, subprocess.SubprocessError) as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
