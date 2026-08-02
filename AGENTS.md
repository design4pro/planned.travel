# Repository instructions

## UI standard

The web application uses shadcn/ui exclusively. New UI must use local components in `apps/web/src/components/ui`, styled with Tailwind v4 and the semantic tokens in `apps/web/src/styles/global.css`.

Do not add or import HeroUI, `@heroui/react`, `@heroui/styles`, or HeroUI Native. Do not regenerate or consult HeroUI-specific agent documentation for this repository.

Use the existing shadcn conventions: `cn()` from `apps/web/src/lib/utils.ts`, `components.json`, Radix primitives where needed, and accessible native controls when a shadcn component is not present yet.

## Project conventions

- Keep domain logic and contracts platform-independent in `packages/shared`.
- Use tRPC for new application API procedures and validate inputs with shared Zod schemas.
- Keep Cloudflare bindings request-scoped; do not initialize D1, auth, or other runtime bindings at module scope.
- Add tests at public seams, run focused tests while developing, then run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`.
- Update `DESIGN.md`, `PLANS.md`, and `CLAUDE.md` when architectural or UI decisions change.
- Preserve unrelated user changes in the working tree.
