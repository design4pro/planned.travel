import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { SESSION_TOKEN_KEY, type SecureTokenStorage } from "./storage";

export function createMobileAuthClient(options: { baseURL: string; storage: SecureTokenStorage }) {
  return createAuthClient({
    baseURL: `${options.baseURL.replace(/\/$/, "")}/api/auth`,
    // @better-auth/expo and better-auth can resolve separate copies of the
    // generic client types in a pnpm workspace; the runtime plugin contract is
    // identical, so keep the boundary explicit here.
    plugins: [expoClient({ scheme: "plannedtravel", storagePrefix: "plannedtravel", storage: options.storage }) as unknown as BetterAuthClientPlugin],
    fetchOptions: {
      customFetchImpl: async (input, init) => {
        const response = await fetch(input, init);
        const token = response.headers.get("set-auth-token");
        if (token) await options.storage.setItem(SESSION_TOKEN_KEY, token);
        return response;
      },
      onSuccess: async ({ response }) => {
        const token = response.headers.get("set-auth-token");
        if (token) await options.storage.setItem(SESSION_TOKEN_KEY, token);
      },
      onError: async ({ response }) => {
        if (response.status === 401) await options.storage.deleteItem(SESSION_TOKEN_KEY);
      },
    },
  });
}
