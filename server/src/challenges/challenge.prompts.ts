/**
 * The daily speaking challenge: one prompt a day for each level, the same for everyone at that level, so
 * people can listen to each other's answers. Each prompt has phrases to help, and topic words used to tell
 * whether an answer stayed on topic.
 */

import { analyzeSpeaking } from '../placement/placement.engine';

export const CHALLENGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type ChallengeLevel = (typeof CHALLENGE_LEVELS)[number];

export interface ChallengePrompt {
  id: string;
  level: ChallengeLevel;
  title: string;
  prompt: string;
  /** Phrases that help you start and keep going */
  phrases: string[];
  /** Words an on-topic answer is likely to use (lowercase stems) */
  keywords: string[];
  /** Suggested length */
  seconds: number;
}

const p = (level: ChallengeLevel, n: number, title: string, prompt: string, phrases: string[], keywords: string[], seconds = 60): ChallengePrompt => ({
  id: `${level.toLowerCase()}-${n}`,
  level,
  title,
  prompt,
  phrases,
  keywords,
  seconds,
});

export const CHALLENGE_PROMPTS: ChallengePrompt[] = [
  p('A1', 1, 'My family', 'Tell us about your family. Who are they and what do they like?', ['There are … people in my family.', 'My … likes …', 'We often …'], ['family', 'mother', 'father', 'brother', 'sister', 'parent', 'like'], 45),
  p('A1', 2, 'My day', 'What do you do on a normal day, from morning to night?', ['In the morning, I …', 'After that, I …', 'In the evening, I …'], ['morning', 'breakfast', 'work', 'school', 'evening', 'night', 'sleep'], 45),
  p('A1', 3, 'My home', 'Describe your home. What is your favourite room?', ['I live in a …', 'My favourite room is … because …', 'There is a …'], ['home', 'house', 'room', 'kitchen', 'bedroom', 'live', 'favourite'], 45),
  p('A1', 4, 'Food I love', 'What is your favourite food? When do you eat it?', ['My favourite food is …', 'I eat it when …', 'It tastes …'], ['food', 'eat', 'favourite', 'cook', 'taste', 'rice', 'delicious'], 45),
  p('A1', 5, 'My town', 'Tell us about the town or city where you live.', ['I live in …', 'It is a … place.', 'You can …'], ['city', 'town', 'live', 'people', 'place', 'street', 'big', 'small'], 45),
  p('A1', 6, 'Weekend', 'What do you like to do at the weekend?', ['At the weekend, I usually …', 'I like to … with …', 'Sometimes I …'], ['weekend', 'saturday', 'sunday', 'friend', 'play', 'watch', 'like'], 45),
  p('A1', 7, 'My best friend', 'Describe your best friend. What do you do together?', ['My best friend is …', 'He/She is very …', 'We like to …'], ['friend', 'together', 'kind', 'funny', 'meet', 'like'], 45),
  p('A1', 8, 'Weather', 'What is the weather like where you live today?', ['Today it is …', 'In summer, it …', 'I like … weather because …'], ['weather', 'sunny', 'rain', 'hot', 'cold', 'today', 'summer', 'winter'], 45),

  p('A2', 1, 'A trip I enjoyed', 'Tell us about a trip you enjoyed. Where did you go and what did you do?', ['Last year I went to …', 'We stayed …', 'The best part was …'], ['trip', 'went', 'visit', 'travel', 'stay', 'enjoy', 'holiday'], 60),
  p('A2', 2, 'My job or studies', 'What do you do: work or study? What do you like about it?', ['I work as … / I study …', 'Every day I …', 'What I like most is …'], ['work', 'job', 'study', 'school', 'university', 'like', 'every'], 60),
  p('A2', 3, 'A special day', 'Describe a special day you remember, like a birthday or a festival.', ['I remember when …', 'On that day, we …', 'It was special because …'], ['day', 'birthday', 'festival', 'remember', 'celebrate', 'special', 'family'], 60),
  p('A2', 4, 'Shopping', 'Do you like shopping? Where do you usually go and what do you buy?', ['I usually shop at …', 'I often buy …', 'I prefer … because …'], ['shop', 'buy', 'market', 'store', 'online', 'price', 'clothes'], 60),
  p('A2', 5, 'Learning English', 'Why are you learning English? How do you practise?', ['I am learning English because …', 'I practise by …', 'The hardest part is …'], ['english', 'learn', 'practise', 'practice', 'speak', 'because', 'improve'], 60),
  p('A2', 6, 'A good film or show', 'Tell us about a film or TV show you liked. What was it about?', ['I recently watched …', 'It is about …', 'I liked it because …'], ['film', 'movie', 'show', 'watch', 'story', 'character', 'liked'], 60),
  p('A2', 7, 'Healthy habits', 'What do you do to stay healthy?', ['To stay healthy, I …', 'I try not to …', 'I would like to start …'], ['healthy', 'exercise', 'sleep', 'food', 'walk', 'water', 'sport'], 60),
  p('A2', 8, 'Your phone', 'How do you use your phone every day? Could you live without it?', ['I use my phone to …', 'Every day I …', 'Without my phone, I would …'], ['phone', 'app', 'message', 'call', 'use', 'internet', 'without'], 60),

  p('B1', 1, 'Advice for a visitor', 'A friend is visiting your country for the first time. What advice would you give them?', ['If I were you, I would …', 'Make sure you …', "Don't forget to …"], ['visit', 'country', 'should', 'advice', 'food', 'place', 'people'], 75),
  p('B1', 2, 'A challenge you overcame', 'Talk about something difficult you did. How did you manage it?', ['It was hard because …', 'At first, I …, but then …', 'I learned that …'], ['difficult', 'hard', 'challenge', 'manage', 'learn', 'finally', 'problem'], 75),
  p('B1', 3, 'Working from home', 'Is working or studying from home a good idea? Give reasons.', ['On the one hand, …', 'On the other hand, …', 'Personally, I think …'], ['home', 'work', 'office', 'advantage', 'disadvantage', 'think', 'because'], 75),
  p('B1', 4, 'A person you admire', 'Describe someone you admire and explain why.', ['The person I admire most is …', 'What impresses me is …', 'They taught me …'], ['admire', 'person', 'because', 'respect', 'inspire', 'taught', 'help'], 75),
  p('B1', 5, 'Changes in your town', 'How has your town changed in the last ten years? Is it better now?', ['Ten years ago, …', 'Nowadays, …', 'In my opinion, it is …'], ['change', 'town', 'city', 'years', 'now', 'better', 'worse', 'build'], 75),
  p('B1', 6, 'Your dream holiday', 'If you could go anywhere, where would you go and why?', ['If I could go anywhere, I would …', "I've always wanted to …", 'I would spend my time …'], ['would', 'travel', 'holiday', 'dream', 'country', 'visit', 'because'], 75),
  p('B1', 7, 'Social media', 'Does social media make our lives better or worse?', ['I believe that …', 'For example, …', 'However, …'], ['social', 'media', 'people', 'online', 'better', 'worse', 'friend', 'time'], 75),
  p('B1', 8, 'A skill to learn', 'What new skill would you like to learn, and how would you start?', ["I'd love to learn …", 'First, I would …', 'It would help me …'], ['skill', 'learn', 'start', 'practice', 'would', 'improve', 'help'], 75),

  p('B2', 1, 'Cities or countryside', 'Is it better to grow up in a big city or in the countryside? Argue your point.', ['There are strong arguments for …', 'One major advantage is …', 'All things considered, …'], ['city', 'countryside', 'grow', 'children', 'advantage', 'opportunity', 'nature'], 90),
  p('B2', 2, 'Technology and jobs', 'Will technology create more jobs than it destroys? What do you think?', ['It is often argued that …', 'Looking at history, …', 'In the long run, …'], ['technology', 'job', 'work', 'automation', 'future', 'create', 'skill'], 90),
  p('B2', 3, 'A decision that shaped you', 'Describe a decision that changed the direction of your life.', ['Looking back, …', 'At the time, I had to choose between …', 'If I had …, I would have …'], ['decision', 'choose', 'change', 'life', 'would', 'regret', 'future'], 90),
  p('B2', 4, 'Should school be free?', 'Should university education be free for everyone? Discuss.', ['A strong case can be made that …', 'Critics point out that …', 'On balance, I believe …'], ['university', 'education', 'free', 'pay', 'student', 'government', 'tax'], 90),
  p('B2', 5, 'Fame', 'Would you like to be famous? What are the pros and cons?', ['The appeal of fame is …', 'On the downside, …', 'Personally, I would rather …'], ['famous', 'fame', 'privacy', 'money', 'attention', 'pressure', 'rather'], 90),
  p('B2', 6, 'Climate and daily life', 'What can ordinary people do about climate change? Does it make a difference?', ['Small changes such as …', 'It could be argued that …', 'What matters most is …'], ['climate', 'environment', 'energy', 'plastic', 'change', 'government', 'difference'], 90),
  p('B2', 7, 'Learning from failure', 'Is failure necessary for success? Use an example.', ['A good example of this is …', 'What failure teaches us is …', 'Without it, …'], ['failure', 'fail', 'success', 'learn', 'mistake', 'example', 'experience'], 90),
  p('B2', 8, 'The perfect job', 'What makes a job truly satisfying: money, purpose or people?', ['For me, the most important factor is …', 'While money matters, …', 'Ultimately, …'], ['job', 'money', 'purpose', 'colleague', 'satisfying', 'salary', 'meaning'], 90),

  p('C1', 1, 'Privacy online', 'Have we given up too much privacy for convenience online? Make your case.', ['It is worth considering whether …', 'The trade-off between … and … is …', 'Ultimately, the question is …'], ['privacy', 'data', 'online', 'convenience', 'company', 'trade', 'control'], 120),
  p('C1', 2, 'The value of history', 'Why should we study history? Is it still relevant today?', ['Those who forget the past …', 'History offers us …', 'Its relevance lies in …'], ['history', 'past', 'learn', 'relevant', 'society', 'mistake', 'understand'], 120),
  p('C1', 3, 'Work–life balance', 'Is the idea of work–life balance realistic in modern careers?', ['The notion of balance assumes …', 'In practice, …', 'A more realistic goal might be …'], ['balance', 'work', 'life', 'career', 'time', 'stress', 'realistic'], 120),
  p('C1', 4, 'Art and money', 'Should governments fund the arts, or should art survive on its own?', ['Public funding is often justified by …', 'Critics would counter that …', 'A sensible compromise would be …'], ['art', 'fund', 'government', 'culture', 'money', 'public', 'artist'], 120),
  p('C1', 5, 'Artificial intelligence', 'What is the greatest risk and the greatest promise of artificial intelligence?', ['The most compelling promise is …', 'By contrast, the gravest risk …', 'Striking the right balance requires …'], ['intelligence', 'risk', 'promise', 'human', 'future', 'technology', 'control'], 120),
  p('C1', 6, 'A book that changed you', 'Talk about a book or idea that changed how you see the world.', ['What struck me most was …', 'It made me reconsider …', 'Since then, I …'], ['book', 'idea', 'world', 'changed', 'author', 'read', 'perspective'], 120),
  p('C1', 7, 'Global English', 'English is a global language. Is that a good thing for the world?', ['On the one hand, a shared language …', 'Yet this comes at the cost of …', 'Weighing these up, …'], ['english', 'language', 'global', 'culture', 'communicate', 'local', 'world'], 120),
  p('C1', 8, 'Ambition', 'Is ambition a virtue or a vice? Explain with examples.', ['Ambition can drive …', 'Taken too far, however, …', 'The distinction lies in …'], ['ambition', 'success', 'goal', 'drive', 'virtue', 'greed', 'example'], 120),
];

