import { useEffect, useState } from "react";

export default function ThemeToggle({ label = "Toggle theme" }: { label?: string }) {
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  useEffect(() => { const stored = localStorage.getItem("theme"); const theme = stored === "dark" || stored === "light" ? stored : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; setResolvedTheme(theme); document.documentElement.classList.toggle("dark", theme === "dark"); }, []);
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`${label}: ${next}`}
      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => { setResolvedTheme(next); localStorage.setItem("theme", next); document.documentElement.classList.toggle("dark", next === "dark"); }}
    >
      {resolvedTheme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
