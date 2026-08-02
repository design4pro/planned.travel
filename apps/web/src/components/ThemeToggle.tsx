import { useTheme } from "@heroui/react";

export default function ThemeToggle({ label = "Toggle theme" }: { label?: string }) {
  const { resolvedTheme, setTheme } = useTheme("system");
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={`${label}: ${next}`}
      className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => setTheme(next)}
    >
      {resolvedTheme === "dark" ? "☀︎" : "☾"}
    </button>
  );
}
