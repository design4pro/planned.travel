import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client (React). Same-origin by default — the Worker serves
 * both the app and /api/auth/*. Sessions are cookie-based on web; Expo will use
 * the bearer plugin + SecureStore.
 */
export const authClient = createAuthClient();
