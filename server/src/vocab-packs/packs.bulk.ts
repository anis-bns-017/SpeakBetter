// server/src/vocab-packs/packs.bulk.ts
// The large vocabulary packs (GRE, IELTS, TOEFL, SAT, Cambridge, academic, business, phrasal verbs and everyday
// English), built by scripts/build-packs.py into data/packs.bulk.json.gz and loaded once.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { VocabPack } from './packs.types';

export const BULK_PACKS_FILE = join(process.cwd(), 'data', 'packs.bulk.json.gz');
/** Phrasal verbs and idioms, built by scripts/build-phrases.py */
export const PHRASE_PACKS_FILE = join(process.cwd(), 'data', 'packs.phrases.json.gz');

interface BulkPacksFile {
  version: number;
  count: number;
  packs: VocabPack[];
}

/** The large packs, or none when the data file has not been built (the hand-written packs still work) */
export function loadBulkPacks(files = [BULK_PACKS_FILE, PHRASE_PACKS_FILE]): VocabPack[] {
  return files.flatMap((file) => {
    if (!existsSync(file)) return [];
    const data = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as BulkPacksFile;
    return data.packs.map((pack) => ({ ...pack, bulk: true }));
  });
}
