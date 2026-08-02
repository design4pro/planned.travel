export type AuthState =
  | { status: "loading" }
  | { status: "signed-out"; error?: string }
  | { status: "signed-in"; user: { id: string; name?: string | null; email?: string | null } };

export function signedOutState(error?: string): AuthState {
  return error ? { status: "signed-out", error } : { status: "signed-out" };
}

export function authStateFromSession(
  session: { user: { id: string; name?: string | null; email?: string | null } } | null | undefined,
): AuthState {
  return session?.user ? { status: "signed-in", user: session.user } : signedOutState();
}
