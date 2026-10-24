/**
 * How many workspaces an account may belong to before it can create another (joining is not capped).
 *
 * A dependency-free module so the create-workspace dialog can show the number without pulling the
 * auth module's server imports into the browser bundle. The server reads it through
 * `src/server/auth/provisioning.ts`, which re-exports it: the organization plugin's
 * `organizationLimit` and workspace creation both end up here.
 */
export const WORKSPACE_LIMIT = 20
