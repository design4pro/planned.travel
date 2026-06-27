import { useState } from "react";
import { Button } from "@/components/ui/button";

type Busy = null | "month" | "year" | "manage";

interface Props {
  mode: "free" | "pro";
  labels: {
    upgradeMonthly: string;
    upgradeYearly: string;
    manage: string;
    error: string;
  };
}

/**
 * Pro upgrade (Checkout) + subscription management (Customer Portal) launcher.
 * POSTs to /api/billing/{checkout,portal}, then redirects to the returned URL.
 * Mirrors the MemberAdd/ExpenseForm island pattern.
 */
export default function BillingButtons({ mode, labels }: Props) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(endpoint: string, body: object, tag: Busy) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { url?: string } | null;
      if (!res.ok || !data?.url) throw new Error();
      window.location.href = data.url;
    } catch {
      setBusy(null);
      setError(labels.error);
    }
  }

  if (mode === "pro") {
    return (
      <div>
        <Button onClick={() => go("/api/billing/portal", {}, "manage")} disabled={busy !== null}>
          {busy === "manage" ? "…" : labels.manage}
        </Button>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => go("/api/billing/checkout", { interval: "month" }, "month")}
        disabled={busy !== null}
      >
        {busy === "month" ? "…" : labels.upgradeMonthly}
      </Button>
      <Button
        variant="secondary"
        onClick={() => go("/api/billing/checkout", { interval: "year" }, "year")}
        disabled={busy !== null}
      >
        {busy === "year" ? "…" : labels.upgradeYearly}
      </Button>
      {error && <p className="mt-2 w-full text-sm text-destructive">{error}</p>}
    </div>
  );
}
