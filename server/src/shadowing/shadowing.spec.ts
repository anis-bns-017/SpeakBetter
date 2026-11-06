import { NotFoundException } from '@nestjs/common';
import { LESSONS, SHADOW_LEVELS, TRACKS } from './shadowing.content';
import { annotate, averageOf, bestByLine, buildUp, tune, weakWords } from './shadowing.engine';
import { SHADOWING_XP, ShadowingService, sessionStart } from './shadowing.service';

const words = (s: string) => s.trim().split(/\s+/);

describe('shadowing content', () => {
  it('has unique lesson ids that start with their level, in known tracks', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tracks = new Set(TRACKS.map((t) => t.id));
    for (const l of LESSONS) {
      expect(l.id.startsWith(l.level.toLowerCase() + '-')).toBe(true);
      expect(tracks.has(l.track)).toBe(true);
    }
  });

  it('gives every track at least three lessons and covers every level', () => {
    for (const t of TRACKS) expect(LESSONS.filter((l) => l.track === t.id).length).toBeGreaterThanOrEqual(3);
    for (const lv of SHADOW_LEVELS) expect(LESSONS.some((l) => l.level === lv)).toBe(true);
    expect(LESSONS.length).toBeGreaterThanOrEqual(27);
  });

  it('keeps lines short enough to say in one breath, different, and with a tip', () => {
    for (const l of LESSONS) {
      expect(l.lines.length).toBeGreaterThanOrEqual(6);
      expect(new Set(l.lines).size).toBe(l.lines.length);
      for (const line of l.lines) {
        expect(words(line).length).toBeGreaterThanOrEqual(2);
        expect(words(line).length).toBeLessThanOrEqual(16);
        // the pronunciation checker keeps 200 characters of a target
        expect(line.length).toBeLessThanOrEqual(200);
        expect(line).toBe(line.replace(/\s+/g, ' ').trim());
      }
      expect(l.tip.length).toBeGreaterThan(20);
      expect(l.focus.length).toBeGreaterThan(3);
    }
  });
});

describe('annotate', () => {
  const byWord = (text: string) => Object.fromEntries(annotate(text).map((t) => [t.text, t]));

  it('stresses content words and leaves grammar words light', () => {
    const t = byWord('She drives to work every day.');
    expect(t['drives'].stress).toBe(true);
    expect(t['work'].stress).toBe(true);
    expect(t['day.'].stress).toBe(true);
    expect(t['She'].stress).toBe(false);
    expect(t['to'].stress).toBe(false);
  });

  it('stresses negatives and question words', () => {
    const t = byWord("Why don't we go?");
    expect(t['Why'].stress).toBe(true);
    expect(t["don't"].stress).toBe(true);
  });

  it('marks weak forms inside a phrase but not at its end', () => {
    const t = annotate('I want to go for a walk.');
    expect(t.find((x) => x.text === 'to')?.weak).toBe('tuh');
    expect(t.find((x) => x.text === 'for')?.weak).toBe('fer');
    const end = annotate('What are you looking at?');
    expect(end[end.length - 1].weak).toBeNull();
    expect(annotate('Yes, I can.').find((x) => x.text === 'can.')?.weak).toBeNull();
  });

  it('links a consonant sound into a following vowel, but not across punctuation', () => {
    const t = annotate('Turn it off and on again.');
    expect(t.map((x) => x.link)).toEqual([true, true, true, true, true, false]);
    // silent e still ends in a consonant sound
    expect(annotate('Come in.')[0].link).toBe(true);
    // a vowel letter with a consonant sound does not link
    expect(annotate('This university.')[0].link).toBe(false);
    expect(annotate('Thanks, everyone.')[0].link).toBe(false);
    // a vowel sound at the end does not link
    expect(annotate('Go on.')[0].link).toBe(false);
  });
});

