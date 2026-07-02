/**
 * Pure UI helpers for rendering notifications in the React islands (bell +
 * inbox). Kept free of React so they're unit-testable and reusable.
 */
import type { Lang } from "../i18n/ui";
import { ui } from "../i18n/ui";
import type { NotificationRow, NotificationType } from "@planned/shared";

/** Substitute {field} placeholders in a catalog string with payload values. */
function format(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    payload[key] != null ? String(payload[key]) : "",
  );
}

/**
 * Localized, human-readable label for a notification, e.g.
 * "Ada accepted your invite to \"Tokyo\"". Falls back to the type if no copy.
 */
export function notificationLabel(
  lang: Lang,
  type: NotificationType,
  payload: Record<string, unknown> = {},
): string {
  const key = `notif.${type}`;
  const template = (ui[lang] as Record<string, string | undefined>)[key];
  if (!template) return type.replace(/_/g, " ");
  return format(template, payload);
}

/**
 * Where clicking the notification should go.
 *  - invite_sent with a token → the invite link; otherwise the trip.
 *  - trip-scoped types → the trip page.
 *  - subscription_* → the account page.
 */
export function notificationDeepLink(
  type: NotificationType,
  payload: Record<string, unknown> = {},
): string {
  if (type === "invite_sent" && typeof payload.inviteToken === "string" && payload.inviteToken) {
    return `/invite/${encodeURIComponent(payload.inviteToken)}`;
  }
  if (typeof payload.tripId === "string") return `/app/trips/${encodeURIComponent(payload.tripId)}`;
  return "/app/account";
}

const LOCALE: Record<Lang, string> = { en: "en-US", pl: "pl-PL" };

/** Relative time ("just now", "5 minutes ago", …) via Intl, localized. */
export function timeAgo(epochMs: number, lang: Lang, now: number = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto" });
  if (sec < 60) return rtf.format(-Math.max(1, sec), "second");
  if (min < 60) return rtf.format(-min, "minute");
  if (hr < 24) return rtf.format(-hr, "hour");
  if (day < 30) return rtf.format(-day, "day");
  return new Date(epochMs).toLocaleDateString(LOCALE[lang]);
}

/** A row carries its type on the client as `row.type`; narrow it for the UI. */
export function rowType(row: NotificationRow): NotificationType {
  return row.type as NotificationType;
}