export const PROMPT_BY_ID = new Map(CHALLENGE_PROMPTS.map((x) => [x.id, x]));

export const isChallengeLevel = (value: unknown): value is ChallengeLevel =>
  typeof value === 'string' && (CHALLENGE_LEVELS as readonly string[]).includes(value);

/** The prompt for a level on a given day: everyone at that level gets the same one */
export function promptFor(level: ChallengeLevel, day: Date): ChallengePrompt {
  const list = CHALLENGE_PROMPTS.filter((x) => x.level === level);
  const dayNumber = Math.floor(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 86_400_000);
  return list[(dayNumber + CHALLENGE_LEVELS.indexOf(level) * 3) % list.length];
}

export interface AnswerStats {
  words: number;
  seconds: number;
  wpm: number | null;
  fluency: number | null;
  fillersPer100: number;
  uniqueWords: number;
  richWords: string[];
  tooShort: boolean;
  /** Topic words the answer used, and how many the prompt has */
  topicWords: string[];
  onTopic: boolean | null;
  /** 0-100, built from fluency, length and staying on topic; null when too short to judge */
  score: number | null;
}

/** Scores an answer from its transcript and length */
export function scoreAnswer(prompt: ChallengePrompt, transcript: string, seconds: number): AnswerStats {
  const sample = analyzeSpeaking(transcript, seconds);
  const tokens = new Set(
    transcript
      .toLowerCase()
      .replace(/[^\p{L}\s']/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
  const topicWords = prompt.keywords.filter((k) => [...tokens].some((t) => t === k || t.startsWith(k)));
  const onTopic = sample.tooShort ? null : topicWords.length >= Math.min(2, prompt.keywords.length);

  let score: number | null = null;
  if (!sample.tooShort) {
    // Speaking for most of the suggested time counts in full
    const length = Math.min(1, seconds / (prompt.seconds * 0.75));
    const fluency = (sample.fluency ?? 60) / 100;
    const topic = onTopic ? 1 : 0.75;
    score = Math.round(Math.max(0, Math.min(100, 100 * (0.55 * fluency + 0.3 * length + 0.15) * topic)));
  }

  return {
    words: sample.words,
    seconds: Math.round(seconds),
    wpm: sample.wpm,
    fluency: sample.fluency,
    fillersPer100: sample.fillersPer100,
    uniqueWords: sample.uniqueWords,
    richWords: sample.richWords,
    tooShort: sample.tooShort,
    topicWords,
    onTopic,
    score,
  };
}
