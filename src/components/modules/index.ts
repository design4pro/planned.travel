/**
 * The interactive module surfaces.
 *
 * Each sub-module owns one trip screen — its board, its dialogs, its pure
 * rules — and exposes them through its own barrel. Screens import from
 * `#/components/modules/<module>`; this file is the map.
 *
 * Nothing here builds a query. Writes go through the server functions in
 * `src/server/fns/**`, which validate with Zod and call the tenant-scoped
 * repositories, and every screen re-reads its loader afterwards so what is on
 * screen is what the database actually holds.
 */
export * from './shared'
