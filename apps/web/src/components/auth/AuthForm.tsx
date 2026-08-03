import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Labels {
  email: string;
  password: string;
  submit: string;
  or: string;
  genericError: string;
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
      setError(res.error.message ?? labels.genericError);
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
      <div className="space-y-2"><Label htmlFor="auth-email">{labels.email}</Label><Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
      <div className="space-y-2"><Label htmlFor="auth-password">{labels.password}</Label><Input id="auth-password" type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

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
                disabled={busy}
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
