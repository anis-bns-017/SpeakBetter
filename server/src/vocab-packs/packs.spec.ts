import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CATEGORIES, PACKS, PACK_LEVELS } from './packs.content';
import { PACK_XP, QUIZ_SIZE, buildQuiz, gapSentence, judge, passMark, quizSeed, shownOrder } from './packs.engine';
import { VocabPacksService, cardSourceId } from './packs.service';

const CURATED = PACKS.filter((p) => !p.bulk);
const BULK = PACKS.filter((p) => p.bulk);

describe('vocabulary pack content', () => {
  it('has unique pack ids, a pack at every level and 12 words in each hand-written pack', () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of PACK_LEVELS) expect(PACKS.some((p) => p.level === level)).toBe(true);
    for (const p of CURATED) {
      expect(p.id.startsWith(p.level.toLowerCase() + '-')).toBe(true);
      expect(p.words).toHaveLength(12);
      expect(new Set(p.words.map((w) => w.id)).size).toBe(12);
      expect(new Set(p.words.map((w) => w.word.toLowerCase())).size).toBe(12);
    }
  });

  it('has large packs of 8 to 50 words, each word with its learning details', () => {
    expect(BULK.length).toBeGreaterThan(300);
    const count = (category: string) => BULK.filter((p) => p.category === category).reduce((n, p) => n + p.words.length, 0);
    // The big exam lists: GRE 4,000+ and IELTS 3,000+ words in themed sections
    expect(count('gre')).toBeGreaterThanOrEqual(4000);
    expect(count('ielts')).toBeGreaterThanOrEqual(3000);
    for (const p of BULK) {
      expect(p.id.startsWith(p.level.toLowerCase() + '-')).toBe(true);
      expect(p.words.length).toBeGreaterThanOrEqual(8);
      expect(p.words.length).toBeLessThanOrEqual(50);
      expect(new Set(p.words.map((w) => w.id)).size).toBe(p.words.length);
      expect(new Set(p.words.map((w) => w.word.toLowerCase())).size).toBe(p.words.length);
    }
    // Phrasal verbs and idioms: thousands of each, with the exact form a quiz can blank out
    expect(count('phrasal')).toBeGreaterThanOrEqual(3500);
    expect(count('idioms')).toBeGreaterThanOrEqual(6000);
    const phrases = BULK.filter((p) => p.category === 'phrasal' || p.category === 'idioms').flatMap((p) => p.words);
    expect(phrases.filter((w) => w.pos === 'phrasal verb').length).toBeGreaterThan(3500);
    expect(phrases.filter((w) => w.pos === 'proverb').length).toBeGreaterThan(300);
    for (const w of phrases) if (w.form) expect(gapSentence(w.example, w.form)).not.toBeNull();
    const words = BULK.flatMap((p) => p.words);
    const learningWords = BULK.filter((p) => p.category !== 'phrasal' && p.category !== 'idioms').flatMap((p) => p.words);
    const share = (has: (w: (typeof words)[number]) => boolean, of = learningWords) => of.filter(has).length / of.length;
    expect(share((w) => !!w.ipa)).toBeGreaterThan(0.9);
    expect(share((w) => !!w.example)).toBeGreaterThan(0.9);
    expect(share((w) => !!w.syn?.length)).toBeGreaterThan(0.5);
    expect(share((w) => !!w.freq, words)).toBe(1);
    expect(share((w) => !!w.example, phrases)).toBeGreaterThan(0.4);
  });

  it('puts every pack in a known category, with several packs in each exam and advanced category', () => {
    const ids = new Set(CATEGORIES.map((c) => c.id));
    for (const p of PACKS) expect(ids.has(p.category)).toBe(true);
    for (const c of ['ielts', 'toefl', 'gre', 'sat', 'cambridge', 'academic', 'business', 'expressions', 'phrasal', 'idioms'] as const) {
      expect(PACKS.filter((p) => p.category === c).length).toBeGreaterThanOrEqual(4);
    }
    // every category on the page has packs in it
    for (const c of CATEGORIES) expect(PACKS.some((p) => p.category === c.id)).toBe(true);
    expect(PACKS.length).toBeGreaterThanOrEqual(68);
  });

  it('never repeats a word inside a category', () => {
    const repeats: string[] = [];
    for (const c of CATEGORIES) {
      const seen = new Map<string, string>();
      for (const p of PACKS.filter((x) => x.category === c.id)) {
        for (const w of p.words) {
          const key = w.word.toLowerCase();
          if (seen.has(key)) repeats.push(`${c.id}: "${w.word}" in ${seen.get(key)} and ${p.id}`);
          else seen.set(key, p.id);
        }
      }
    }
    expect(repeats).toEqual([]);
  });

  it('writes every example with the word exactly as listed, so a quiz can blank it out', () => {
    const missing = CURATED.flatMap((p) => p.words.filter((w) => gapSentence(w.example, w.word) === null).map((w) => `${p.id}/${w.word}: ${w.example}`));
    expect(missing).toEqual([]);
    for (const p of PACKS) for (const w of p.words) expect(w.meaning.length).toBeGreaterThan(4);
    // In the large packs an example may be missing, but when there is one it is a real sentence
    for (const p of BULK) for (const w of p.words) if (w.example) expect(w.example.split(' ').length).toBeGreaterThanOrEqual(3);
  });

  it('never gives the word away in its own meaning', () => {
    const giveaways = PACKS.flatMap((p) =>
      p.words.filter((w) => gapSentence(w.meaning, w.word) !== null).map((w) => `${p.id}/${w.word}: ${w.meaning}`),
    );
    expect(giveaways).toEqual([]);
  });
});

