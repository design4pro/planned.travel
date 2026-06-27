/**
 * Document manager domain logic — trip files (PDFs, tickets, vouchers, photos)
 * stored in Cloudflare R2.
 *
 * Platform-agnostic (no DOM/Worker/Node imports) so it runs in the Astro SSR
 * page, the React islands, the Hono API, and the future Expo app alike.
 */
import { z } from "zod";

/* ------------------------------ Upload caps ------------------------------ */

/** Per PLANS.md §8: docs ≤ 50 MB. Enforced server-side before the R2 put. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/**
 * Loose allow-list of accepted upload MIME types. We don't block unknown types
 * outright (R2 stores any blob), but the client uses this for the file picker
 * `accept` and the server rejects anything obviously dangerous (script/html).
 */
export const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
] as const;

/** MIME types we never store, regardless of file extension (XSS via R2). */
export const BLOCKED_DOCUMENT_TYPES = ["text/html", "application/xhtml+xml"];

/* ------------------------------- DTO shapes ------------------------------ */
// Mirror the @planned/db `document` table; single source of truth for the API
// contract shared with the typed client + Expo app.

export interface DocumentMeta {
  id: string;
  tripId: string;
  reservationId: string | null;
  uploadedByUserId: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

export const linkDocumentSchema = z.object({
  reservationId: z.string().min(1).nullable(),
});
export type LinkDocumentInput = z.infer<typeof linkDocumentSchema>;

/* ------------------------------- Helpers --------------------------------- */

/** Human-readable file size, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number, lang: "en" | "pl" = "en"): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const locale = lang === "pl" ? "pl-PL" : "en-US";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"] as const;
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[i]}`;
}

/** True if a MIME type may be uploaded (not block-listed). */
export function isAllowedUploadType(mimeType: string): boolean {
  return !BLOCKED_DOCUMENT_TYPES.includes(mimeType as (typeof BLOCKED_DOCUMENT_TYPES)[number]);
}
