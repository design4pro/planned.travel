import { useState } from "react";
import type { NotificationRow } from "@planned/shared";
import type { Lang } from "@/i18n/ui";
import { ui } from "@/i18n/ui";
import { notificationDeepLink, notificationLabel, rowType, timeAgo } from "@/lib/notifications-ui";
import { Button } from "@/components/ui/button";

/**
 * Full notification center (`client:load`). Receives the server-fetched list as
 * `initial` (no flash) and owns mark-read / mark-all-read interactions. Each
 * unread item links to its deep link and marks itself read on click.
 */
export default function NotificationInbox({ lang, initial }: { lang: Lang; initial: NotificationRow[] }) {
  const t = (k: string) => (ui[lang] as Record<string, string | undefined>)[k] ?? k;
  const [items, setItems] = useState<NotificationRow[]>(initial);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initial.length === 100);
  const unread = items.filter((i) => i.readAt == null).length;

  async function openItem(item: NotificationRow) {
    if (item.readAt == null) {
      try {
        await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, {
          method: "POST",
          credentials: "same-origin",
        });
        setItems((rs) => rs.map((r) => (r.id === item.id ? { ...r, readAt: Date.now() } : r)));
        window.dispatchEvent(new CustomEvent("notifications:changed"));
      } catch {
        /* still navigate */
      }
    }
    window.location.href = notificationDeepLink(rowType(item), (item.payload ?? {}) as Record<string, unknown>);
  }

  async function markAllRead() {
    if (unread === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "same-origin",
      });
      if (res.ok) {
        const now = Date.now();
        setItems((rs) => rs.map((r) => (r.readAt == null ? { ...r, readAt: now } : r)));
        window.dispatchEvent(new CustomEvent("notifications:changed"));
      }
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    const oldest = items.at(-1);
    if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/notifications?limit=100&before=${oldest.createdAt}`, {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const next = (await res.json()) as NotificationRow[];
      setItems((current) => [...current, ...next]);
      setHasMore(next.length === 100);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? `${unread} ${t("notifications.unread")}` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={busy || unread === 0}>
          {t("notifications.markAllRead")}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          {t("notifications.empty")}
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {items.map((item) => {
            const type = rowType(item);
            const payload = (item.payload ?? {}) as Record<string, unknown>;
            const isUnread = item.readAt == null;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isUnread ? "bg-brand-600" : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${isUnread ? "font-semibold" : "text-muted-foreground"}`}>
                      {notificationLabel(lang, type, payload)}
                    </span>
                    <span className="block text-xs text-muted-foreground">{timeAgo(item.createdAt, lang)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <Button className="mt-4 w-full" variant="outline" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? t("notifications.loading") : t("notifications.loadMore")}
        </Button>
      )}
    </section>
  );
}
