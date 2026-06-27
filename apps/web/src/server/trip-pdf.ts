/**
 * Trip-to-PDF export via Cloudflare Browser Rendering (@cloudflare/puppeteer).
 *
 * The trip data is rendered to a self-contained, print-styled HTML document
 * (inline CSS, no external assets) and printed to A4 by a headless Chromium
 * session from the `BROWSER` binding. The puppeteer import is deferred to the
 * render call so the (heavy) module only loads on the export path.
 */
import type { CloudflareEnv } from "../lib/env";

const esc = (s: unknown): string =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const fmtDate = (ms: number | null | undefined): string => {
  if (ms == null) return "—";
  try {
    return new Date(ms).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
};

const fmtDateTime = (ms: number | null | undefined): string => {
  if (ms == null) return "—";
  try {
    return new Date(ms).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const STATUS_CLASS: Record<string, string> = {
  confirmed: "ok",
  planned: "muted",
  cancelled: "bad",
};

export interface TripPdfData {
  trip: { title: string; startAt: number | null; endAt: number | null; description: string | null };
  days: { id: string; dateIndex: number }[];
  items: { dayId: string; type: string; note: string | null }[];
  places: Map<string, { name: string }>;
  reservations: {
    type: string;
    status: string;
    title: string | null;
    confirmationCode: string | null;
    startsAt: number | null;
    endsAt: number | null;
  }[];
  summaries: { currency: string; totalCents: number; settlements: { fromUserId: string; toUserId: string; amountCents: number }[] }[];
  userNames: Map<string, string>;
  currentUserId: string;
}

/** Build the printable HTML for a trip. */
export function buildTripHtml(d: TripPdfData): string {
  const dayIndex = (n: number) => n + 1;
  const nameOf = (uid: string) => d.userNames.get(uid) ?? uid.slice(0, 6);

  const itinerary = d.days.length
    ? d.days
        .map((day) => {
          const items = d.items.filter((i) => i.dayId === day.id);
          const rows = items.length
            ? items
                .map((it) => {
                  const label =
                    it.type === "note"
                      ? esc(it.note)
                      : it.type === "transport"
                        ? esc(it.note ?? "Transport")
                        : `📍 ${esc(d.places.get(it.note ?? "")?.name ?? it.note ?? "Place")}`;
                  return `<li>${label}</li>`;
                })
                .join("")
            : `<li class="muted">No items</li>`;
          return `<section><h2>Day ${dayIndex(day.dateIndex)}</h2><ul>${rows}</ul></section>`;
        })
        .join("")
    : `<p class="muted">No days planned.</p>`;

  const reservations =
    d.reservations.length > 0
      ? `<table><thead><tr><th>Type</th><th>Title</th><th>Confirmation</th><th>From</th><th>To</th><th>Status</th></tr></thead><tbody>${d.reservations
          .map(
            (r) =>
              `<tr><td>${esc(r.type)}</td><td>${esc(r.title ?? "—")}</td><td>${esc(r.confirmationCode ?? "—")}</td><td>${fmtDateTime(r.startsAt)}</td><td>${fmtDateTime(r.endsAt)}</td><td class="${STATUS_CLASS[r.status] ?? "muted"}">${esc(r.status)}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : `<p class="muted">No reservations.</p>`;

  const costs =
    d.summaries.length > 0
      ? d.summaries
          .map((s) => {
            const settle =
              s.settlements.length === 0
                ? `<p class="muted">All settled.</p>`
                : `<ul>${s.settlements
                    .map(
                      (st) =>
                        `<li>${esc(nameOf(st.fromUserId))} → ${esc(nameOf(st.toUserId))}: <strong>${(st.amountCents / 100).toFixed(2)} ${esc(s.currency)}</strong></li>`,
                    )
                    .join("")}</ul>`;
            const total = (s.totalCents / 100).toFixed(2);
            return `<div class="currency"><h3>${esc(s.currency)} — ${total}</h3>${settle}</div>`;
          })
          .join("")
      : `<p class="muted">No expenses.</p>`;

  const dateRange =
    d.trip.startAt != null || d.trip.endAt != null
      ? `<p class="meta">${fmtDate(d.trip.startAt)} – ${fmtDate(d.trip.endAt)}</p>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(d.trip.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 32px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: #475569; margin: 24px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 8px 0 4px; }
  .meta { color: #64748b; margin: 0 0 4px; font-size: 12px; }
  .brand { color: #64748b; font-size: 11px; margin-bottom: 24px; }
  ul { margin: 4px 0 12px; padding-left: 18px; }
  li { margin: 2px 0; }
  .muted { color: #94a3b8; }
  .ok { color: #15803d; font-weight: 600; }
  .bad { color: #b91c1c; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { color: #475569; font-weight: 600; }
  .currency { margin-bottom: 12px; }
  @page { margin: 16mm; }
</style></head>
<body>
  <p class="brand">planned.travel</p>
  <h1>${esc(d.trip.title)}</h1>
  ${dateRange}
  ${d.trip.description ? `<p class="meta">${esc(d.trip.description)}</p>` : ""}
  <h2>Itinerary</h2>
  ${itinerary}
  <h2>Reservations</h2>
  ${reservations}
  <h2>Costs &amp; settle-up</h2>
  ${costs}
</body></html>`;
}

/** Launch Chromium via the BROWSER binding and print the HTML to an A4 PDF. */
export async function renderTripPdf(
  browserBinding: NonNullable<CloudflareEnv["BROWSER"]>,
  html: string,
): Promise<Uint8Array> {
  const { default: puppeteer } = await import("@cloudflare/puppeteer");
  const browser = await puppeteer.launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" } });
  } finally {
    await browser.close();
  }
}