describe('tune', () => {
  it('falls for statements and wh- questions, rises for yes/no, and spots tags', () => {
    expect(tune('Nice to meet you.')).toBe('fall');
    expect(tune('Where do you live?')).toBe('fall');
    expect(tune('Are you hungry?')).toBe('rise');
    expect(tune("It's a lovely day, isn't it?")).toBe('tag');
    expect(tune("We don't need to book, do we?")).toBe('tag');
    expect(tune('See you tomorrow!')).toBe('fall');
  });

  it('gives every lesson line a tune', () => {
    for (const l of LESSONS) for (const line of l.lines) expect(['rise', 'fall', 'tag']).toContain(tune(line));
  });
});

describe('buildUp', () => {
  it('keeps short lines as one step', () => {
    expect(buildUp('Nice to meet you.')).toEqual(['Nice to meet you.']);
  });

  it('starts from the end and grows to the whole line', () => {
    const line = "It's a large blue suitcase with a red ribbon on the handle.";
    const steps = buildUp(line);
    expect(steps[steps.length - 1]).toBe(line);
    expect(steps.length).toBeGreaterThan(2);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].endsWith(steps[i - 1])).toBe(true);
      expect(steps[i].length).toBeGreaterThan(steps[i - 1].length);
    }
    expect(words(steps[0]).length).toBeGreaterThanOrEqual(2);
  });

  it('prefers to break after a comma', () => {
    const steps = buildUp('A few years ago, I took a job I really did not want.');
    expect(steps).toContain('I took a job I really did not want.');
  });

  it('works for every lesson line, never more than five steps', () => {
    for (const l of LESSONS)
      for (const line of l.lines) {
        const steps = buildUp(line);
        expect(steps[steps.length - 1]).toBe(line);
        expect(steps.length).toBeLessThanOrEqual(5);
      }
  });
});

describe('scoring helpers', () => {
  const lines = ['Are you hungry?', 'Is this your bag?', 'Do you like coffee?'];
  const attempts = [
    { target: 'are you hungry?', score: 70, missedWords: ['hungry'] },
    { target: 'Are you  hungry?', score: 90, missedWords: [] },
    { target: 'Is this your bag?', score: 60, missedWords: ['bag', 'this'] },
    { target: 'Something else', score: 100, missedWords: ['else'] },
  ];

  it('takes the best attempt per line, matching loosely', () => {
    expect(bestByLine(lines, attempts)).toEqual([90, 60, null]);
  });

  it('collects missed words from this lesson only, most missed first', () => {
    expect(weakWords(lines, [...attempts, { target: 'Is this your bag?', score: 50, missedWords: ['bag'] }])).toEqual(['bag', 'hungry', 'this']);
  });

  it('averages only real scores', () => {
    expect(averageOf([90, null, 60])).toBe(75);
    expect(averageOf([null])).toBeNull();
  });

  it('keeps the session start within the last six hours', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    expect(sessionStart('2026-11-06T11:00:00Z', now).toISOString()).toBe('2026-11-06T11:00:00.000Z');
    expect(sessionStart('2020-01-01T00:00:00Z', now).toISOString()).toBe('2026-11-06T06:00:00.000Z');
    expect(sessionStart('2030-01-01T00:00:00Z', now).toISOString()).toBe(now.toISOString());
    expect(sessionStart('nonsense', now).toISOString()).toBe('2026-11-06T09:00:00.000Z');
  });
});

function setup(attempts: any[] = []) {
  const rows = new Map<string, any>();
  const prisma: any = {
    profile: { findUnique: jest.fn().mockResolvedValue({ level: 'A2', timezone: 'UTC' }) },
    pronunciationAttempt: { findMany: jest.fn(async () => attempts) },
    shadowingProgress: {
      findMany: jest.fn(async () => [...rows.values()]),
      findUnique: jest.fn(async ({ where }: any) => rows.get(where.userId_lessonId.lessonId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const id = where.userId_lessonId.lessonId;
        const row = rows.get(id);
        if (!row) rows.set(id, { ...create });
        else
          rows.set(id, {
            ...row,
            bestScore: update.bestScore,
            lineScores: update.lineScores,
            completions: row.completions + 1,
            linesSpoken: row.linesSpoken + update.linesSpoken.increment,
          });
      }),
    },
  };
  const activity: any = { recordActivity: jest.fn().mockResolvedValue(undefined) };
  const badges: any = { evaluate: jest.fn().mockResolvedValue([]) };
  return { service: new ShadowingService(prisma, activity, badges), rows, prisma, activity, badges };
}

