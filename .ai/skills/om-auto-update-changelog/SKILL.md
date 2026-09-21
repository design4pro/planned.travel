---
name: om-auto-update-changelog
description: planned.travel extension of the installed om-auto-update-changelog skill. There is no version in the manifest - the topmost CHANGELOG.md heading is the version of record - and a release is a develop to main promotion.
---

Extends the installed skill: read `.claude/skills/om-auto-update-changelog/SKILL.md` and follow it. On top:

- **`--version` cannot be resolved from a manifest here, so resolve it from `CHANGELOG.md`.** `package.json` is `private` and carries no `version`, and there are no release tags; the reasons are in the header of `CHANGELOG.md` and they are deliberate. Read the topmost `# X.Y.Z (YYYY-MM-DD)` heading and propose the next number: **minor** when the window contains a `feat` a user would notice, **patch** when it carries only fixes and internal work. Never write a `version` into `package.json` to make the documented default work - that would create the second source of truth the header exists to refuse. `--since last-release` needs no special handling: it already parses that heading.
- **A release is a `develop → main` promotion** (ADR 0003). Leave `--release-ref` at its default `develop`: that is the branch the promotion is cut from and the one every pull request targets. Pointing it at `main` would build the window from what has already shipped.
- **Run it on the open promotion pull request, before a human merges it** - that pull request exists from the first merge into `develop` (`.github/workflows/promote-develop.yml` keeps it open) and its diff is exactly the release window. The changelog lands as its own docs pull request against `develop`, which the next promotion then carries.
- The changelog pull request is `documentation` and `skip-qa`: `CHANGELOG.md` is outside every path in `SDLC.md`'s QA routing.
