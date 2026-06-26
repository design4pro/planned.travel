/**
 * Message catalog for English (default) + Polish.
 * Add keys here as UI is built; keep both locales in sync. The key structure
 * is Paraglide-compatible so we can migrate to codegen later if needed.
 */
export const languages = { en: "English", pl: "Polski" } as const;
export type Lang = keyof typeof languages;
export const defaultLang: Lang = "en";

export const ui = {
  en: {
    "badge": "planned.travel",
    "hero.titlePrefix": "Your trips. Your plan.",
    "hero.titleAccent": "AI-native.",
    "hero.subtitle":
      "A collaborative travel-planning SaaS — generate itineraries with AI, plan on the map together in realtime, track budgets, packing, and reservations. Web-first; an Expo mobile app follows.",
    "cta.health": "Check health",
    "cta.github": "GitHub",
    "stack.heading": "Foundation stack",
    "lang.switch": "Language",
    "footer":
      "Built on Cloudflare · See PLANS.md for the roadmap · Reference (not fork): TREK (AGPL-3.0).",
  },
  pl: {
    "badge": "planned.travel",
    "hero.titlePrefix": "Twoje podróże. Twój plan.",
    "hero.titleAccent": "Napędzane AI.",
    "hero.subtitle":
      "SaaS do planowania podróży we współpracy — generuj plany z AI, planuj na mapie wspólnie w czasie rzeczywistym, śledź budżet, pakowanie i rezerwacje. Najpierw web; potem aplikacja Expo.",
    "cta.health": "Sprawdź status",
    "cta.github": "GitHub",
    "stack.heading": "Stos technologiczny",
    "lang.switch": "Język",
    "footer":
      "Zbudowano na Cloudflare · Zobacz PLANS.md · Referencja (nie fork): TREK (AGPL-3.0).",
  },
} as const;

export type MessageKey = keyof (typeof ui)[typeof defaultLang];
