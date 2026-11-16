import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch


source = Path(__file__).resolve().parents[1] / "codex-project.py"
spec = importlib.util.spec_from_file_location("codex_project", source)
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class IsolationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="codex-project-test-")
        self.root = Path(self.temporary.name).resolve()
        self.host = self.root / "user"
        self.host.mkdir()
        self.repo = self.root / "project with spaces"
        self.repo.mkdir()
        self.git("init", "-q", cwd=self.repo)
        self.git("config", "user.name", "Fixture Åuthor")
        self.git("config", "user.email", "fixture@example.test")
        self.git("-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-qm", "fixture")

    def tearDown(self):
        self.temporary.cleanup()

    def git(self, *args, cwd=None):
        # Git hooks export repository-local paths that must not reach fixture repositories.
        env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        return subprocess.check_output(["git", "-C", str(cwd or self.repo), *args], text=True, env=env).strip()

    def launch(self, args=None, cwd=None, env=None):
        return launcher.prepare(args or ["app-server"], cwd or self.repo, self.host,
                                "/fixture/codex", env or {"PATH": os.environ["PATH"]})

    def test_worktrees_share_only_their_repository_profile(self):
        worktree = self.root / "linked worktree"
        with patch.dict(os.environ, {"GIT_INDEX_FILE": ".git/index"}):
            self.git("worktree", "add", "-q", "-b", "fixture-worktree", str(worktree))
        other = self.root / "other"
        other.mkdir()
        self.git("init", "-q", cwd=other)
        first, linked, separate = self.launch(), self.launch(cwd=worktree), self.launch(cwd=other)
        self.assertEqual(first["codexHome"], linked["codexHome"])
        self.assertNotEqual(first["codexHome"], separate["codexHome"])
        self.assertEqual(linked["checkout"], str(worktree))
        self.assertIn(str(self.repo), Path(linked["codexHome"], "config.toml").read_text())

    def test_child_environment_excludes_personal_state_and_startup_injection(self):
        inherited = {"PATH": os.environ["PATH"], "HOME": "/personal", "CODEX_HOME": "/personal/.codex",
                     "CODEX_SQLITE_HOME": "/personal/db", "XDG_CONFIG_HOME": "/personal/config",
                     "BASH_ENV": "/personal/startup", "ZDOTDIR": "/personal/zsh",
                     "GIT_CONFIG_GLOBAL": "/personal/git", "UNRELATED_SECRET": "fixture-only",
                     "CEZ_RUN_ID": "fixture-run", "GH_TOKEN": "fixture-token", "GH_CONFIG_DIR": "/explicit/gh"}
        result = self.launch(env=inherited)
        env = result["env"]
        self.assertEqual(env["CODEX_HOME"], env["CODEX_SQLITE_HOME"])
        self.assertNotEqual(env["HOME"], inherited["HOME"])
        self.assertEqual(env["CEZ_RUN_ID"], "fixture-run")
        self.assertEqual(env["GH_CONFIG_DIR"], "/explicit/gh")
        for key in ["BASH_ENV", "ZDOTDIR", "GIT_CONFIG_GLOBAL", "UNRELATED_SECRET"]:
            self.assertNotIn(key, env)
        config = Path(result["codexHome"], "config.toml").read_text()
        self.assertIn('cli_auth_credentials_store = "file"', config)
        self.assertIn('skills.bundled.enabled = false', config)
        self.assertFalse(Path(result["codexHome"], "auth.json").exists())

    def test_cd_and_shell_metacharacters_are_literal(self):
        result = self.launch(["-C", str(self.repo), "exec", "literal $(touch unexpected); `id`"], cwd=self.root)
        self.assertEqual(result["argv"][-1], "literal $(touch unexpected); `id`")
        self.assertFalse((self.root / "unexpected").exists())

    def test_no_repo_session_fails_but_version_is_isolated(self):
        # The validation runner places TMPDIR inside the real repository.
        # Stop Git discovery at the fixture boundary so this directory has no repo.
        with patch.dict(os.environ, {"GIT_CEILING_DIRECTORIES": str(self.root.parent)}):
            with self.assertRaises(launcher.IsolationError):
                self.launch(cwd=self.root)
        result = self.launch(["--version"], cwd=self.root)
        self.assertEqual(result["id"], "_metadata")
        self.assertNotEqual(result["env"]["HOME"], str(self.host))

    def test_interactive_resume_and_fork_bypass_shared_daemon(self):
        for args in [[], ["resume", "--last"], ["fork", "fixture-id"]]:
            result = launcher.prepare(args, self.repo, self.host, "/fixture/codex", {})
            self.assertIn("--no-daemon", result["argv"])
        self.assertNotIn("--no-daemon", self.launch()["argv"])

    def test_context_overrides_cannot_reenable_global_sources(self):
        for args in [["--profile", "personal"], ["--remote", "unix:///personal"],
                     ["--enable", "plugins"], ["-c", "features.plugins=true"],
                     ["-cmodel_instructions_file='/personal/AGENTS.md'"], ["plugin", "install"]]:
            with self.subTest(args=args), self.assertRaises(launcher.IsolationError):
                self.launch(args)
        self.launch(["-c", 'model_reasoning_effort="high"', "exec", "fixture"])

    def test_modified_config_is_preserved_and_refused(self):
        result = self.launch()
        path = Path(result["codexHome"], "config.toml")
        path.write_text("features.plugins=true\n")
        with self.assertRaises(launcher.IsolationError):
            self.launch()
        self.assertEqual(path.read_text(), "features.plugins=true\n")

    def test_external_app_server_context_and_unknown_flags_are_refused(self):
        for flag in ["--cloud-skills-snapshot", "--code-mode-host"]:
            for args in [["app-server", flag, "/outside/context"],
                         ["app-server", flag + "=/outside/context"]]:
                with self.subTest(args=args), self.assertRaises(launcher.IsolationError):
                    self.launch(args)
        for args in [["app-server", "proxy"], ["app-server", "daemon"],
                     ["--future-context-source", "outside"], ["app-server", "--listen", "ws://localhost:1234"]]:
            with self.subTest(args=args), self.assertRaises(launcher.IsolationError):
                self.launch(args)
        self.launch(["app-server", "--listen", "stdio://"])

    def test_symlinked_state_and_external_project_skills_are_refused(self):
        result = self.launch()
        config = Path(result["codexHome"], "config.toml")
        config.unlink()
        target = self.root / "untouched"
        target.write_text("personal")
        config.symlink_to(target)
        with self.assertRaises(launcher.IsolationError):
            self.launch()
        self.assertEqual(target.read_text(), "personal")
        config.unlink()
        self.launch()
        (self.repo / ".agents").symlink_to(self.root / "outside", target_is_directory=True)
        (self.root / "outside/skills").mkdir(parents=True)
        with self.assertRaises(launcher.IsolationError):
            self.launch()

    def test_user_skills_and_global_instructions_are_refused(self):
        result = self.launch()
        instruction = Path(result["codexHome"], "AGENTS.md")
        instruction.write_text("unexpected user instructions")
        with self.assertRaises(launcher.IsolationError):
            self.launch()
        instruction.unlink()
        skill = Path(result["home"], ".agents/skills/extra/SKILL.md")
        skill.parent.mkdir(parents=True)
        skill.write_text("unexpected skill")
        with self.assertRaises(launcher.IsolationError):
            self.launch()

    def test_parallel_first_use_is_atomic_and_preserves_git_identity(self):
        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: self.launch(), range(8)))
        self.assertEqual(len({r["codexHome"] for r in results}), 1)
        home = Path(results[0]["home"])
        self.assertEqual(home.stat().st_mode & 0o777, 0o700)
        self.assertEqual((home / ".codex/config.toml").stat().st_mode & 0o777, 0o600)
        self.assertIn("Fixture Åuthor", (home / ".gitconfig").read_text())
        result = subprocess.run(["git", "var", "GIT_AUTHOR_IDENT"], cwd=self.repo,
                                env=results[0]["env"], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Fixture Åuthor", result.stdout)

    def test_existing_github_capability_is_forwarded_without_disk_storage(self):
        calls = []
        def token(args, **kwargs):
            calls.append((args, kwargs))
            return subprocess.CompletedProcess(args, 0, "fixture-token\n", "")
        inherited = {"HOME": "/original", "GH_CONFIG_DIR": "/selected/bot"}
        env = {"HOME": "/isolated"}
        launcher.github_auth(env, inherited, token)
        self.assertEqual(env["GH_TOKEN"], "fixture-token")
        self.assertEqual(calls[0][1]["env"], inherited)
        launcher.github_auth(env, inherited, token)
        self.assertEqual(len(calls), 1)
        self.assertNotIn("GH_TOKEN", inherited)
        for key in ["GH_TOKEN", "GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"]:
            launcher.github_auth({key: ""}, inherited, token)
        self.assertEqual(len(calls), 1)
        enterprise = {}
        launcher.github_auth(enterprise, {"GH_HOST": "github.example.test"}, token)
        self.assertIn("GH_ENTERPRISE_TOKEN", enterprise)
        self.assertEqual(calls[-1][0][-1], "github.example.test")

    def test_auth_lookup_is_not_requested_for_metadata_or_diagnostics(self):
        for args in [["--project-info"], ["--version"], ["--help"], ["exec", "--help"],
                     ["app-server", "--help"], ["app-server", "--print-startup-config"],
                     ["debug", "prompt-input"], ["login", "status"]]:
            with self.subTest(args=args):
                self.assertFalse(self.launch(args)["needsGithubAuth"])
        self.assertTrue(self.launch()["needsGithubAuth"])

    def test_managed_cezar_wrapper_changes_only_the_child_environment(self):
        bins = self.root / "bin"
        bins.mkdir()
        codex = bins / "codex-project"
        codex.write_text("#!/bin/sh\nexit 0\n")
        codex.chmod(0o700)
        cezar = self.host / ".cezar/versions/current/node_modules/@open-mercato/cezar/dist/index.js"
        cezar.parent.mkdir(parents=True)
        cezar.write_text('// Fixture entrypoint\n')
        wrapper = bins / "cezar-project-node"
        wrapper.write_text('#!/bin/sh\nprintf "%s\\n" "$CEZ_CODEX_BIN" "$@"\n')
        wrapper.chmod(0o700)
        script = source.with_name("cezar-project.sh")
        result = subprocess.check_output(["sh", str(script), "--help"], text=True,
            env={"HOME": str(self.host), "PATH": str(bins) + ":" + os.environ["PATH"]})
        self.assertEqual(result.splitlines(), [str(codex), str(cezar), "--help"])


if __name__ == "__main__":
    unittest.main()
