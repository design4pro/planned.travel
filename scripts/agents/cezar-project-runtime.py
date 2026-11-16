#!/usr/bin/env python3
"""Apply/check a hash-pinned Cezar compatibility patch, never an unknown build."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

VERSION = '0.20.0'
ENTRY_SHA = '6f725f15a1e61da3f9926b76fae0a7844fe00add5a4368a1ec741be1e16d0075'
PINS = {
    'skills.js': 'd17834cd63275ace9dd655bd05ace1881904d12c1a152bc8967b9f8227a3bef8',
    'skills-remote.js': '9c6ee417bff3039a8a8632e9b80e6b6e610be4d3445ee7f71f83c755fc949668',
    'skills-provision.js': '1b40d47f2bdfaf1229bb09f395ed7d4da4ab1704604284f5ba70583782ce48d0',
    'skills-update.js': '698dc86e650ebe1bec28a98f21c2d46e1af3ed32f30199a0ff9e0dcc97bb3113',
    'server/server.js': 'f8051e9fbbab6aedf330e3234d4e6fe547ef627ac588f64de7b8f4cde8ac0bb7',
    'web/dist/assets/skills-BNiKFlUw.js': '607ff257bffd6eed8ea2cf1e55b3f214af3d92d78396f41f53ba5599899a6f17',
    'web/dist/assets/index-BfbbA0lF.js': 'f33530fa32003676b10a136e201b0bfd8b550fc95f2590ea2fd1530b0fcfa6f7',
    'web/dist/index.html': 'f8ccf0ecee5e8c7758f27c10c105df20a1a43f1ffa5c6b46cc46f21606caab0e',
}
# Only this exact earlier revision may be upgraded in place. Unknown edits still fail.
PREVIOUS_PATCHES = {
    'skills-update.js': 'ab0f05d1a4d5ec02263cfe7cfe6031ac9d0f3eebfc3c52161c8882e94e077028',
    'server/server.js': '172652d4e66ac2d761b8175c97279ed7d6567f96527a22320752420dad9467b8',
    'web/dist/assets/skills-BNiKFlUw.js': 'e311eea5fbfb4659aba560e7e8e320808c93d74783061cc9279b08a4317e50f2',
    'web/dist/index.html': 'e23ef3fda8ba13effce7be46ccb3b1fa0f5426bc9455e23b36091345a38c24e6',
}
PREVIOUS_CATALOG = '0e8a9595c0c0e4b1c7720da0b6bf86dbb23341d7569c34026e7f997ecfd4c1da'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('The reviewed Cezar source anchor differs.')
    return text.replace(before, after, 1)


def patched(name, original):
    text = original.decode()
    if name == 'skills.js':
        text = "import { discoverProjectSkills } from './codex-project-skills.mjs';\n" + text
        for signature in [
            'export async function discoverSkills(repoRoot, builtinDir = BUILTIN_SKILLS_DIR) {',
            'export async function discoverLocalSkills(repoRoot) {',
        ]:
            text = replace_once(text, signature, signature + "\n    if (process.env.CEZ_SKILLS_SCOPE === 'project')\n        return discoverProjectSkills(repoRoot, parseFrontmatter);")
    elif name == 'skills-remote.js':
        for signature, result in [
            ('export function getTeamSkillsCached(repoRoot) {', '[]'),
            ('export function waitForTeamSkills(repoRoot) {', 'Promise.resolve([])'),
            ('export async function refreshTeamSkills(repoRoot) {', '[]'),
            ('export async function readRemoteSkill(src, path, atCommit) {', 'null'),
            ('export async function listRemoteSkills(src, opts = {}) {', '[]'),
            ("ignore = () => excludeFromGit(repoRoot, `${skillsDir}/${skill.name}/`)) {", 'false'),
        ]:
            text = replace_once(text, signature, signature + f"\n    if (process.env.CEZ_SKILLS_SCOPE === 'project') return {result};")
    elif name == 'skills-provision.js':
        text = replace_once(text,
            'export async function provisionSkills(cwd, roots, catalog) {',
            "export async function provisionSkills(cwd, roots, catalog) {\n    if (process.env.CEZ_SKILLS_SCOPE === 'project') return [];")
    elif name == 'skills-update.js':
        text = "import { ProjectSkillUpdater } from './codex-project-updates.mjs';\n" + text
        signature = '    constructor(options = {}) {'
        text = replace_once(text, signature, signature + "\n        if (process.env.CEZ_SKILLS_SCOPE === 'project') this.projectUpdates = new ProjectSkillUpdater(options);")
        for signature, result in [
            ('    snapshot(repoRoot) {', 'this.projectUpdates.snapshot(repoRoot)'),
            ('    check(repoRoot, force = false) {', 'this.projectUpdates.check(repoRoot, force)'),
            ('    update(repoRoot, rejectIfBusy = false) {', 'this.projectUpdates.update(repoRoot)'),
            ('    async performCheck(repoRoot, force = false, rejectIfBusy = false) {', 'this.projectUpdates.check(repoRoot, force)'),
            ('    async performUpdate(repoRoot, rejectIfBusy) {', 'this.projectUpdates.update(repoRoot)'),
            ('    evict(repoRoot) {', 'this.projectUpdates.evict(repoRoot)'),
        ]:
            text = replace_once(text, signature, signature + f"\n        if (process.env.CEZ_SKILLS_SCOPE === 'project') return {result};")
    elif name == 'server/server.js':
        signature = '    const skillsUpdateResponse = async (state) => {'
        text = replace_once(text, signature, signature + '\n        if (state.managedByProject === true) return { ...state, inherited: false };')
        text = replace_once(text,
            'new SkillsUpdateService({ invalidateCatalog: refreshTeamSkills })',
            "new SkillsUpdateService({ invalidateCatalog: refreshTeamSkills, projectUpdateBaseUrl: `http://127.0.0.1:${port}` })")
    elif name == 'web/dist/assets/skills-BNiKFlUw.js':
        # Insert after the component's hooks; the normal rendering stays identical.
        anchor = 'return n?O=`Update status is unavailable right now.`'
        managed = '''if(t?.managedByProject===true)return(0,G.jsxs)(`section`,{"data-slot":`skills-update-card`,"data-managed-by-project":`true`,"aria-live":`polite`,className:`rounded-lg border border-border bg-muted/30 p-3`,children:[(0,G.jsx)(`p`,{className:`text-ui font-medium text-foreground`,children:t.autoUpdateEnabled?`Automatic project skill updates`:`Project-managed skills`}),(0,G.jsx)(`p`,{className:`mt-1 text-label text-muted-foreground`,children:t.managedMessage??`Project skill update status is loading.`}),t.autoUpdateEnabled?(0,G.jsx)(`p`,{className:`mt-1 text-label text-muted-foreground`,children:`Checks at startup and every 6 hours while Cezar is running. Global skills are excluded.`}):null,t.nextCheckAt?(0,G.jsxs)(`p`,{className:`mt-1 text-label text-muted-foreground`,children:[`Next check: `,new Date(t.nextCheckAt).toLocaleString()]}):null,t.autoUpdateEnabled?(0,G.jsx)(C,{"data-action":`skills-update-check`,variant:`outline`,size:`sm`,disabled:m.isPending||t.status===`updating`,onClick:()=>v(`check`),children:`Check and update now`}):null]});'''
        text = replace_once(text, anchor, managed + anchor)
    elif name == 'web/dist/index.html':
        # One module identity for entrypoint, lazy imports and static back-imports.
        # The map precedes every module/modulepreload; the index bundle stays intact.
        text = replace_once(text, 'index-BfbbA0lF.js', 'index-BfbbA0lF.js?project-skills=3')
        imports = {f'/assets/{name}': f'/assets/{name}?project-skills=3'
                   for name in ['index-BfbbA0lF.js', 'skills-BNiKFlUw.js']}
        text = replace_once(text, '  <head>', '  <head>\n    <script type="importmap">' + json.dumps({'imports': imports}) + '</script>')
    return text.encode()


def atomic_write(path, data):
    fd, temporary = tempfile.mkstemp(prefix='.codex-project-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def prepare(package, helper):
    package = package.resolve(strict=True)
    metadata = json.loads((package / 'package.json').read_text())
    if metadata.get('name') != '@open-mercato/cezar' or metadata.get('version') != VERSION:
        raise ValueError(f'Unsupported Cezar build. Review the project-skill patch for this version (supported: {VERSION}).')
    if digest((package / 'dist/index.js').read_bytes()) != ENTRY_SHA:
        raise ValueError('Unreviewed Cezar entrypoint.')
    changes = []
    # Validate the whole transaction before changing any file. Keep pristine bytes
    # beside the runtime so rollback never relies on a package download.
    for name, expected in PINS.items():
        target = package / name if name.startswith('web/') else package / 'dist' / name
        backup = target.with_name(target.name + '.codex-project-original')
        if target.is_symlink() or backup.is_symlink():
            raise ValueError('Refusing a symlinked runtime file or backup.')
        current = target.read_bytes()
        original = backup.read_bytes() if backup.exists() else current
        if digest(original) != expected:
            raise ValueError(f'Unreviewed Cezar source: {name}')
        updated = patched(name, original)
        if current not in (original, updated) and digest(current) != PREVIOUS_PATCHES.get(name):
            raise ValueError(f'Cezar runtime drift: {name}')
        changes.append((target, backup, original, updated, current))
    extra = package / 'dist/codex-project-skills.mjs'
    if extra.is_symlink() or (extra.exists() and extra.read_bytes() != helper and digest(extra.read_bytes()) != PREVIOUS_CATALOG):
        raise ValueError('Project skill catalog implementation drift.')
    return changes, extra


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('package', type=Path)
    parser.add_argument('action', choices=['apply', 'check', 'restore'])
    args = parser.parse_args()
    try:
        helper = Path(__file__).with_name('cezar-project-skills.mjs').read_bytes()
        changes, extra = prepare(args.package, helper)
        extras = [(extra, helper)]
        for local, installed in [('cezar-project-updates.mjs', 'codex-project-updates.mjs'), ('skills-auto-update.py', 'skills-auto-update.py')]:
            data = Path(__file__).with_name(local).read_bytes()
            target = extra.parent / installed
            if target.is_symlink() or (target.exists() and target.read_bytes() != data):
                raise ValueError(f'Project update implementation drift: {installed}')
            extras.append((target, data))
        if args.action == 'check':
            if any(not path.exists() or path.read_bytes() != data for path, data in extras) or any(current != updated for _, _, _, updated, current in changes):
                raise ValueError('The reviewed Cezar project-skill patch is not installed.')
        elif args.action == 'apply':
            for path, data in extras:
                if not path.exists() or path.read_bytes() != data:
                    atomic_write(path, data)
            for target, backup, original, updated, current in changes:
                if not backup.exists():
                    atomic_write(backup, original)
                if current != updated:
                    atomic_write(target, updated)
        else:
            for target, _, original, _, current in changes:
                if current != original:
                    atomic_write(target, original)
            for path, _ in extras:
                path.unlink(missing_ok=True)
        return 0
    except (ValueError, OSError) as error:
        print(f'cezar-project: {error}', file=__import__('sys').stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
