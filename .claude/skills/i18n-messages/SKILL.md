---
name: i18n-messages
description: How to add or change user-facing copy in this repo (23-locale catalogue). Use whenever adding, editing or removing any string a user will see, or when the i18n parity test goes red.
---

The product ships in 23 locales; `en` is the source. The full contract is docs/SPEC.md §9 — this is the working procedure.

## Adding or changing a string

1. Never hardcode user-facing copy in a component. Add a key to the right namespace under `src/lib/i18n/messages/en/` (`atlas` · `auth` · `settings` · `shell` · `ui`) and render it through the message layer.
2. **The same key must land in all 22 other locale files in the same change** — one flat default-exported object per `messages/<locale>/<namespace>.ts`. The parity test (`src/lib/i18n/__tests__/parity.test.ts`) fails the suite on: a missing catalogue file, a key present in one language only, a placeholder renamed in translation, a plural message missing a branch its locale needs, and an English sentence sitting in a non-English catalogue. Run `pnpm test` — red output names the exact locale and key.
3. Author real translations, not machine-mangled English. Each translation is made from **our** English. The reference product's catalogues are AGPL source — never open them for this (clean-room, SPEC §1/§9.9).
4. Removing a key removes it from all 23 files — orphan keys fail parity too.

## Traps that pass a naive check

- **Plural branches differ per locale**: `pl`/`ru`/`uk`/`ar`/`cs` need branches `en` does not have. The parity test knows each locale's required categories — supply them all.
- **Placeholders are part of the key's contract**: `{count}` must survive translation with the same name.
- **`Intl` output differs between workerd and WebKit** — a locale-dependent name taken from the platform must be proven identical in both or frozen in a table (`src/lib/format.ts`, `src/lib/i18n/locales.ts`). A divergence is a hydration error, never a tolerance. `source-rules.test.ts` bans the known-divergent APIs (`Intl.DisplayNames`, `textInfo`) in this directory.
- **`ar` is RTL**: logical CSS properties only, directional icons mirror.
- Long-form legal prose (`src/routes/legal/**`) is out of scope and stays English — do not translate it.

## Verification

`pnpm test` (parity + source rules) is the law here. `pnpm e2e` additionally runs the runtime parity spec when the change touches negotiation or the shell.
