import { CARD_COUNT, Goal, Level } from './random-call.constants';

/**
 * Conversation starters shown to both people during a call. Each goal has its
 * own deck, and a level nudges which cards come first (simple questions for
 * beginners, opinion questions for advanced speakers).
 */
const DECKS: Record<Goal, { simple: string[]; deeper: string[] }> = {
  casual: {
    simple: [
      'What did you do today?',
      'What is your favourite food, and why?',
      'Tell me about your family or your best friend.',
      'What do you usually do on weekends?',
      'What is the weather like where you live?',
      'Do you prefer mornings or evenings?',
    ],
    deeper: [
      'What is a small habit that improved your life?',
      'If you could live anywhere for a year, where would it be?',
      'What is something you changed your mind about recently?',
      'What would you do with an extra free day every week?',
    ],
  },
  interview: {
    simple: [
      'Introduce yourself in one minute.',
      'What is your biggest strength?',
      'Why do you want this kind of job?',
      'Describe your last job or studies.',
      'Where do you see yourself in five years?',
    ],
    deeper: [
      'Tell me about a time you solved a hard problem.',
      'Describe a conflict with a teammate and how you handled it.',
      'What is your biggest weakness, and what are you doing about it?',
      'Why should we hire you instead of another candidate?',
      'Tell me about a time you failed and what you learned.',
    ],
  },
  work: {
    simple: [
      'What do you do for work?',
      'Describe a normal day at work.',
      'What do you like most about your job?',
      'How do you get to work?',
    ],
    deeper: [
      'How do you handle a deadline you cannot meet?',
      'Explain your job to someone who has never heard of it.',
      'What would make remote work better for you?',
      'How would you give difficult feedback to a colleague?',
      'Pitch a new idea to your team in 60 seconds.',
    ],
  },
  travel: {
    simple: [
      'Where would you like to travel next?',
      'What is the best place you have visited?',
      'Do you prefer the beach or the mountains?',
      'What do you always pack in your bag?',
    ],
    deeper: [
      'Plan a three-day trip for me to your city.',
      'Tell me about a trip that did not go as planned.',
      'What can travelling teach you that school cannot?',
      'How do you decide where to eat in a new place?',
    ],
  },
  fun: {
    simple: [
      'What is your favourite movie or series?',
      'If you could have any superpower, which one?',
      'What song do you listen to most?',
      'What is a hobby you would like to try?',
    ],
    deeper: [
      'Would you rather lose your phone or your wallet for a year? Why?',
      'Invent a new holiday and explain how people celebrate it.',
      'Which fictional world would you want to live in?',
      'Describe your perfect day with no limits.',
      'What is the most useless thing you are good at?',
    ],
  },
};

/** Small deterministic PRNG so both people get the same deck for a call */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The cards for one call. The same call id always gives the same order, so
 * the server never has to store the deck: both sides can be handed it, and a
 * reconnecting client gets it back unchanged.
 */
export function buildDeck(callId: string, goal: Goal, level: Level): string[] {
  const deck = DECKS[goal] ?? DECKS.casual;
  const random = mulberry32(hash(`${callId}:${goal}`));
  const simple = shuffle(deck.simple, random);
  const deeper = shuffle(deck.deeper, random);
  const ordered =
    level === 'beginner'
      ? [...simple, ...deeper]
      : level === 'advanced'
        ? [...deeper, ...simple]
        : shuffle([...simple, ...deeper], random);
  return ordered.slice(0, CARD_COUNT);
}
