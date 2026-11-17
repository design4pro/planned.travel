#!/usr/bin/env python3
"""Run Codex with a repository-owned context and separate user state.

This isolates configuration, not filesystem access. No credentials are copied.
The same Git common directory selects the same profile across worktrees.
"""

import hashlib
import fcntl
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
import time


class IsolationError(Exception):
    pass


ISOLATION = {
    "features.plugins": "false",
    "features.apps": "false",
    "features.memories": "false",
    "skills.bundled.enabled": "false",
    "cli_auth_credentials_store": '"file"',
    "shell_environment_policy.inherit": '"all"',
}
ALLOWED_OVERRIDES = {
    "model", "model_reasoning_effort", "model_reasoning_summary", "model_verbosity",
    "approval_policy", "sandbox_mode", "sandbox_workspace_write.network_access",
    "service_tier",
}
VALUE_OPTIONS = {
    "-C", "--cd", "-c", "--config", "-m", "--model", "-s", "--sandbox",
    "-a", "--ask-for-approval", "-i", "--image", "--add-dir", "-o",
    "--output-last-message", "--output-schema", "--color", "--thread-source",
    "--local-provider", "--listen",
}
FLAG_OPTIONS = {
    "-h", "--help", "-V", "--version", "--no-daemon", "--json", "--ephemeral",
    "--strict-config", "--no-alt-screen", "--search", "--oss", "--last", "--all",
    "--include-non-interactive", "--device-auth", "--with-api-key", "--with-access-token",
    "--worktree", "--skip-git-repo-check", "--ignore-user-config", "--approve-for-me",
    "--stdio", "--print-startup-config", "--analytics-default-enabled", "--startup-sign-out",
}
COMMANDS = {
    "exec", "e", "review", "login", "logout", "mcp", "plugin", "app-server",
    "app", "completion", "update", "doctor", "sandbox", "debug", "apply",
    "resume", "fork", "queue", "archive", "delete", "unarchive", "agents",
    "remote-control", "cloud", "exec-server", "features", "help",
}


def git(cwd, *args):
    env = {k: v for k, v in os.environ.items()
           if k not in {"GIT_DIR", "GIT_COMMON_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"}}
    result = subprocess.run(["git", "-C", str(cwd), *args], env=env,
                            capture_output=True, text=True, timeout=10)
    if result.returncode:
        raise IsolationError("A Git project is required; use -C /absolute/project/path.")
    return result.stdout.rstrip("\n")


def invocation(args, cwd):
    """Resolve Codex's cwd without evaluating shell text or option values."""
    target = Path(cwd)
    command = None
    info = False
    cleaned = []
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--":
            cleaned.extend(args[i:])
            break
        if arg == "--project-info":
            info = True
            i += 1
            continue
        if arg in {"-p", "--profile", "--remote", "--remote-auth-token-env"} or arg.startswith(
            ("--profile=", "--remote=", "--remote-auth-token-env=")
        ) or (arg.startswith("-p") and not arg.startswith("--")):
            raise IsolationError("Profiles and remote servers cannot replace the isolated project context.")
        if arg in {"--enable", "--disable"} or arg.startswith(("--enable=", "--disable=")):
            raise IsolationError("Feature overrides are managed by codex-project.")
        key, sep, value = arg.partition("=")
        if key in VALUE_OPTIONS:
            if not sep:
                i += 1
                if i >= len(args):
                    raise IsolationError(f"Missing value for {arg}.")
                value = args[i]
            if key in {"-C", "--cd"}:
                target = (Path(cwd) / value).resolve()
            if key in {"-c", "--config"}:
                if value.split("=", 1)[0].strip() not in ALLOWED_OVERRIDES:
                    raise IsolationError("This config override is not allowed by codex-project.")
            if key == "--listen" and value != "stdio://":
                raise IsolationError("The project app-server uses stdio, not an external server endpoint.")
            cleaned.extend([key, value])
        elif arg.startswith("-C") and not arg.startswith("--"):
            target = (Path(cwd) / arg[2:]).resolve()
            cleaned.extend(["-C", arg[2:]])
        elif arg.startswith("-c") and not arg.startswith("--"):
            value = arg[2:]
            if value.split("=", 1)[0].strip() not in ALLOWED_OVERRIDES:
                raise IsolationError("This config override is not allowed by codex-project.")
            cleaned.extend(["-c", value])
        else:
            if arg.startswith("-") and arg != "-" and arg not in FLAG_OPTIONS:
                raise IsolationError(f"Unsupported option in the isolated launcher: {arg.split('=', 1)[0]}")
            if command == "app-server" and arg in {"proxy", "daemon"}:
                raise IsolationError("The project app-server cannot reuse a shared daemon.")
            if command is None and not arg.startswith("-"):
                command = arg if arg in COMMANDS else "interactive"
            cleaned.append(arg)
        i += 1
    # Login/logout must stay available; app/plugin/remote management belongs to the normal CLI.
    if command in {"plugin", "app", "agents", "remote-control", "cloud", "exec-server"}:
        raise IsolationError("This command is outside the project-local launcher.")
    return target.resolve(), cleaned, command, info


