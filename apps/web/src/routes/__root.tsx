import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import "../styles.css";
import ThemeToggle from "../components/ThemeToggle";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "planned.travel" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
});

function RootDocument({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const language = pathname.startsWith("/pl") ? "pl" : "en";
  return (
    <html lang={language}>
      <head>
        <HeadContent />
        <script>{`(() => { const stored = localStorage.getItem("theme"); const theme = stored === "light" || stored === "dark" ? stored : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); document.documentElement.classList.toggle("dark", theme === "dark"); document.documentElement.dataset.theme = theme; })()`}</script>
      </head>
      <body>
        <div className="fixed right-4 top-4 z-10"><ThemeToggle /></div>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
