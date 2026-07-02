/**
 * Notification email templates — pure renderers, one per notification type,
 * localized (en + pl). `renderNotificationEmail` validates the payload against
 * the per-type schema and returns `{ subject, html, text }`, or `null` if the
 * payload doesn't match (the consumer treats null as "no email").
 *
 * Templates are intentionally plain (no external CSS, table-based nothing) —
 * they're transactional one-offs. Kept free of DOM/Worker imports so they're
 * unit-testable in node.
 */
import { notificationPayloadSchemas, type NotificationType } from "@planned/shared";

export type EmailLocale = "en" | "pl";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A localized subject + body lines for a typed payload. */
function message(
  type: NotificationType,
  p: Record<string, unknown>,
  locale: EmailLocale,
  appUrl: string,
): { subject: string; lines: string[] } {
  const L = locale === "pl" ? PL : EN;
  const tn = (p.tripName ?? "") as string;
  switch (type) {
    case "invite_sent": {
      const link = p.inviteToken
        ? `${appUrl.replace(/\/$/, "")}/invite/${p.inviteToken}`
        : `${appUrl.replace(/\/$/, "")}/app/trips/${encodeURIComponent(String(p.tripId ?? ""))}`;
      return {
        subject: L.inviteSentSubject(tn),
        lines: [L.inviteSentBody(String(p.inviterName ?? "")), link, L.team],
      };
    }
    case "invite_accepted": {
      return {
        subject: L.inviteAcceptedSubject(tn),
        lines: [L.inviteAcceptedBody(tn, String(p.accepterName ?? ""), String(p.role)), L.team],
      };
    }
    case "member_role_changed": {
      return {
        subject: L.roleChangedSubject(tn),
        lines: [L.roleChangedBody(tn, String(p.newRole)), L.team],
      };
    }
    case "member_removed": {
      return { subject: L.removedSubject(tn), lines: [L.removedBody(tn), L.team] };
    }
    case "reservation_added": {
      return {
        subject: L.reservationAddedSubject(tn),
        lines: [L.reservationAddedBody(tn, String(p.title ?? ""), String(p.type), String(p.addedByName ?? "")), L.team],
      };
    }
    case "reservation_confirmed": {
      return {
        subject: L.reservationConfirmedSubject(tn),
        lines: [L.reservationConfirmedBody(tn, String(p.title ?? ""), String(p.type)), L.team],
      };
    }
    case "expense_added": {
      return {
        subject: L.expenseAddedSubject(tn),
        lines: [L.expenseAddedBody(tn, String(p.description ?? ""), fmtMoney(p), String(p.paidByName ?? "")), L.team],
      };
    }
    case "expense_split_updated": {
      return {
        subject: L.expenseSplitSubject(tn),
        lines: [L.expenseSplitBody(tn, fmtMoney(p)), L.team],
      };
    }
    case "subscription_activated": {
      return {
        subject: L.subActivatedSubject,
        lines: [L.subActivatedBody(String(p.interval ?? "")), L.team],
      };
    }
    case "subscription_canceled": {
      return {
        subject: locale === "pl" ? PL.subCanceledSubject : EN.subCanceledSubject,
        lines: [locale === "pl" ? PL.subCanceledBody : EN.subCanceledBody, L.team],
      };
    }
    case "subscription_past_due": {
      return {
        subject: locale === "pl" ? PL.subPastDueSubject : EN.subPastDueSubject,
        lines: [locale === "pl" ? PL.subPastDueBody : EN.subPastDueBody, L.team],
      };
    }
  }
}

function fmtMoney(p: Record<string, unknown>): string {
  const amountCents = Number(p.amountCents ?? 0);
  const currency = String(p.currency ?? "");
  return `${(amountCents / 100).toFixed(2)} ${currency}`;
}

export function renderNotificationEmail(
  type: NotificationType,
  payload: unknown,
  locale: EmailLocale,
  appUrl: string,
): RenderedEmail | null {
  const schema = notificationPayloadSchemas[type];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return null;
  const { subject, lines } = message(type, parsed.data as Record<string, unknown>, locale, appUrl);
  const text = lines.join("\n");
  const html = `<!doctype html><html><body>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}</body></html>`;
  return { subject, text, html };
}

