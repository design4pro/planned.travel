import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Input, Label, TextField } from "@heroui/react";

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
      <TextField isRequired value={email} onChange={setEmail}>
        <Label>{labels.email}</Label>
        <Input type="email" autoComplete="email" />
      </TextField>
      <TextField isRequired value={password} onChange={setPassword}>
        <Label>{labels.password}</Label>
        <Input type="password" minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
      </TextField>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Button type="submit" className="w-full" isDisabled={busy}>
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
                isDisabled={busy}
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
