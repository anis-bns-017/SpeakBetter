import { CARD_COUNT, Goal, Level } from './random-call.constants';

export type CardKind = 'question' | 'story' | 'opinion' | 'game';
/** 1 = easy, 2 = medium, 3 = deep */
export type CardDepth = 1 | 2 | 3;

export interface ConversationCard {
  id: string;
  /** The goal this card belongs to, or "wild" for cards that fit any call */
  goal: Goal | 'wild';
  depth: CardDepth;
  kind: CardKind;
  /** A short label such as "Food" or "Job interview" */
  topic: string;
  question: string;
  /** Questions to keep the other person talking */
  followUps: string[];
  /** Sentence starters that help answer the question */
  phrases: string[];
}

export const CARD_KINDS: readonly CardKind[] = ['question', 'story', 'opinion', 'game'];

type Seed = [
  depth: CardDepth,
  kind: CardKind,
  topic: string,
  question: string,
  followUps: string[],
  phrases: string[],
];

const POOL_SEEDS: Record<Goal | 'wild', Seed[]> = {
  casual: [
    [1, 'question', 'Daily life', 'What did you do today?',
      ['What was the best part of your day?', 'Was it a normal day for you?'],
      ['I started the day by...', 'After that, I...', 'Later on, I...']],
    [1, 'question', 'Food', 'What is your favourite food, and why?',
      ['Can you cook it yourself?', 'Is there a food you really do not like?'],
      ['My favourite is ... because...', 'It reminds me of...', 'I could eat it every day.']],
    [1, 'question', 'People', 'Tell me about your family or your best friend.',
      ['What do you like doing together?', 'How long have you known each other?'],
      ['He / she is the kind of person who...', 'We have known each other for...', 'What I like most is...']],
    [1, 'question', 'Free time', 'What do you usually do on weekends?',
      ['Do you prefer staying home or going out?', 'What would be a perfect weekend?'],
      ['On weekends I usually...', 'If the weather is nice, I...', 'I try to find time for...']],
    [1, 'game', 'Would you rather', 'Would you rather live by the sea or in the mountains?',
      ['What would you do there every day?', 'What would you miss most from the city?'],
      ['I would rather... because...', 'The main reason is...', 'On the other hand...']],
    [2, 'question', 'Habits', 'What is a small habit that has improved your life?',
      ['How long did it take to become a habit?', 'What habit would you like to start?'],
      ['It sounds simple, but...', 'Ever since I started..., I have...', 'It took me about... to get used to it.']],
    [2, 'opinion', 'Technology', 'Do people spend too much time on their phones? Why or why not?',
      ['How much time do you spend on yours?', 'Is there a time you switch it off?'],
      ['In my opinion...', 'I think the problem is...', 'To be fair, phones also help us...']],
    [2, 'story', 'Memories', 'Tell me about a day you will never forget.',
      ['How did you feel at the time?', 'Would you want to live that day again?'],
      ['It happened when I was...', 'The first thing I remember is...', 'Looking back, I realise...']],
    [2, 'question', 'Dreams', 'If you could live anywhere for a year, where would it be and why?',
      ['What would you do for work there?', 'Who would you take with you?'],
      ['If I could choose, I would...', 'What attracts me is...', 'The hardest part would be...']],
    [3, 'opinion', 'Change', 'What is something you have changed your mind about recently?',
      ['What made you change it?', 'Was it hard to admit?'],
      ['I used to think..., but now...', 'What changed my mind was...', 'I have come to see that...']],
    [3, 'question', 'Values', 'What does a good life look like to you?',
      ['What matters more: money, time or people?', 'Are you living that life now?'],
      ['For me, it is about...', 'I would not trade... for anything.', 'I am closer to it than I used to be.']],
    [3, 'game', 'Hypothetical', 'You get one extra free day every week. Plan how you would spend it.',
      ['Would you spend it alone or with people?', 'Would you ever get bored of it?'],
      ['First of all, I would...', 'Then, in the afternoon...', 'The best part would be...']],
  ],

  interview: [
    [1, 'question', 'Introduction', 'Introduce yourself in one minute.',
      ['What would you add if you had one more minute?', 'What do you want people to remember about you?'],
      ['My name is... and I work as...', 'I have experience in...', 'What I enjoy most is...']],
    [1, 'question', 'Strengths', 'What is your biggest strength?',
      ['Can you give me an example?', 'How do your colleagues describe you?'],
      ['I would say my strength is...', 'For example, last year I...', 'People often tell me that I am...']],
    [1, 'question', 'Motivation', 'Why do you want this kind of job?',
      ['What attracted you to it first?', 'What would a perfect first month look like?'],
      ['What excites me is...', 'I have always been interested in...', 'I see this as a chance to...']],
    [2, 'question', 'Experience', 'Describe your last job, or your studies, in simple words.',
      ['What did you enjoy most?', 'What would you change about it?'],
      ['My main responsibility was...', 'I worked with a team of...', 'One thing I achieved was...']],
    [2, 'question', 'Future', 'Where do you see yourself in five years?',
      ['What will you need to learn to get there?', 'What if the plan does not work?'],
      ['In five years I hope to be...', 'To get there, I plan to...', 'My long-term goal is...']],
    [2, 'story', 'Teamwork', 'Tell me about a time you worked well in a team.',
      ['What was your role?', 'What did you learn from the others?'],
      ['The goal of the team was...', 'My part was to...', 'In the end, we...']],
    [2, 'game', 'Role swap', 'Switch roles for two minutes: now you interview your partner.',
      ['Ask one question about their strengths.', 'Ask one question about a mistake they learned from.'],
      ['Could you tell me about...?', 'What was the hardest part of...?', 'How did you handle...?']],
    [3, 'story', 'Problem solving', 'Tell me about a time you solved a hard problem.',
      ['What options did you consider?', 'What would you do differently now?'],
      ['The situation was...', 'The challenge was that...', 'What I decided to do was...']],
    [3, 'story', 'Conflict', 'Describe a disagreement with a teammate and how you handled it.',
      ['Did the relationship change afterwards?', 'What did you learn about yourself?'],
      ['We saw it differently because...', 'I tried to understand their side by...', 'We agreed to...']],
    [3, 'opinion', 'Weakness', 'What is your biggest weakness, and what are you doing about it?',
      ['How do you know it is improving?', 'Has it ever cost you something?'],
      ['One thing I am still working on is...', 'To improve, I have started...', 'It used to be worse, but now...']],
    [3, 'question', 'Fit', 'Why should we hire you instead of another candidate?',
      ['What makes you different?', 'What would you bring in your first week?'],
      ['What sets me apart is...', 'I can add value by...', 'I am confident that I can...']],
    [3, 'story', 'Failure', 'Tell me about a time you failed and what you learned.',
      ['How did you tell your manager?', 'Would you take the same risk again?'],
      ['Things did not go as planned when...', 'Looking back, I should have...', 'Since then, I always...']],
  ],

  work: [
    [1, 'question', 'Your job', 'What do you do for work?',
      ['What does a normal day look like?', 'How did you get into it?'],
      ['I work as a...', 'My job involves...', 'I have been doing this for...']],
    [1, 'question', 'Daily routine', 'Describe a normal day at work.',
      ['Which part of the day is the busiest?', 'What do you do at lunch?'],
      ['I usually start by...', 'In the morning I...', 'The busiest time is...']],
    [1, 'question', 'Commute', 'How do you get to work, and how long does it take?',
      ['What do you do on the way?', 'Would you prefer to work from home?'],
      ['It takes me about...', 'I usually go by...', 'The best thing about it is...']],
    [2, 'question', 'Likes', 'What do you like most about your job?',
      ['What would you change?', 'What part would you never miss?'],
      ['What I enjoy most is...', 'I like it when...', 'It gives me the chance to...']],
    [2, 'opinion', 'Remote work', 'What would make working from home better for you?',
      ['Do you work better alone or with others?', 'How do you separate work and rest?'],
      ['I am more productive when...', 'One challenge is...', 'It helps me to...']],
    [2, 'game', 'Explain it', 'Explain your job to someone who has never heard of it.',
      ['Use one example of a typical task.', 'Which word would be hardest to explain?'],
      ['Basically, I...', 'You can think of it as...', 'For example, if a customer...']],
    [3, 'question', 'Deadlines', 'How do you handle a deadline you cannot meet?',
      ['When do you tell your manager?', 'Has it ever happened to you?'],
      ['The first thing I would do is...', 'I would explain that...', 'To avoid this in future, I...']],
    [3, 'game', 'Pitch', 'Pitch a new idea to your team in 60 seconds.',
      ['What is the biggest risk?', 'Who would you ask for help?'],
      ['I would like to suggest...', 'The main benefit is...', 'To get started, we would need...']],
    [3, 'question', 'Feedback', 'How would you give difficult feedback to a colleague?',
      ['How do you want to receive feedback yourself?', 'When is it better to wait?'],
      ['I would start by saying...', 'One thing that could be better is...', 'I would offer to help by...']],
    [3, 'opinion', 'Careers', 'Is it better to stay in one company or to change jobs often?',
      ['What would make you leave a good job?', 'What have you learned from moving on?'],
      ['The advantage of staying is...', 'On the other hand...', 'Personally, I believe...']],
    [3, 'story', 'Proud moment', 'Tell me about a project you are proud of.',
      ['What was the hardest part?', 'Who helped you the most?'],
      ['The project was about...', 'What made it difficult was...', 'The result was...']],
  ],

  travel: [
    [1, 'question', 'Next trip', 'Where would you like to travel next?',
      ['What would you do first when you arrive?', 'Who would you go with?'],
      ['I would love to go to...', 'I have always wanted to see...', 'The first thing I would do is...']],
    [1, 'question', 'Best place', 'What is the best place you have ever visited?',
      ['What did you eat there?', 'Would you go back?'],
      ['The best place I have been to is...', 'What I loved was...', 'I would definitely go again because...']],
    [1, 'game', 'Beach or mountains', 'Beach holiday or a mountain trip: which do you choose?',
      ['What is the perfect day there?', 'What do you pack?'],
      ['I would choose... because...', 'I enjoy...', 'It helps me to relax when...']],
    [1, 'question', 'Packing', 'What do you always pack in your bag?',
      ['What do you often forget?', 'What can you not travel without?'],
      ['I never leave without...', 'I always bring...', 'Once I forgot...']],
    [2, 'question', 'Hometown', 'Imagine I am visiting your city for three days. Plan the trip.',
      ['Where should I eat?', 'What should I avoid?'],
      ['On the first day, you should...', 'If you like..., you can...', 'Do not miss...']],
    [2, 'story', 'Trip gone wrong', 'Tell me about a trip that did not go as planned.',
      ['How did you solve it?', 'Is it funny to you now?'],
      ['Things went wrong when...', 'We had to...', 'Luckily...']],
    [2, 'question', 'Food abroad', 'How do you decide where to eat in a new place?',
      ['What is the strangest thing you have eaten?', 'Do you trust reviews?'],
      ['I usually ask...', 'I look for places where...', 'I am happy to try anything that...']],
    [2, 'opinion', 'Tourists', 'Is it better to travel with a plan or without one?',
      ['What is the best surprise you have had?', 'What would you always book in advance?'],
      ['I prefer to plan because...', 'Being spontaneous means...', 'The best trips are the ones where...']],
    [3, 'opinion', 'Learning', 'What can travelling teach you that school cannot?',
      ['What did you learn about yourself?', 'Which country changed your point of view?'],
      ['Travelling forces you to...', 'One thing I learned is...', 'It made me realise...']],
    [3, 'game', 'Time machine', 'You can visit any place in any year. Where and when do you go?',
      ['What would you want to see?', 'What would you bring back?'],
      ['I would travel to... in...', 'I am curious about...', 'The biggest difference would be...']],
    [3, 'opinion', 'Tourism', 'Does mass tourism do more harm than good to popular places?',
      ['What would you do about it?', 'Have you seen it yourself?'],
      ['On the positive side...', 'The downside is...', 'A fair solution might be...']],
  ],

  fun: [
    [1, 'question', 'Movies', 'What is your favourite movie or series, and why?',
      ['Who is your favourite character?', 'What would you recommend to me?'],
      ['I really like it because...', 'It is about...', 'You should watch it if you like...']],
    [1, 'game', 'Superpower', 'If you could have any superpower, which one would you choose?',
      ['How would you use it on a normal day?', 'What is the downside?'],
      ['I would choose... because...', 'The first thing I would do is...', 'The problem might be...']],
    [1, 'question', 'Music', 'What song do you listen to the most right now?',
      ['What does it make you feel?', 'What song reminds you of your childhood?'],
      ['I listen to it when...', 'It makes me feel...', 'It reminds me of...']],
    [1, 'question', 'Hobbies', 'What is a hobby you would like to try?',
      ['What stops you from starting?', 'Do you know anyone who does it?'],
      ['I have always wanted to try...', 'It looks like fun because...', 'If I started, I would...']],
    [2, 'game', 'Would you rather', 'Would you rather lose your phone or your wallet for a year? Why?',
      ['What would be the hardest part?', 'What would you do on the first day?'],
      ['I would rather... because...', 'I could live without...', 'It would be a disaster if...']],
    [2, 'game', 'Invent', 'Invent a new holiday and explain how people celebrate it.',
      ['What food would everyone eat?', 'What would the date be?'],
      ['It is celebrated on...', 'People usually...', 'The tradition started when...']],
    [2, 'game', 'Two truths', 'Tell me three things about you. Two are true and one is a lie.',
      ['Ask three questions to find the lie.', 'Which one surprised you most?'],
      ['The first thing is...', 'I am not sure I believe...', 'Can you tell me more about...?']],
    [2, 'opinion', 'Guilty pleasures', 'What is something you enjoy but are a little embarrassed about?',
      ['Who knows about it?', 'Why do you think it makes you happy?'],
      ['I know it sounds silly, but...', 'I cannot help it, I love...', 'It is my way of...']],
    [3, 'question', 'Fiction', 'Which fictional world would you want to live in?',
      ['What job would you have there?', 'What would you miss from the real world?'],
      ['I would love to live in... because...', 'I would be good at being a...', 'The only problem is...']],
    [3, 'game', 'Perfect day', 'Describe your perfect day with no limits on time or money.',
      ['Who would be there with you?', 'What would you skip?'],
      ['I would wake up in...', 'Then we would...', 'To end the day, I would...']],
    [3, 'opinion', 'Talent', 'What is the most useless thing you are good at?',
      ['Could it ever become useful?', 'How did you learn it?'],
      ['I can... and I am quite proud of it.', 'It started when...', 'Nobody asks me to do it, but...']],
  ],

  wild: [
    [1, 'game', 'Teach me', 'Teach me three useful words or phrases from your first language.',
      ['Now I will try to say them. Correct me!', 'Which one is hardest to pronounce?'],
      ['In my language, we say...', 'It means...', 'You use it when...']],
    [1, 'question', 'Today', 'What is one good thing that happened this week?',
      ['Who did you tell about it first?', 'What are you looking forward to?'],
      ['This week I...', 'It made me feel...', 'Next week I hope to...']],
    [1, 'game', 'Describe it', 'Describe the room you are in without saying the name of any object.',
      ['Can your partner guess what it is?', 'Which object is the hardest?'],
      ['You use it to...', 'It is made of...', 'It is usually found in...']],
    [2, 'question', 'Learning English', 'How are you learning English, and what helps you most?',
      ['What mistake do you make again and again?', 'What was your best learning moment?'],
      ['What works for me is...', 'I find it difficult to...', 'I improved when I started to...']],
    [2, 'story', 'First time', 'Tell me about the first time you did something scary.',
      ['Would you do it again?', 'What did you learn about yourself?'],
      ['I was nervous because...', 'In the end...', 'Now I feel...']],
    [2, 'game', 'Recommend', 'Recommend one thing for me to try this month: a place, a food or a show.',
      ['Why is it special for you?', 'How should I start?'],
      ['I would recommend...', 'You will love it because...', 'The best way to start is...']],
    [2, 'opinion', 'Advice', 'What is the best advice you have ever received?',
      ['Who gave it to you?', 'Did you follow it?'],
      ['Someone once told me that...', 'At first I did not understand...', 'It changed how I...']],
    [3, 'opinion', 'Big question', 'Will AI make learning languages less important? Why or why not?',
      ['What cannot a machine do for you?', 'How would it change your plans?'],
      ['I believe that...', 'Even if..., people will still...', 'The risk is that...']],
    [3, 'game', 'Debate', 'Choose a side: cities are better than villages. I will argue the opposite.',
      ['Give your strongest reason first.', 'Answer one point from your partner.'],
      ['The main reason is...', 'I see your point, but...', 'Let me give you an example...']],
    [3, 'story', 'Turning point', 'Tell me about a moment that changed your direction in life.',
      ['What would have happened otherwise?', 'Who was part of that moment?'],
      ['Everything changed when...', 'At the time I did not realise...', 'If it had not happened, I would...']],
  ],
};

