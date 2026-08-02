import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  return (
    <main className="page-shell">
      <p className="eyebrow">planned.travel</p>
      <h1>Plan the trip together.</h1>
      <p className="lede">
        The TanStack Start runtime is live. Existing trip vertical slices are being moved onto
        this Worker boundary incrementally.
      </p>
      <a className="link" href="/api/health">
        Check Worker health →
      </a>
    </main>
  );
}
