export interface LookupLanguage {
  /** The code the translation service expects */
  code: string;
  name: string;
  /** Other ways people write it in a profile ("Bangla", "bn-BD" is handled separately) */
  aliases?: string[];
}

/** Languages a learner can read meanings in. English is the language being learned, so it is not a target. */
export const LOOKUP_LANGUAGES: LookupLanguage[] = [
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali', aliases: ['bangla'] },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'zh-CN', name: 'Chinese', aliases: ['mandarin', 'chinese simplified', 'zh', 'zh-cn'] },
  { code: 'zh-TW', name: 'Chinese (Traditional)', aliases: ['chinese traditional', 'cantonese', 'zh-tw'] },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'fil', name: 'Filipino', aliases: ['tagalog', 'tl'] },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'he', name: 'Hebrew', aliases: ['iw'] },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'id', name: 'Indonesian', aliases: ['bahasa indonesia'] },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'ms', name: 'Malay', aliases: ['bahasa melayu'] },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ne', name: 'Nepali' },
  { code: 'no', name: 'Norwegian', aliases: ['nb', 'nn'] },
  { code: 'fa', name: 'Persian', aliases: ['farsi'] },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese', aliases: ['pt-br', 'pt-pt'] },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sr', name: 'Serbian' },
  { code: 'si', name: 'Sinhala', aliases: ['sinhalese'] },
  { code: 'sk', name: 'Slovak' },
  { code: 'es', name: 'Spanish', aliases: ['espanol', 'castellano'] },
  { code: 'sw', name: 'Swahili' },
  { code: 'sv', name: 'Swedish' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
];

const ENGLISH = new Set(['en', 'english', 'en-us', 'en-gb']);

const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const INDEX = new Map<string, LookupLanguage>();
for (const language of LOOKUP_LANGUAGES) {
  for (const key of [language.code, language.name, ...(language.aliases ?? [])]) {
    INDEX.set(plain(key), language);
  }
}

export function isEnglish(input: unknown): boolean {
  return typeof input === 'string' && ENGLISH.has(plain(input));
}

/**
 * Turns whatever someone typed into their profile ("Bengali", "bangla", "bn", "pt-BR") into a language
 * we can translate into. Returns null for English, blanks and anything we do not recognise.
 */
export function resolveLanguage(input: unknown): LookupLanguage | null {
  if (typeof input !== 'string') return null;
  const key = plain(input);
  if (!key || key.length > 40) return null;
  const direct = INDEX.get(key);
  if (direct) return direct;
  // "bn-BD" or "es_MX": use the language part
  const base = key.split(/[-_\s(]/)[0];
  return base && base !== key ? (INDEX.get(base) ?? null) : null;
}
