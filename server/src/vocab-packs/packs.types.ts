// server/src/vocab-packs/packs.types.ts
/** Shapes shared by every vocabulary pack file, and the categories packs are grouped into */

export type PackLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const PACK_LEVELS: PackLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrasal verb' | 'idiom' | 'phrase' | 'conjunction' | 'proverb';

export type PackCategory = 'everyday' | 'ielts' | 'toefl' | 'gre' | 'sat' | 'cambridge' | 'academic' | 'business' | 'expressions' | 'phrasal' | 'idioms';

export type WordFrequency = 'common' | 'uncommon' | 'rare';

export interface PackWord {
  id: string;
  word: string;
  pos: PartOfSpeech;
  meaning: string;
  /** May be empty in the large packs when no good sentence exists for the word */
  example: string;
  /** Learning details, present on the large packs (the hand-written packs have none of these) */
  ipa?: string;
  /** More example sentences */
  examples?: string[];
  /** Words with a similar meaning */
  syn?: string[];
  /** Words with the opposite meaning */
  ant?: string[];
  /** The word family: related words such as the noun, verb and adjective forms */
  fam?: string[];
  /** Word forms: third, past, pastParticiple, ing, plural, comparative, superlative */
  forms?: Record<string, string>;
  topic?: string;
  /** How common the word is in everyday English */
  freq?: WordFrequency;
  /** CEFR level from the dictionary, when the word is in it */
  lv?: string;
  /**
   * Phrasal verbs and idioms change shape in a sentence ("gave up"): the exact words of the phrase as they
   * appear in `example`, so a quiz can blank them out while the answer options stay in the base form
   */
  form?: string;
  /** Further meanings of the phrase, each with an example when there is one */
  senses?: Array<{ meaning: string; example?: string }>;
  /** Short usage labels such as informal, British, figurative */
  tags?: string[];
}

export interface VocabPack {
  id: string;
  level: PackLevel;
  category: PackCategory;
  title: string;
  topic: string;
  /** A lucide icon name the web app knows */
  icon: string;
  summary: string;
  words: PackWord[];
  /** One of the large packs built from data/packs.bulk.json.gz (by scripts/build-packs.py) */
  bulk?: boolean;
}

export const w = (id: string, word: string, pos: PartOfSpeech, meaning: string, example: string): PackWord => ({ id, word, pos, meaning, example });

/** The groups on the Word packs page, in the order shown */
export const CATEGORIES: Array<{ id: PackCategory; label: string; description: string; icon: string }> = [
  { id: 'everyday', label: 'Everyday English', description: 'The words you need for daily life, from your first steps to fluent conversation.', icon: 'Sun' },
  { id: 'ielts', label: 'IELTS', description: 'Topic vocabulary for IELTS Writing and Speaking: environment, education, technology, health, society and work.', icon: 'Award' },
  { id: 'toefl', label: 'TOEFL', description: 'Words from the academic lectures and readings in TOEFL: science, history, psychology and the arts.', icon: 'GraduationCap' },
  { id: 'gre', label: 'GRE', description: 'Advanced words often tested in the GRE and used in high-level reading and writing.', icon: 'BookMarked' },
  { id: 'sat', label: 'SAT', description: 'Words from SAT reading passages: tone, argument, social science and the great documents of history.', icon: 'ClipboardCheck' },
  { id: 'cambridge', label: 'Cambridge C1/C2', description: 'For Cambridge Advanced and Proficiency: word formation, dependent prepositions, idioms and formal register.', icon: 'Crown' },
  { id: 'academic', label: 'Academic writing', description: 'Linking words, reporting verbs and the precise nouns and adjectives of essays and reports.', icon: 'PenLine' },
  { id: 'business', label: 'Business English', description: 'Meetings, money, marketing and negotiation: the language of work.', icon: 'Briefcase' },
  { id: 'expressions', label: 'Advanced expressions', description: 'Idioms, phrasal verbs, collocations and persuasive language that make your English sound natural.', icon: 'Sparkles' },
  { id: 'phrasal', label: 'Phrasal verbs', description: 'Thousands of phrasal verbs in sections by particle (up, out, off, on, in, down...), the most useful first, each with its meanings and examples.', icon: 'Link2' },
  { id: 'idioms', label: 'Idioms and proverbs', description: 'Thousands of idioms and proverbs in themed sections (body, animals, food, money, weather...), each with its meaning and an example.', icon: 'Quote' },
];
