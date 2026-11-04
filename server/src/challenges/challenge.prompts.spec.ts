import { CHALLENGE_LEVELS, CHALLENGE_PROMPTS, promptFor, scoreAnswer } from './challenge.prompts';

describe('challenge prompts', () => {
  it('has unique ids and several prompts for every level', () => {
    const ids = CHALLENGE_PROMPTS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of CHALLENGE_LEVELS) {
      expect(CHALLENGE_PROMPTS.filter((x) => x.level === level).length).toBeGreaterThanOrEqual(7);
    }
  });

  it('gives everyone at a level the same prompt on a day, and a different one the next day', () => {
    const day = new Date(2026, 10, 3, 9);
    const evening = new Date(2026, 10, 3, 22);
    const next = new Date(2026, 10, 4, 9);
    expect(promptFor('B1', day).id).toBe(promptFor('B1', evening).id);
    expect(promptFor('B1', day).id).not.toBe(promptFor('B1', next).id);
    expect(promptFor('B1', day).level).toBe('B1');
  });
});

describe('scoreAnswer', () => {
  const prompt = CHALLENGE_PROMPTS.find((x) => x.id === 'a2-1')!;

  it('scores a fluent, on-topic answer well', () => {
    const transcript =
      'Last year I went on a trip to the mountains with my family. We stayed in a small hotel near a lake and we visited ' +
      'a beautiful old village. The best part was walking in the forest every morning and eating fresh food. I really ' +
      'enjoyed the holiday because it was quiet and relaxing, and I would love to travel there again next summer.';
    const stats = scoreAnswer(prompt, transcript, 50);
    expect(stats.tooShort).toBe(false);
    expect(stats.onTopic).toBe(true);
    expect(stats.topicWords).toEqual(expect.arrayContaining(['trip', 'went', 'visit', 'holiday']));
    expect(stats.wpm).toBeGreaterThan(60);
    expect(stats.score).toBeGreaterThan(60);
  });

  it('marks an off-topic answer and scores it lower', () => {
    const onTopic = scoreAnswer(prompt, 'Last year I went on a trip and we visited a lake and stayed in a hotel and I enjoyed the holiday a lot with my friends', 30);
    const offTopic = scoreAnswer(prompt, 'My favourite colour is blue and I think computers are interesting machines and the sky looks nice in the evening', 30);
    expect(offTopic.onTopic).toBe(false);
    expect(offTopic.score as number).toBeLessThan(onTopic.score as number);
  });

  it('does not judge an answer that is too short', () => {
    const stats = scoreAnswer(prompt, 'I went to the sea.', 5);
    expect(stats).toMatchObject({ tooShort: true, onTopic: null, score: null });
  });
});
