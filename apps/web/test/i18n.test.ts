/**
 * i18n completeness for notifications (design §12.6): every notification UI key
 * must exist and be non-empty in BOTH locales — prevents "works in EN, blank in
 * PL" regressions when a key is added to one catalog but not the other.
 */
import { describe, expect, it } from "vitest";
import { ui } from "../src/i18n/ui";
import { localizedUrlPath } from "../src/i18n/utils";

const NOTIF_TYPES = [
  "invite_sent",
  "invite_accepted",
  "member_role_changed",
  "member_removed",
  "reservation_added",
  "reservation_confirmed",
  "expense_added",
  "expense_split_updated",
  "subscription_activated",
  "subscription_canceled",
  "subscription_past_due",
] as const;

const KEYS = [
  "nav.notifications",
  "notifications.title",
  "notifications.empty",
  "notifications.markAllRead",
  "notifications.markRead",
  "notifications.unread",
  "notifications.openCenter",
  "notifications.viewAll",
  "preferences.title",
  "preferences.email",
  "preferences.emailHint",
  ...NOTIF_TYPES.map((t) => `notif.${t}`),
];

describe("notification i18n completeness", () => {
  for (const lang of Object.keys(ui) as Array<keyof typeof ui>) {
    it(`${lang}: every notification key is present and non-empty`, () => {
      const catalog = ui[lang] as Record<string, string | undefined>;
      for (const key of KEYS) {
        expect(catalog[key], `missing/empty: ${lang}.${key}`).toBeTruthy();
      }
    });
  }
});

describe("localized route paths", () => {
  it("switches locale without duplicating prefixes and preserves query strings", () => {
    expect(localizedUrlPath(new URL("https://planned.travel/pl/login?next=%2Fapp"), "en")).toBe("/login?next=%2Fapp");
    expect(localizedUrlPath(new URL("https://planned.travel/app?tab=trips"), "pl")).toBe("/pl/app?tab=trips");
    expect(localizedUrlPath(new URL("https://planned.travel/"), "pl")).toBe("/pl");
  });
});