describe('ShadowingService', () => {
  const lesson = LESSONS.find((l) => l.id === 'a1-yes-no-questions')!;

  it('lists every track and lesson and suggests a lesson at your level', async () => {
    const { service } = setup();
    const o = await service.overview('u1');
    expect(o.level).toBe('A2');
    expect(o.tracks).toHaveLength(TRACKS.length);
    expect(o.tracks.reduce((n, t) => n + t.lessons.length, 0)).toBe(LESSONS.length);
    expect(o.next?.level).toBe('A2');
    expect(o.stats).toMatchObject({ done: 0, total: LESSONS.length, average: null, linesSpoken: 0 });
  });

  it('sends a lesson with hints for each line, and a next lesson', async () => {
    const { service } = setup();
    const l = await service.lesson('u1', lesson.id);
    expect(l.lines).toHaveLength(lesson.lines.length);
    expect(l.lines[0]).toMatchObject({ id: `${lesson.id}:0`, text: lesson.lines[0], tune: 'rise' });
    expect(l.lines[0].tokens.length).toBeGreaterThan(0);
    expect(l.next).not.toBeNull();
    await expect(service.lesson('u1', 'nope')).rejects.toThrow(NotFoundException);
  });

  it('builds a daily mix from the library', async () => {
    const { service } = setup();
    const d = await service.daily('u1', '2', new Date('2026-11-06T10:00:00Z'));
    expect(d.id).toBe('daily');
    expect(d.round).toBe(2);
    expect(d.lines.length).toBeGreaterThan(0);
  });

  it('scores a finish from real attempts, pays XP once and keeps the best per line', async () => {
    const attempts = [
      { target: lesson.lines[0], score: 80, missedWords: ['hungry'] },
      { target: lesson.lines[0], score: 95, missedWords: [] },
      { target: lesson.lines[1], score: 65, missedWords: ['coffee'] },
    ];
    const { service, rows, activity, badges } = setup(attempts);
    const first = await service.finish('u1', lesson.id, undefined);
    expect(first).toMatchObject({ firstTime: true, xp: SHADOWING_XP, spoken: 2, total: lesson.lines.length, average: 80, best: 80 });
    expect(first.lines[0]).toMatchObject({ score: 95, best: 95 });
    expect(first.lines[2]).toMatchObject({ score: null, best: null });
    expect(first.weakWords).toEqual(['coffee', 'hungry']);
    expect(activity.recordActivity).toHaveBeenCalledWith('u1', SHADOWING_XP, 'LESSON_COMPLETED');
    expect(badges.evaluate).toHaveBeenCalled();

    attempts.length = 0;
    attempts.push({ target: lesson.lines[0], score: 50, missedWords: [] });
    const again = await service.finish('u1', lesson.id, undefined);
    expect(again).toMatchObject({ firstTime: false, xp: 0, spoken: 1, average: 50, best: 80 });
    // a worse try never lowers a line's best
    expect(again.lines[0]).toMatchObject({ score: 50, best: 95 });
    expect(rows.get(lesson.id)).toMatchObject({ completions: 2, linesSpoken: 3 });
    expect(activity.recordActivity).toHaveBeenCalledTimes(1);
  });

  it('counts a finish without speaking, with no score', async () => {
    const { service, rows } = setup([]);
    const r = await service.finish('u1', lesson.id, new Date().toISOString());
    expect(r).toMatchObject({ firstTime: true, spoken: 0, average: null, best: null });
    expect(rows.get(lesson.id).bestScore).toBeNull();
    await expect(service.finish('u1', 'nope', undefined)).rejects.toThrow(NotFoundException);
  });
});