describe('phrasal verbs and idioms in the quiz', () => {
  const phrases = ['give up', 'put off', 'look after', 'turn down', 'take over'].map((phrase, i) => ({
    id: `w${i + 1}`,
    word: phrase,
    pos: 'phrasal verb' as const,
    meaning: `meaning number ${i + 1}`,
    example: i === 0 ? 'He gave up smoking last year.' : `We ${phrase} every day.`,
    ...(i === 0 ? { form: 'gave up' } : {}),
  }));
  const pack = { id: 'b1-phrasal-test', level: 'B1' as const, category: 'phrasal' as const, title: 'Test', topic: 'Test', icon: 'Link2', summary: '', words: phrases };

  it('blanks out the phrase as it appears in the sentence, while the answer stays in the base form', () => {
    const quiz = buildQuiz(pack, 'seed', 5);
    const gap = quiz.find((q) => q.kind === 'gap' && q.wordId === 'w1');
    // Whether or not this seed asks the gap question for "give up", a gap question for it uses the written form
    if (gap) {
      expect(gap.prompt).toBe('He _____ smoking last year.');
      expect(gap.options[0]).toBe('give up');
    }
    expect(gapSentence('He gave up smoking last year.', 'gave up')).toBe('He _____ smoking last year.');
    expect(gapSentence('He gave up smoking last year.', 'give up')).toBeNull();
  });
});

describe('gapSentence', () => {
  it('blanks the whole word only, ignoring case, and returns null when it is absent', () => {
    expect(gapSentence('The rest of the restaurant is quiet.', 'rest')).toBe('The _____ of the restaurant is quiet.');
    expect(gapSentence('Let\'s call it a day.', 'call it a day')).toBe('Let\'s _____.');
    expect(gapSentence('She is a Tourist here.', 'tourist')).toBe('She is a _____ here.');
    expect(gapSentence('Nothing here.', 'menu')).toBeNull();
    expect(gapSentence('We tourists came.', 'tourist')).toBeNull();
  });
});

