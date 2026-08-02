import * as SecureStore from "expo-secure-store";

export const SESSION_TOKEN_KEY = "planned.travel.session-token";

export interface SecureTokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  deleteItem(key: string): Promise<void>;
}

export function createSecureTokenStorage(): SecureTokenStorage {
  return {
    getItem: (key) => SecureStore.getItem(key),
    setItem: (key, value) => SecureStore.setItem(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  };
}
