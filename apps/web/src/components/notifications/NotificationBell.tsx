import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationRow } from "@planned/shared";
import type { Lang } from "@/i18n/ui";
import { ui } from "@/i18n/ui";
import { notificationDeepLink, notificationLabel, rowType, timeAgo } from "@/lib/notifications-ui";

/**
 * Bell + unread badge for the app shell header (`client:load`). Polls the
 * unread count; on open, fetches the most recent items. Clicking an item marks
 * it read and navigates to its deep link. Same-origin fetch carries the session
 * cookie, so no token handling is needed on web.
 */
export default function NotificationBell({ lang }: { lang: Lang }) {
  const t = (k: string) => (ui[lang] as Record<string, string | undefined>)[k] ?? k;
  const [unread, setUnread] = useState<number | null>(null);
  const [recent, setRecent] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", { credentials: "same-origin" });
      if (res.ok) setUnread(((await res.json()) as { count: number }).count ?? 0);
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, 60_000);
    return () => clearInterval(id);
  }, [refreshCount]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function loadRecent() {
    try {
      const res = await fetch("/api/notifications?limit=5", { credentials: "same-origin" });
      if (res.ok) setRecent(await res.json());
    } catch {
      /* best-effort */
    }
  }

  async function openPanel() {
    const next = !open;
    setOpen(next);
    if (next) await loadRecent();
  }

  async function openItem(item: NotificationRow) {
    const wasUnread = item.readAt == null;
    if (wasUnread) {
      try {
        await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, {
          method: "POST",
          credentials: "same-origin",
        });
        setRecent((rs) => rs.map((r) => (r.id === item.id ? { ...r, readAt: Date.now() } : r)));
        setUnread((n) => Math.max(0, (n ?? 0) - 1));
      } catch {
        /* still navigate */
      }
    }
    window.location.href = notificationDeepLink(rowType(item), (item.payload ?? {}) as Record<string, unknown>);
  }

  const hasUnread = (unread ?? 0) > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={openPanel}
        aria-label={t("notifications.openCenter")}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
            {(unread ?? 0) > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-sm font-semibold">{t("notifications.title")}</p>
            {hasUnread && (
              <a href="/app/notifications" className="text-xs text-brand-600 hover:underline">
                {t("notifications.markAllRead")}
              </a>
            )}
          </div>
          <ul className="max-h-80 divide-y overflow-y-auto">
            {recent.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("notifications.empty")}</li>
            ) : (
              recent.map((item) => {
                const type = rowType(item);
                const payload = (item.payload ?? {}) as Record<string, unknown>;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className={`text-sm ${item.readAt == null ? "font-semibold" : "text-muted-foreground"}`}>
                        {notificationLabel(lang, type, payload)}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(item.createdAt, lang)}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <a
            href="/app/notifications"
            className="block border-t px-3 py-2 text-center text-xs font-medium text-brand-600 hover:bg-accent"
          >
            {t("notifications.viewAll")}
          </a>
        </div>
      )}
    </div>
  );
}
