import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { createPlannedTrpcClient } from "@planned/api-client";
import { createMobileAuthClient } from "./auth/client";
import { createSecureTokenStorage, SESSION_TOKEN_KEY, type SecureTokenStorage } from "./auth/storage";
import { authStateFromSession, signedOutState, type AuthState } from "./auth/state";
import "./global.css";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://planned.travel";
type AuthClient = ReturnType<typeof createMobileAuthClient>;
type User = { id: string; name?: string | null; email?: string | null };

export default function App() {
  const storage = useMemo(() => createSecureTokenStorage(), []);
  const auth = useMemo(() => createMobileAuthClient({ baseURL: API_URL, storage }), [storage]);
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    auth.getSession()
      .then((result: { data?: { user: User } | null }) => {
        const data = result.data as { user: User } | null | undefined;
        setState(authStateFromSession(data ? { user: data.user } : null));
      })
      .catch(() => setState(signedOutState("We couldn’t restore your session.")));
  }, [auth]);

  if (state.status === "loading") return <LoadingScreen />;
  if (state.status === "signed-out") {
    return <SignInScreen auth={auth} error={state.error} onSignedIn={(user) => setState(authStateFromSession(user && { user }))} />;
  }
  return <HomeScreen auth={auth} user={state.user} storage={storage} onSignedOut={() => setState(signedOutState())} />;
}

function LoadingScreen() {
  return <SafeAreaView className="flex-1 items-center justify-center bg-white"><ActivityIndicator color="#2572e7" /></SafeAreaView>;
}

function SignInScreen({ auth, error, onSignedIn }: { auth: AuthClient; error?: string; onSignedIn: (user: User | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(error);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage(undefined);
    const result = await auth.signIn.email({ email, password }).catch(() => ({ error: { message: "Unable to sign in." } }));
    setBusy(false);
    if (result.error) return setMessage(result.error.message ?? "Unable to sign in.");
    onSignedIn(result.data?.user ? { id: result.data.user.id, name: result.data.user.name, email: result.data.user.email } : null);
  }

  return <SafeAreaView className="flex-1 justify-center bg-white px-6"><Text className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">planned.travel</Text><Text className="mb-2 text-4xl font-bold text-ink">Plan the trip together.</Text><Text className="mb-8 text-base leading-6 text-muted-foreground">Sign in to keep your itinerary with you wherever you go.</Text><TextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" placeholder="Email" value={email} onChangeText={setEmail} className="mb-3 rounded-xl border border-border px-4 py-3 text-base text-ink" /><TextInput accessibilityLabel="Password" secureTextEntry placeholder="Password" value={password} onChangeText={setPassword} className="mb-3 rounded-xl border border-border px-4 py-3 text-base text-ink" />{message ? <Text accessibilityRole="alert" className="mb-3 text-sm text-red-600">{message}</Text> : null}<Pressable accessibilityRole="button" disabled={busy} onPress={submit} className="items-center rounded-xl bg-primary px-4 py-3 active:bg-primary-hover disabled:opacity-50"><Text className="font-semibold text-white">{busy ? "Signing in…" : "Sign in"}</Text></Pressable></SafeAreaView>;
}

function HomeScreen({ auth, user, storage, onSignedOut }: { auth: AuthClient; user: User; storage: SecureTokenStorage; onSignedOut: () => void }) {
  const [tripCount, setTripCount] = useState<number | null>(null);
  useEffect(() => {
    const client = createPlannedTrpcClient({ baseUrl: API_URL, getToken: () => storage.getItem(SESSION_TOKEN_KEY) });
    client.trips.list.query().then((trips) => setTripCount(trips.length)).catch(() => setTripCount(null));
  }, [storage]);
  async function signOut() { await auth.signOut(); await storage.deleteItem(SESSION_TOKEN_KEY); onSignedOut(); }
  return <SafeAreaView className="flex-1 bg-muted px-6 pt-8"><Text className="text-sm font-semibold uppercase tracking-widest text-primary">Your trips</Text><Text className="mt-2 text-3xl font-bold text-ink">Welcome{user.name ? `, ${user.name}` : " back"}.</Text><View className="mt-6 rounded-2xl border border-border bg-white p-5"><Text className="text-base text-muted-foreground">{tripCount === null ? "Your trips are loading…" : `${tripCount} ${tripCount === 1 ? "trip" : "trips"} ready to explore.`}</Text></View><Pressable accessibilityRole="button" onPress={signOut} className="mt-6 items-center rounded-xl border border-border bg-white px-4 py-3"><Text className="font-semibold text-ink">Sign out</Text></Pressable></SafeAreaView>;
}
