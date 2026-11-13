// apps/web/src/lib/legal.ts
// The facts the public pages (landing, Terms, Privacy) depend on. Fill these in before launch; set them in
// apps/web/.env so they never need a code change:
//   VITE_CONTACT_EMAIL=hello@your-domain.com
//   VITE_LEGAL_NAME=Your name or company
//   VITE_LEGAL_COUNTRY=Bangladesh
// The Terms and Privacy pages are plain-language drafts written from how the app actually works. They are not
// legal advice: have them checked before you take payments or open to the public.

const env = import.meta.env as Record<string, string | undefined>;

export const LEGAL = {
  product: "SpeakBetter",
  /** Who runs the service (a person or a company) */
  operator: env.VITE_LEGAL_NAME?.trim() || "the SpeakBetter team",
  /** Where questions, data requests and complaints go; empty until set */
  contactEmail: env.VITE_CONTACT_EMAIL?.trim() || "",
  /** Whose law applies to the Terms */
  country: env.VITE_LEGAL_COUNTRY?.trim() || "",
  /** Youngest age allowed; under 18 needs a parent's or guardian's permission */
  minimumAge: Number(env.VITE_MINIMUM_AGE) || 13,
  /** Change this whenever the Terms or Privacy text changes */
  updated: "11 November 2026",
} as const;