/* ------------------------------- Copy (en) ------------------------------- */
const EN = {
  team: "— the planned.travel team",
  inviteSentSubject: (tn: string) => `You're invited to plan "${tn}" on planned.travel`,
  inviteSentBody: (by: string) => (by ? `${by} invited you to collaborate on a trip.` : "You've been invited to collaborate on a trip."),
  inviteAcceptedSubject: (tn: string) => `Trip "${tn}" — invite accepted`,
  inviteAcceptedBody: (tn: string, who: string, role: string) => `${who || "Someone"} accepted your invite and joined "${tn}" as ${role}.`,
  roleChangedSubject: (tn: string) => `Your role on "${tn}" changed`,
  roleChangedBody: (tn: string, role: string) => `Your role on the trip "${tn}" is now ${role}.`,
  removedSubject: (tn: string) => `You were removed from "${tn}"`,
  removedBody: (tn: string) => `You were removed from the trip "${tn}".`,
  reservationAddedSubject: (tn: string) => `New reservation on "${tn}"`,
  reservationAddedBody: (tn: string, title: string, type: string, by: string) => `${by || "Someone"} added a ${type} reservation${title ? ` (${title})` : ""} to "${tn}".`,
  reservationConfirmedSubject: (tn: string) => `Reservation confirmed on "${tn}"`,
  reservationConfirmedBody: (tn: string, title: string, type: string) => `A ${type} reservation${title ? ` (${title})` : ""} on "${tn}" is now confirmed.`,
  expenseAddedSubject: (tn: string) => `New expense on "${tn}"`,
  expenseAddedBody: (tn: string, desc: string, money: string, by: string) => `${by || "Someone"} added an expense${desc ? ` (${desc})` : ""} of ${money} to "${tn}".`,
  expenseSplitSubject: (tn: string) => `Expense split updated on "${tn}"`,
  expenseSplitBody: (tn: string, money: string) => `An expense of ${money} on "${tn}" was split — your share may have changed.`,
  subActivatedSubject: "planned.travel Pro is active",
  subActivatedBody: (interval: string) => `Your Pro subscription is active${interval ? ` (billed ${interval})` : ""}. Thanks for upgrading!`,
  subCanceledSubject: "planned.travel Pro canceled",
  subCanceledBody: "Your Pro subscription has been canceled. You'll keep Pro until the period ends.",
  subPastDueSubject: "planned.travel Pro — payment issue",
  subPastDueBody: "We couldn't process your Pro payment. Please update your billing to keep Pro.",
};

/* ------------------------------- Copy (pl) ------------------------------- */
const PL = {
  team: "— zespół planned.travel",
  inviteSentSubject: (tn: string) => `Zaproszenie do planowania „${tn}" na planned.travel`,
  inviteSentBody: (by: string) => (by ? `${by} zaprosił(a) Cię do wspólnej planowania wycieczki.` : "Otrzymano zaproszenie do wspólnej planowania wycieczki."),
  inviteAcceptedSubject: (tn: string) => `Wycieczka „${tn}" — zaakceptowano zaproszenie`,
  inviteAcceptedBody: (tn: string, who: string, role: string) => `${who || "Ktoś"} zaakceptował(a) zaproszenie i dołączył(a) do „${tn}" jako ${role}.`,
  roleChangedSubject: (tn: string) => `Twoja rola w „${tn}" uległa zmianie`,
  roleChangedBody: (tn: string, role: string) => `Twoja rola w wycieczce „${tn}" to teraz ${role}.`,
  removedSubject: (tn: string) => `Usunięto Cię z „${tn}"`,
  removedBody: (tn: string) => `Zostałeś(aś) usunięty(a) z wycieczce „${tn}".`,
  reservationAddedSubject: (tn: string) => `Nowa rezerwacja w „${tn}"`,
  reservationAddedBody: (tn: string, title: string, type: string, by: string) => `${by || "Ktoś"} dodał(a) rezerwację ${type}${title ? ` (${title})` : ""} do „${tn}".`,
  reservationConfirmedSubject: (tn: string) => `Potwierdzono rezerwację w „${tn}"`,
  reservationConfirmedBody: (tn: string, title: string, type: string) => `Rezerwacja ${type}${title ? ` (${title})` : ""} w „${tn}" jest potwierdzona.`,
  expenseAddedSubject: (tn: string) => `Nowy wydatek w „${tn}"`,
  expenseAddedBody: (tn: string, desc: string, money: string, by: string) => `${by || "Ktoś"} dodał(a) wydatek${desc ? ` (${desc})` : ""} o wartości ${money} do „${tn}".`,
  expenseSplitSubject: (tn: string) => `Zaktualizowano podział wydatku w „${tn}"`,
  expenseSplitBody: (tn: string, money: string) => `Wydatek ${money} w „${tn}" został podzielony — Twój udział mógł ulec zmianie.`,
  subActivatedSubject: "planned.travel Pro jest aktywne",
  subActivatedBody: (interval: string) => `Twoja subskrypcja Pro jest aktywna${interval ? ` (rozliczenie ${interval})` : ""}. Dziękujemy!`,
  subCanceledSubject: "planned.travel Pro anulowane",
  subCanceledBody: "Twoja subskrypcja Pro została anulowana. Pro zachowasz do końca okresu.",
  subPastDueSubject: "planned.travel Pro — problem z płatnością",
  subPastDueBody: "Nie udało się pobrać płatności za Pro. Zaktualizuj dane rozliczeniowe, aby zachować Pro.",
};
