/**
 * Whether a field on the page holds text its reader has not sent. Drafts live in component state,
 * so the page is asked rather than each composer: a document load (`useOpenCurrentWorkspace`) drops
 * every one of them, and the reader is asked before it happens.
 */
export function hasUnsentText(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'textarea, input:not([type]), input[type="text"]',
    ),
  ).some((field) => !field.readOnly && field.value.trim().length > 0)
}
