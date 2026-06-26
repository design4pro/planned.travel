import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

interface Labels {
  email: string;
  password: string;
  submit: string;
  or: string;
}

interface Props {
  mode: "signin" | "signup";
  social?: string[];
  labels: Labels;
}

/** Email/password auth form + optional social providers. React island. */
export default function AuthForm({ mode, social = [], labels }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "signup"
        ? await authClient.signUp.email({
            email,
            password,
            name: email.split("@")[0] || "Traveler",
          })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message ?? "Something went wrong");
      return;
    }
    window.location.href = "/app";
  }

  async function signInSocial(provider: string) {
    await authClient.signIn.social({
      provider: provider as "google" | "apple",
      callbackURL: "/app",
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        {labels.email}
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <label className="block text-sm font-medium">
        {labels.password}
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={busy}>
        {labels.submit}
      </Button>

      {social.length > 0 && (
        <>
          <p className="text-center text-xs text-muted-foreground">{labels.or}</p>
          <div className="flex flex-col gap-2">
            {social.map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                className="w-full capitalize"
                onClick={() => signInSocial(p)}
              >
                {p}
              </Button>
            ))}
          </div>
        </>
      )}
    </form>
  );
}
