/**
 * The platform console's product components.
 *
 * Everything here is about *accounts on the platform* rather than about one workspace, which is the
 * distinction `docs/SPEC.md` §5 draws between the two role vocabularies and the reason this is its
 * own module rather than a corner of `components/layout`. Screens import from this barrel and never
 * from a file inside it.
 *
 * Presentation only, and deliberately: these three are the console's shared vocabulary — the role
 * scale, the account cell and the device description — and none of them fetches anything. The
 * controls that *act* on an account live in `src/routes/_app/console/-ui/`, beside the route-local
 * server functions they call, which is the same seam `src/routes/_app/-ui/create-dialogs.tsx`
 * already sits on. A component directory reaching into a route's `-server/` folder would invert the
 * layering; a route's own `-ui/` folder is where that import belongs.
 */

export * from './account-identity'
export * from './failure'
export * from './instant'
export * from './user-agent'
export * from './vocabulary'
