// apps/web/src/lib/countryFlag.ts
// The country a person typed in their profile is free text ("BD", "bd", "Bangladesh", "বাংলাদেশ", "USA"…).
// This turns it into a two-letter ISO code so a flag can be shown, instead of the "no flag" globe.

/** Names people write that Intl doesn't produce */
const ALIASES: Record<string, string> = {
  usa: "US", "u.s.": "US", "u.s.a.": "US", america: "US", "united states of america": "US",
  uk: "GB", "u.k.": "GB", england: "GB", scotland: "GB", wales: "GB", "great britain": "GB", britain: "GB",
  uae: "AE", emirates: "AE", korea: "KR", "south korea": "KR", "republic of korea": "KR",
  russia: "RU", turkey: "TR", "ivory coast": "CI", burma: "MM", holland: "NL", bharat: "IN",
  vietnam: "VN", laos: "LA", "czech republic": "CZ", "hong kong": "HK",
};

let nameIndex: Map<string, string> | null = null;

const normalise = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}. ]/gu, "")
    .trim();

/** Every country name (English and Bangla) → its code, built once on first use */
function buildIndex(): Map<string, string> {
  const index = new Map<string, string>();
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return index;
  for (const locale of ["en", "bn"]) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const name = names.of(code);
        // "UK" is reserved for the United Kingdom, whose real code is GB: never let it win
        if (name && name !== code && code !== "UK" && !index.has(normalise(name))) index.set(normalise(name), code);
      }
    }
  }
  return index;
}

const isRealCode = (code: string) => {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return !!name && name !== code;
  } catch {
    return /^[A-Z]{2}$/.test(code);
  }
};

/** "bd", "Bangladesh", "বাংলাদেশ", "USA" → "BD" / "US"; null when it isn't a country we recognise */
export function resolveCountryCode(input?: string | null): string | null {
  const text = input?.trim();
  if (!text) return null;
  if (/^[A-Za-z]{2}$/.test(text)) {
    const code = text.toUpperCase() === "UK" ? "GB" : text.toUpperCase();
    return isRealCode(code) ? code : null;
  }
  const key = normalise(text);
  if (ALIASES[key]) return ALIASES[key];
  nameIndex ??= buildIndex();
  return nameIndex.get(key) ?? null;
}

/** The flag as an emoji (two regional-indicator letters). Windows draws these as plain letters, so prefer <CountryFlag>. */
export function flagEmoji(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** The country's name in English, for tooltips and screen readers */
export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

const COUNTRY_CODES = ["AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR", "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC", "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF", "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY", "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM", "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX", "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI", "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS", "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK", "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU", "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW"];

/** Every country as { code, name }, sorted by name, for a country picker */
export function countryOptions(): Array<{ code: string; name: string }> {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
}