describe('buildQuiz', () => {
  const pack = PACKS[0];

  it('asks about different words, alternating meaning and gap questions, with four distinct options', () => {
    const quiz = buildQuiz(pack, 'u1:a1-daily-routines:0');
    expect(quiz).toHaveLength(QUIZ_SIZE);
    expect(new Set(quiz.map((q) => q.wordId)).size).toBe(QUIZ_SIZE);
    expect(quiz.map((q) => q.kind)).toEqual(['meaning', 'gap', 'meaning', 'gap', 'meaning', 'gap', 'meaning', 'gap']);
    for (const q of quiz) {
      expect(new Set(q.options).size).toBe(4);
      const word = pack.words.find((w) => w.id === q.wordId)!;
      expect(q.options[0]).toBe(word.word);
      expect(q.prompt).toBe(q.kind === 'gap' ? gapSentence(word.example, word.word) : word.meaning);
    }
  });

  it('is the same for the same learner and attempt, and changes with the attempt', () => {
    const a = buildQuiz(pack, 'u1:p:0').map((q) => q.id).join();
    expect(buildQuiz(pack, 'u1:p:0').map((q) => q.id).join()).toBe(a);
    const others = [1, 2, 3, 4].map((n) => buildQuiz(pack, `u1:p:${n}`).map((q) => q.id).join());
    expect(others.some((o) => o !== a)).toBe(true);
  });

  it('works for every pack', () => {
    for (const p of PACKS) {
      const quiz = buildQuiz(p, `u:${p.id}:0`);
      expect(quiz).toHaveLength(QUIZ_SIZE);
      for (const q of quiz) expect(new Set(q.options).size).toBe(4);
    }
  });
});

describe('judge', () => {
  it('marks by the option as shown', () => {
    const pack = PACKS[1];
    const seed = quizSeed('u1', pack.id, 0);
    const q = buildQuiz(pack, seed)[0];
    const rightSlot = shownOrder(seed, q).indexOf(0);
    expect(judge(q, rightSlot, seed)).toMatchObject({ answered: true, correct: true, chosen: q.options[0], right: q.options[0] });
    const wrong = judge(q, (rightSlot + 1) % 4, seed);
    expect(wrong).toMatchObject({ answered: true, correct: false });
    expect(wrong.chosen).not.toBe(q.options[0]);
    expect(judge(q, 7, seed).answered).toBe(false);
    expect(judge(q, 'x', seed).answered).toBe(false);
    expect(passMark(8)).toBe(6);
  });
});

function setup() {
  const progress = new Map<string, any>();
  const cards = new Set<string>();
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: 'A1' }) },
    flashcard: {
      findMany: jest.fn(async ({ where }: any) => {
        const prefix = where.sourceId?.startsWith;
        return [...cards].filter((id) => !prefix || id.startsWith(prefix)).map((sourceId) => ({ sourceId }));
      }),
    },
    vocabPackProgress: {
      findMany: jest.fn(async () => [...progress.values()]),
      findUnique: jest.fn(async ({ where }: any) => progress.get(where.userId_packId.packId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const id = where.userId_packId.packId;
        const row = progress.get(id);
        if (!row) progress.set(id, { ...create });
        else progress.set(id, { ...row, ...update, attempts: row.attempts + 1 });
      }),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const review: any = {
    addWordCard: jest.fn(async (_u: string, input: any) => {
      if (cards.has(input.sourceId)) return { created: false };
      cards.add(input.sourceId);
      return { created: true };
    }),
  };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new VocabPacksService(prisma, activity, review, badges), prisma, activity, review, badges, progress, cards };
}

/** The answers for the learner's current quiz, right ones except for the question ids in `wrongIds` */
function quizAnswers(userId: string, packId: string, attempts: number, wrongIds: string[] = []) {
  const pack = PACKS.find((p) => p.id === packId)!;
  const seed = quizSeed(userId, packId, attempts);
  return Object.fromEntries(
    buildQuiz(pack, seed).map((q) => {
      const slot = shownOrder(seed, q).indexOf(0);
      return [q.id, wrongIds.includes(q.id) ? (slot + 1) % 4 : slot];
    }),
  );
}

