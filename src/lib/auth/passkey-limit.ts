/**
 * How many passkeys one person may hold.
 *
 * One number with two readers that cannot import each other: the passkey plugin refuses the
 * twenty-first registration (`src/server/auth/passkey/plugin.ts`), and the Passkeys screen words
 * the limit in the sentence that explains why Add is disabled. Below the `limit: 50` window of
 * the list and of the exclude list, so both stay complete.
 */
export const MAX_PASSKEYS_PER_USER = 20
