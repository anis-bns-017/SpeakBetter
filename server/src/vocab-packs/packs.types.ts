// server/src/vocab-packs/packs.types.ts
/** Shapes shared by every vocabulary pack file, and the categories packs are grouped into */

export type PackLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const PACK_LEVELS: PackLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrasal verb' | 'idiom' | 'phrase' | 'conjunction';

export type PackCategory = 'everyday' | 'ielts' | 'toefl' | 'gre' | 'sat' | 'cambridge' | 'academic' | 'business' | 'expressions';

export interface PackWord {
  id: string;
  word: string;
  pos: PartOfSpeech;
  meaning: string;
  example: string;
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
];