const slug = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/** Every card, with a stable id (so both people can refer to the same card) */
export const CARD_POOL: ConversationCard[] = (
  Object.entries(POOL_SEEDS) as Array<[Goal | 'wild', Seed[]]>
).flatMap(([goal, seeds]) =>
  seeds.map(([depth, kind, topic, question, followUps, phrases], index) => ({
    id: `${goal}-${String(index + 1).padStart(2, '0')}-${slug(topic)}`,
    goal,
    depth,
    kind,
    topic,
    question,
    followUps,
    phrases,
  })),
);

const CARDS_BY_ID = new Map(CARD_POOL.map((card) => [card.id, card]));

export const getCard = (id: unknown): ConversationCard | undefined =>
  typeof id === 'string' ? CARDS_BY_ID.get(id) : undefined;

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

/** The hardest depth a level should be handed by the random generator */
const maxDepthFor = (level: Level): CardDepth =>
  level === 'beginner' ? 2 : 3;

/**
 * The cards for one call. The same call id always gives the same order, so
 * the server never has to store the deck: both sides can be handed it, and a
 * reconnecting client gets it back unchanged. Eight cards fit the goal and two
 * "wild" cards are mixed in for variety.
 */
export function buildDeck(callId: string, goal: Goal, level: Level): ConversationCard[] {
  const random = mulberry32(hash(`${callId}:${goal}`));
  const own = CARD_POOL.filter((card) => card.goal === goal);
  const byDepth = (depth: CardDepth) => shuffle(own.filter((c) => c.depth === depth), random);

  const ordered =
    level === 'beginner'
      ? [...byDepth(1), ...byDepth(2), ...byDepth(3)]
      : level === 'advanced'
        ? [...byDepth(3), ...byDepth(2), ...byDepth(1)]
        : [...shuffle([...byDepth(1), ...byDepth(2)], random), ...byDepth(3)];

  const wildCap = maxDepthFor(level);
  const wild = shuffle(
    CARD_POOL.filter((card) => card.goal === 'wild' && card.depth <= wildCap),
    random,
  ).slice(0, 2);

  const main = ordered.slice(0, CARD_COUNT - wild.length);
  // wild cards sit at positions 4 and 8 so the deck never feels repetitive
  const deck: ConversationCard[] = [];
  let wildIndex = 0;
  for (const card of main) {
    if ((deck.length === 3 || deck.length === 7) && wildIndex < wild.length) {
      deck.push(wild[wildIndex++]);
    }
    deck.push(card);
  }
  while (wildIndex < wild.length) deck.push(wild[wildIndex++]);
  return deck.slice(0, CARD_COUNT);
}

/**
 * The "surprise me" button: a random card the call has not used yet, matching
 * the chosen kind and leaning toward the call's goal. When everything has
 * been used, the pool starts over.
 */
export function drawCard(options: {
  goal: Goal;
  level: Level;
  kind?: CardKind;
  excludeIds?: string[];
  random?: () => number;
}): ConversationCard {
  const random = options.random ?? Math.random;
  const exclude = new Set(options.excludeIds ?? []);
  const maxDepth = maxDepthFor(options.level);
  const matches = (card: ConversationCard) =>
    (!options.kind || card.kind === options.kind) && card.depth <= maxDepth;

  const fresh = CARD_POOL.filter((card) => matches(card) && !exclude.has(card.id));
  const preferred = fresh.filter((card) => card.goal === options.goal || card.goal === 'wild');
  // mostly cards for this call's goal, but anything is fine if none are left
  const candidates = preferred.length > 0 ? preferred : fresh;
  const pool = candidates.length > 0 ? candidates : CARD_POOL.filter(matches);
  const safePool = pool.length > 0 ? pool : CARD_POOL;
  return safePool[Math.floor(random() * safePool.length)];
}
