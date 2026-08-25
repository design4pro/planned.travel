/**
 * Fallback declarations for the ten English namespace files.
 *
 * `docs/SPEC.md` §8 fixes the catalogue layout as
 * `messages/<locale>/<namespace>.ts`, gives the ten namespaces by name, and
 * assigns each `messages/en/<namespace>.ts` to the item that owns the screens
 * it serves. `../types.ts` derives the key union from `import type` of all ten,
 * which means all ten must resolve — including before the item that owns one
 * has written it.
 *
 * A wildcard ambient module declaration is exactly the tool for that, and it is
 * a fallback rather than an override: TypeScript resolves a relative specifier
 * against the file system first and only reaches a pattern declaration when
 * nothing is there. Measured against the pinned compiler — with
 * `messages/en/shell.ts` present, `keyof typeof Shell` is that file's real key
 * union; with `messages/en/auth.ts` absent, the import resolves here instead of
 * failing.
 *
 * The shape below is the empty record on purpose. An absent namespace
 * contributes no keys, so `MessageKey` grows monotonically as the nine content
 * items land their files and never widens to `string` in the meantime — a
 * `t()` call for a key nobody has authored stays a compile error that names the
 * key. Declaring the modules `any` would have been the same amount of code and
 * would have silently disabled the guarantee this whole module exists for.
 *
 * The `default` export is also the contract: §8 says a namespace file is *one
 * flat object of keys, default-exported*, so a file that exports it under some
 * other name fails to typecheck instead of quietly contributing nothing.
 *
 * Delete this file once all ten exist. Until then it is the only thing standing
 * between a half-landed catalogue and a red `pnpm typecheck` for every item in
 * the round.
 */

declare module '*/messages/en/shell' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/auth' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/trips' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/modules' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/costs' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/atlas' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/journal' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/marketing' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/settings' {
  const messages: Record<never, never>
  export default messages
}

declare module '*/messages/en/ui' {
  const messages: Record<never, never>
  export default messages
}
