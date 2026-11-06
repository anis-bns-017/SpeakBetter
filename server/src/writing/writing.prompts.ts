/**
 * Writing tasks for each level: real things people write (messages, emails, reviews, opinions), with a length
 * to aim for, tips and phrases to borrow. One is picked as today's task for each level; the rest stay open.
 */

export const WRITING_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type WritingLevel = (typeof WRITING_LEVELS)[number];
export type WritingKind = 'message' | 'email' | 'story' | 'opinion' | 'description' | 'review';

export interface WritingPrompt {
  id: string;
  level: WritingLevel;
  kind: WritingKind;
  title: string;
  task: string;
  tips: string[];
  phrases: string[];
  minWords: number;
  maxWords: number;
}

const w = (
  level: WritingLevel,
  n: number,
  kind: WritingKind,
  title: string,
  task: string,
  tips: string[],
  phrases: string[],
  [minWords, maxWords]: [number, number],
): WritingPrompt => ({ id: `${level.toLowerCase()}-${n}`, level, kind, title, task, tips, phrases, minWords, maxWords });

export const WRITING_PROMPTS: WritingPrompt[] = [
  // ---------- A1 ----------
  w('A1', 1, 'description', 'About me', 'Write about yourself: your name, where you live, your family and what you like.', ['Use short sentences.', 'Start each sentence with a capital letter.'], ['My name is …', 'I live in …', 'I have …', 'I like … because …'], [40, 80]),
  w('A1', 2, 'message', 'A message to a friend', 'Write a message to a friend. Invite them to your home on Saturday. Say what time and what you will do.', ['Say hello first.', 'Give the day and the time.'], ['Hi …!', 'Do you want to come to …?', 'We can …', 'See you soon!'], [30, 70]),
  w('A1', 3, 'description', 'My daily routine', 'Describe a normal day for you, from the morning to the evening.', ['Use the present simple: I get up, she works.', 'Use time words: first, then, after that.'], ['I get up at …', 'Then I …', 'In the afternoon …', 'In the evening I …'], [40, 90]),
  w('A1', 4, 'description', 'My favourite place', 'Write about your favourite place in your town. Where is it and why do you like it?', ['Use "there is" and "there are".', 'Say how it makes you feel.'], ['My favourite place is …', 'It is near …', 'There is a …', 'I go there with …'], [40, 80]),
  w('A1', 5, 'message', 'Sorry, I am late', 'Write a short message to your teacher. Say you will be late for class and why.', ['Say sorry.', 'Give a reason and a new time.'], ['Dear …,', 'I am sorry, but …', 'I will be there at …', 'Thank you.'], [25, 60]),
  w('A1', 6, 'description', 'My weekend', 'Write about what you usually do at the weekend.', ['Use "usually", "sometimes", "never".', 'Join ideas with "and" and "but".'], ['At the weekend I usually …', 'On Sunday …', 'Sometimes I …', 'I never …'], [40, 80]),

  // ---------- A2 ----------
  w('A2', 1, 'story', 'A great holiday', 'Write about a holiday you enjoyed. Where did you go, what did you do and why was it great?', ['Use the past simple: went, saw, ate.', 'Add one funny or surprising moment.'], ['Last year I went to …', 'We stayed in …', 'The best part was …', 'I will never forget …'], [70, 120]),
  w('A2', 2, 'email', 'Booking a table', 'Write an email to a restaurant to book a table for a birthday dinner. Ask one question.', ['Give the date, time and number of people.', 'End politely.'], ['I would like to book a table for …', 'Could you tell me if …?', 'It is my friend\'s birthday, so …', 'Best wishes,'], [60, 100]),
  w('A2', 3, 'review', 'A film I watched', 'Write a short review of a film or series you watched recently. Would you recommend it?', ['Say what it is about without giving the ending away.', 'Give your opinion with a reason.'], ['I recently watched …', 'It is about …', 'My favourite character was …', 'I would recommend it because …'], [70, 120]),
  w('A2', 4, 'message', 'Can you help me?', 'Write a message to a neighbour asking them to look after your plants while you are away.', ['Explain why you need help.', 'Say thank you and offer something back.'], ['I am going away for …', 'Could you water my plants …?', 'The key is …', 'Thank you so much!'], [50, 90]),
  w('A2', 5, 'story', 'A bad day', 'Write about a day when everything went wrong. What happened, and how did the day end?', ['Use "first", "then", "in the end".', 'Use was/were for feelings: I was tired.'], ['It started when …', 'Then …', 'To make things worse, …', 'In the end …'], [70, 120]),
  w('A2', 6, 'description', 'Someone I admire', 'Describe a person you admire. Who are they and what makes them special?', ['Describe both how they look and what they are like.', 'Give an example of something they did.'], ['I really admire …', 'He/She is very …', 'For example, …', 'I want to be like …'], [70, 120]),

  // ---------- B1 ----------
  w('B1', 1, 'email', 'A problem with an order', 'You bought something online and it arrived broken. Write an email to the shop explaining the problem and what you want them to do.', ['Explain the problem clearly and calmly.', 'Say exactly what you want: a refund or a new one.'], ['I am writing about my order …', 'Unfortunately, when it arrived …', 'I would be grateful if you could …', 'I look forward to hearing from you.'], [100, 160]),
  w('B1', 2, 'opinion', 'Working from home', 'Is working from home better than working in an office? Give your opinion with reasons and examples.', ['Give at least two reasons.', 'Mention the other side, then say why you still disagree.'], ['In my opinion, …', 'One reason is that …', 'On the other hand, …', 'All things considered, …'], [120, 180]),
  w('B1', 3, 'story', 'An unexpected meeting', 'Write a story that starts: "I was waiting for the bus when someone said my name."', ['Use the past continuous for the background: I was waiting.', 'Use direct speech to bring people to life.'], ['I turned around and …', 'At first I didn\'t recognise …', '"…," she said.', 'I couldn\'t believe that …'], [120, 180]),
  w('B1', 4, 'review', 'A place to eat', 'Write a review of a café or restaurant for other visitors. Talk about the food, the service and the price.', ['Use adjectives: cosy, crowded, delicious, overpriced.', 'Finish with a clear recommendation.'], ['If you are looking for …', 'The food was …', 'The staff were …', 'Overall, I would give it …'], [100, 160]),
  w('B1', 5, 'message', 'Advice for a friend', 'Your friend is nervous about starting a new job next week. Write them a message with some advice.', ['Use should, could and why don\'t you … ?', 'Be warm and encouraging.'], ['Don\'t worry, …', 'You should …', 'Why don\'t you …?', 'I\'m sure you will …'], [90, 140]),
  w('B1', 6, 'description', 'A tradition I love', 'Describe a festival or tradition from your country. What do people do and what does it mean to you?', ['Use the passive for customs: food is cooked, houses are decorated.', 'Add a personal memory.'], ['Every year, …', 'People usually …', 'It is traditionally …', 'For me, it means …'], [110, 170]),

  // ---------- B2 ----------
  w('B2', 1, 'opinion', 'Social media and young people', 'Do the benefits of social media for teenagers outweigh the risks? Write a balanced essay with your conclusion.', ['Give one paragraph to each side.', 'Use linking words: whereas, nevertheless, as a result.'], ['It is often argued that …', 'Nevertheless, …', 'A further concern is …', 'On balance, I believe …'], [180, 260]),
  w('B2', 2, 'email', 'Applying for a job', 'Write a cover email applying for a job you would like. Explain why you are a good fit.', ['Match your experience to what the job needs.', 'Keep it confident but not boastful.'], ['I am writing to apply for …', 'In my current role, I …', 'I am particularly drawn to …', 'I would welcome the opportunity to …'], [150, 220]),
  w('B2', 3, 'story', 'The decision', 'Write a story about a character who has to make a difficult choice, and what happens because of it.', ['Show feelings through actions, not only words.', 'Use past perfect for earlier events: she had promised.'], ['For weeks, she had …', 'Part of him wanted to …', 'Without thinking, …', 'Looking back, …'], [180, 260]),
  w('B2', 4, 'review', 'A book that changed my mind', 'Review a book (or long article) that changed how you think about something.', ['Summarise the main idea briefly.', 'Explain what changed in your thinking and why.'], ['The central argument is that …', 'What struck me most was …', 'I used to think …, but …', 'I would recommend it to anyone who …'], [160, 240]),
  w('B2', 5, 'opinion', 'Cities without cars', 'Should city centres ban private cars? Argue your view and suggest how it could work.', ['Support claims with examples or numbers.', 'Address the strongest argument against you.'], ['There is growing evidence that …', 'Critics point out that …', 'This could be addressed by …', 'Ultimately, …'], [180, 260]),
  w('B2', 6, 'email', 'A complaint to the council', 'Write to your local council about a problem in your area (noise, rubbish, transport) and propose a solution.', ['Describe the effect on people\'s lives.', 'Make one practical, specific proposal.'], ['I am writing to draw your attention to …', 'This has led to …', 'I would like to propose …', 'I trust that you will …'], [160, 230]),

  // ---------- C1 ----------
  w('C1', 1, 'opinion', 'Is success mostly luck?', 'To what extent is success the result of luck rather than effort? Write a well-argued essay.', ['Define what you mean by success.', 'Use hedging: arguably, to some extent, it could be said.'], ['It would be naive to suggest that …', 'Arguably, …', 'This is not to say that …', 'Taken together, …'], [250, 350]),
  w('C1', 2, 'email', 'Proposing a change at work', 'Write a proposal email to your manager suggesting a change to how your team works, with its costs and benefits.', ['Lead with the benefit to the team.', 'Anticipate objections and answer them.'], ['I would like to propose …', 'The main advantage would be …', 'One possible concern is …, which could be mitigated by …', 'I would be happy to discuss …'], [220, 320]),
  w('C1', 3, 'story', 'Two versions', 'Tell the same short event twice, from two people who remember it very differently.', ['Give each narrator a distinct voice.', 'Let the reader notice what each one leaves out.'], ['As she remembers it, …', 'In his version, however, …', 'What neither of them mentions is …'], [250, 350]),
  w('C1', 4, 'review', 'A product that promised too much', 'Write a critical review of a product, app or service that did not live up to its promises.', ['Balance criticism with what it does well.', 'Use precise vocabulary: underwhelming, intuitive, clunky.'], ['On paper, …', 'In practice, however, …', 'To its credit, …', 'Unless … , I would hesitate to recommend it.'], [220, 320]),
  w('C1', 5, 'opinion', 'Should languages be learned with AI?', 'Discuss whether AI tools will make human language teachers less important. Reach a nuanced conclusion.', ['Separate what AI does well from what people do well.', 'Use concessive structures: while, although, even if.'], ['While AI tools excel at …, they …', 'Even if …, it is unlikely that …', 'A more realistic view is that …'], [250, 350]),
  w('C1', 6, 'description', 'A place that has changed', 'Describe a place you know that has changed a lot, and reflect on what was gained and lost.', ['Contrast past and present with used to and would.', 'End with a reflection, not just a description.'], ['Where there used to be …, there is now …', 'People would …', 'Something has undoubtedly been lost: …', 'Perhaps …'], [220, 320]),
];

export const PROMPT_BY_ID = new Map(WRITING_PROMPTS.map((p) => [p.id, p]));

/** Free writing: no task, any length, any topic */
export const FREE_PROMPT_ID = 'free';

export const isWritingLevel = (value: unknown): value is WritingLevel =>
  typeof value === 'string' && (WRITING_LEVELS as readonly string[]).includes(value);

/** Today's task for a level: the same for everyone at that level, a different one each day */
export function todaysPrompt(level: WritingLevel, day: Date): WritingPrompt {
  const list = WRITING_PROMPTS.filter((p) => p.level === level);
  const dayNumber = Math.floor(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() / 86_400_000);
  return list[(dayNumber + WRITING_LEVELS.indexOf(level) * 2) % list.length];
}
