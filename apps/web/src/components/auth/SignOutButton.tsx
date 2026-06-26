import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/** Signs out via the Better Auth client, then returns to /login. */
export default function SignOutButton({ label = "Sign out" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    window.location.href = "/login";
  }
  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={busy}>
      {label}
    </Button>
  );
}