describe('VocabPacksService', () => {
  const id = 'a1-food-drink';

  it('lists every pack, recommending the first one at your level', async () => {
    const { service } = setup();
    const list = await service.list('u1');
    expect(list.packs).toHaveLength(PACKS.length);
    expect(list.level).toBe('A1');
    expect(list.recommended).toBe('a1-daily-routines');
    expect(list.done).toBe(0);
  });

  it('hides the answers when it sends a pack, and shows which words are saved', async () => {
    const { service, cards } = setup();
    cards.add(cardSourceId(id, 'w2'));
    const pack: any = await service.get('u1', id);
    expect(pack.words).toHaveLength(12);
    expect(pack.words.find((w: any) => w.id === 'w2').saved).toBe(true);
    expect(pack.words.find((w: any) => w.id === 'w1').saved).toBe(false);
    expect(pack.quiz).toHaveLength(QUIZ_SIZE);
    expect(JSON.stringify(pack.quiz)).not.toMatch(/wordId|correct/);
    await expect(service.get('u1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('saves words once, all or some', async () => {
    const { service, review } = setup();
    expect(await service.save('u1', id, ['w1', 'w2'])).toEqual({ added: 2, saved: 2, total: 12 });
    expect(await service.save('u1', id)).toEqual({ added: 10, saved: 12, total: 12 });
    expect(await service.save('u1', id)).toEqual({ added: 0, saved: 12, total: 12 });
    expect(review.addWordCard).toHaveBeenCalledWith('u1', expect.objectContaining({ source: 'pack', sourceId: `${id}:w1`, word: 'menu' }));
    await expect(service.save('u1', id, ['nothing'])).rejects.toThrow(BadRequestException);
  });

  it('checks one answer without saving', async () => {
    const { service, prisma } = setup();
    const answers = quizAnswers('u1', id, 0);
    const [qid, slot] = Object.entries(answers)[0];
    expect(await service.check('u1', id, qid, slot)).toMatchObject({ id: qid, correct: true });
    expect((await service.check('u1', id, qid, ((slot as number) + 1) % 4)).correct).toBe(false);
    await expect(service.check('u1', id, 'zz:meaning', 0)).rejects.toThrow(NotFoundException);
    await expect(service.check('u1', id, qid, 'x')).rejects.toThrow(BadRequestException);
    expect(prisma.vocabPackProgress.upsert).not.toHaveBeenCalled();
  });

  it('needs every question answered', async () => {
    const { service } = setup();
    const answers = quizAnswers('u1', id, 0);
    delete answers[Object.keys(answers)[0]];
    await expect(service.finish('u1', id, answers)).rejects.toThrow(BadRequestException);
    await expect(service.finish('u1', id, undefined)).rejects.toThrow(BadRequestException);
  });

  it('pays XP once for passing and checks badges', async () => {
    const { service, activity, badges } = setup();
    const first = await service.finish('u1', id, quizAnswers('u1', id, 0));
    expect(first).toMatchObject({ score: 8, total: 8, passed: true, perfect: true, firstPass: true, xp: PACK_XP, wordsAdded: 0 });
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', PACK_XP, 'VOCABULARY_MASTERED');
    expect(badges.evaluate).toHaveBeenCalledTimes(1);
    const again = await service.finish('u1', id, quizAnswers('u1', id, 1));
    expect(again).toMatchObject({ passed: true, firstPass: false, xp: 0 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('adds the words you missed to your review', async () => {
    const { service, review, cards } = setup();
    const quiz = buildQuiz(PACKS.find((p) => p.id === id)!, quizSeed('u1', id, 0));
    const missed = [quiz[0].id, quiz[2].id];
    const result = await service.finish('u1', id, quizAnswers('u1', id, 0, missed));
    expect(result).toMatchObject({ score: 6, passed: true, firstPass: true, wordsAdded: 2 });
    expect(review.addWordCard).toHaveBeenCalledTimes(2);
    expect(cards.has(cardSourceId(id, quiz[0].wordId))).toBe(true);
    expect(result.results.filter((r) => !r.correct)).toHaveLength(2);
  });

  it('does not complete or pay for a failed try, but keeps the best score', async () => {
    const { service, activity, progress } = setup();
    const q0 = buildQuiz(PACKS.find((p) => p.id === id)!, quizSeed('u1', id, 0)).map((q) => q.id);
    const failed = await service.finish('u1', id, quizAnswers('u1', id, 0, q0.slice(0, 4)));
    expect(failed).toMatchObject({ score: 4, passed: false, firstPass: false, xp: 0 });
    expect(progress.get(id).completedAt).toBeUndefined();
    expect(activity.recordActivity).not.toHaveBeenCalled();
    // The next attempt is a new quiz
    const q1 = buildQuiz(PACKS.find((p) => p.id === id)!, quizSeed('u1', id, 1)).map((q) => q.id);
    await service.finish('u1', id, quizAnswers('u1', id, 1, q1.slice(0, 1)));
    expect(progress.get(id).bestScore).toBe(7);
    expect(progress.get(id).attempts).toBe(2);
  });
});