def identity(cwd):
    common = Path(git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")).resolve()
    checkout = Path(git(cwd, "rev-parse", "--show-toplevel")).resolve()
    records = git(cwd, "worktree", "list", "--porcelain", "-z").split("\0")
    first = next((r[9:] for r in records if r.startswith("worktree ")), None)
    if not first:
        raise IsolationError("Cannot resolve the primary Git worktree.")
    primary = Path(first).resolve()
    slug = re.sub(r"[^a-zA-Z0-9._-]", "-", primary.name)[:60] or "project"
    digest = hashlib.sha256(str(common).encode()).hexdigest()[:20]
    return {"id": f"{slug}-{digest}", "commonDir": str(common),
            "project": str(primary), "checkout": str(checkout)}


def private_dir(path):
    if path.is_symlink():
        raise IsolationError(f"Refusing a symlinked state directory: {path}")
    path.mkdir(mode=0o700, exist_ok=True)
    st = path.lstat()
    if not stat.S_ISDIR(st.st_mode) or st.st_uid != os.getuid():
        raise IsolationError(f"State directory is not owned by this user: {path}")
    path.chmod(0o700)


def managed_file(path, content):
    # Publish complete bytes atomically; parallel Cezar workers never read a partial file.
    fd, temporary = tempfile.mkstemp(prefix=".install-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temporary, path, follow_symlinks=False)
        except FileExistsError:
            st = path.lstat()
            if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid():
                raise IsolationError(f"Refusing an unowned or symlinked managed file: {path}")
            if path.read_text() != content:
                raise IsolationError(f"Managed configuration differs; review it before replacing: {path}")
        path.chmod(0o600)
    finally:
        os.unlink(temporary)


def reject_extra_sources(home, state):
    for path in [state / "AGENTS.md", state / "AGENTS.override.md", state / "agents"]:
        if path.exists() or path.is_symlink():
            raise IsolationError(f"Unexpected user-level instructions: {path}")
    for root in [home / ".agents", state / "skills", Path("/etc/codex/skills")]:
        if root.is_symlink():
            raise IsolationError(f"Unexpected skill symlink: {root}")
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_symlink():
                raise IsolationError(f"Unexpected skill symlink: {path}")
            # The disabled bundled cache can be populated by Codex itself.
            if path.name == "SKILL.md" and not (root == state / "skills" and ".system" in path.relative_to(root).parts):
                raise IsolationError(f"Unexpected non-project skill: {path}")


def prepare(args, cwd, host_home, binary, inherited):
    target, forwarded, command, info = invocation(args, cwd)
    metadata_only = bool(forwarded) and all(a in {"--version", "-V", "--help", "-h"} for a in forwarded)
    project = {"id": "_metadata", "project": None, "commonDir": None, "checkout": None} if metadata_only else identity(target)
    base = host_home / ".local" / "share" / "codex-projects"
    # Do not silently redirect installation/state through a user-created symlink.
    for path in [host_home / ".local", host_home / ".local/share"]:
        if path.is_symlink():
            raise IsolationError(f"Refusing a symlinked installation parent: {path}")
        path.mkdir(exist_ok=True)
    private_dir(base)
    profile = base / project["id"]
    private_dir(profile)
    home = profile / "home"
    private_dir(home)
    state = home / ".codex"
    for path in [state, home / ".config", home / ".cache", home / ".local", home / ".local/share", home / ".local/state"]:
        private_dir(path)
    record = {k: v for k, v in project.items() if k != "checkout"}
    managed_file(profile / "project.json", json.dumps(record, indent=2) + "\n")
    config = '# Managed by codex-project. Authentication is separate; no personal config is imported.\n'
    config += '\n'.join(f'{key} = {value}' for key, value in ISOLATION.items()) + '\n'
    if project["project"]:
        config += f'\n[projects.{json.dumps(project["project"])}]\ntrust_level = "trusted"\n'
    managed_file(state / "config.toml", config)
    reject_extra_sources(home, state)
    if project["checkout"]:
        checkout = Path(project["checkout"])
        for root in [checkout / ".agents/skills", checkout / ".codex/skills"]:
            if root.exists() and not root.resolve().is_relative_to(checkout):
                raise IsolationError(f"Skill root escapes the checkout: {root}")
            if root.exists():
                for path in root.rglob("*"):
                    if path.is_symlink() and not path.resolve().is_relative_to(checkout):
                        raise IsolationError(f"Skill symlink escapes the checkout: {path}")
    # Retain explicit runner/toolchain capabilities, not the full interactive host environment.
    names = {"PATH", "SHELL", "USER", "LOGNAME", "TMPDIR", "TMP", "TEMP", "LANG", "TZ",
             "TERM", "COLORTERM", "NO_COLOR", "FORCE_COLOR", "SSH_AUTH_SOCK", "SSH_AGENT_PID",
             "GH_CONFIG_DIR", "GH_TOKEN", "GITHUB_TOKEN", "GH_HOST", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN",
             "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY", "https_proxy", "http_proxy",
             "all_proxy", "no_proxy", "OPENAI_API_KEY", "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL",
             "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL", "GIT_TERMINAL_PROMPT"}
    prefixes = ("CEZ_", "LC_", "PNPM_", "NPM_CONFIG_", "COREPACK_", "NVM_", "VOLTA_", "FNM_")
    env = {k: v for k, v in inherited.items() if k in names or k.startswith(prefixes)}
    for key in ["CODEX_API_KEY", "CODEX_ACCESS_TOKEN", "CODEX_CA_CERTIFICATE"]:
        if key in inherited:
            env[key] = inherited[key]
    env.update({"HOME": str(home), "CODEX_HOME": str(state), "CODEX_SQLITE_HOME": str(state),
                "XDG_CONFIG_HOME": str(home / ".config"), "XDG_CACHE_HOME": str(home / ".cache"),
                "XDG_DATA_HOME": str(home / ".local/share"), "XDG_STATE_HOME": str(home / ".local/state")})
    # GitHub authentication remains an explicit tool capability, never a source of Codex context.
    if "GH_CONFIG_DIR" not in env:
        env["GH_CONFIG_DIR"] = str(host_home / ".config/gh")
    env.setdefault("CEZ_HOME", str(host_home / ".cezar"))
    # Preserve public Git author identity and use the explicit gh auth capability for HTTPS.
    git_config = '[credential "https://github.com"]\n    helper = !gh auth git-credential\n'
    if project["checkout"]:
        author = {}
        for key in ["name", "email"]:
            result = subprocess.run(["git", "-C", project["checkout"], "config", "--get", f"user.{key}"],
                                    capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                author[key] = result.stdout.strip()
        if author:
            git_config += '[user]\n' + ''.join(f'    {key} = {json.dumps(value, ensure_ascii=False)}\n' for key, value in author.items())
    git_config_path = home / ".gitconfig"
    # An existing project-specific identity may have been intentionally configured after setup.
    if not git_config_path.exists():
        managed_file(git_config_path, git_config)
    elif git_config_path.is_symlink():
        raise IsolationError("Project Git configuration must not be a symlink.")
    overrides = []
    for key, value in ISOLATION.items():
        overrides.extend(["-c", f"{key}={value}"])
    if command in {None, "interactive", "resume", "fork"} and not metadata_only and "--no-daemon" not in forwarded:
        overrides.append("--no-daemon")
    needs_github = not info and command in {None, "interactive", "exec", "e", "review", "resume", "fork", "app-server"}
    needs_github = needs_github and not any(a in {"--help", "-h", "--version", "-V", "--print-startup-config"} for a in forwarded)
    if command == "app-server" and any(a in {"help", "generate-ts", "generate-json-schema"} for a in forwarded):
        needs_github = False
    return {**project, "home": str(home), "codexHome": str(state), "info": info, "needsGithubAuth": needs_github,
            "env": env, "argv": [str(binary), *overrides, *forwarded]}


def github_auth(env, inherited, run=subprocess.run):
    """Carry an already available GitHub capability across HOME changes, in memory only."""
    if any(key in env for key in ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"]):
        return
    hostname = inherited.get("GH_HOST") or "github.com"
    try:
        result = run(["gh", "auth", "token", "--hostname", hostname], env=dict(inherited), capture_output=True,
                     text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return
    if result.returncode == 0 and result.stdout.strip():
        key = "GH_TOKEN" if hostname == "github.com" or hostname.endswith(".ghe.com") else "GH_ENTERPRISE_TOKEN"
        env[key] = result.stdout.strip()


def acquire_skills_lease(common):
    """Keep a shared kernel lease across exec for the entire Codex process lifetime."""
    path = Path(common)
    fd = os.open(path / 'codex-project-skills.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    deadline = time.monotonic() + 15
    try:
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_SH | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise IsolationError('Project skills are being updated; retry after the update finishes.')
                time.sleep(0.05)
        journal = path / 'codex-project-skills-journal.json'
        if journal.exists() or journal.is_symlink():
            raise IsolationError('An interrupted project skill update must recover before starting Codex.')
        os.set_inheritable(fd, True)
        return fd
    except BaseException:
        os.close(fd)
        raise


def main():
    try:
        host_home = Path(pwd.getpwuid(os.getuid()).pw_dir).resolve()
        binary = shutil.which("codex")
        if not binary or Path(binary).resolve() == Path(__file__).resolve():
            raise IsolationError("A separate Codex CLI binary must be available on PATH.")
        launch = prepare(sys.argv[1:], Path.cwd(), host_home, binary, os.environ)
        if launch["info"]:
            print(json.dumps({k: launch[k] for k in ["id", "project", "checkout", "home", "codexHome"]}, indent=2))
            return 0
        if launch["needsGithubAuth"]:
            github_auth(launch["env"], os.environ)
        if launch["commonDir"]:
            acquire_skills_lease(launch["commonDir"])
        os.execve(launch["argv"][0], launch["argv"], launch["env"])
    except (IsolationError, OSError, subprocess.TimeoutExpired) as error:
        print(f"codex-project: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
