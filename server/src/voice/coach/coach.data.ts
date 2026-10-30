// server/src/voice/coach/coach.data.ts
// Content for the room coach: secret-word missions and topic cards.

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export const CEFR_LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export interface MissionWord {
  /** Base form shown to the learner. Spaces make it a phrase ("break the ice") */
  word: string;
  level: CefrLevel;
  meaning: string;
  example: string;
  /** Extra spoken forms that count (irregular verbs, comparatives, ...) */
  forms?: string[];
}

/** Words that are easy to slip into a normal conversation, with a meaning and an example to learn from */
export const MISSION_WORDS: MissionWord[] = [
  // ---- A1 ----
  { word: 'favorite', level: 'A1', meaning: 'the one you like the most', example: 'Pizza is my favorite food.', forms: ['favourite', 'favorites', 'favourites'] },
  { word: 'usually', level: 'A1', meaning: 'most of the time', example: 'I usually wake up at seven.' },
  { word: 'because', level: 'A1', meaning: 'used to give a reason', example: 'I like it because it is fun.' },
  { word: 'weekend', level: 'A1', meaning: 'Saturday and Sunday', example: 'What do you do at the weekend?', forms: ['weekends'] },
  { word: 'sometimes', level: 'A1', meaning: 'not always, but not never', example: 'Sometimes I cook dinner for friends.' },
  { word: 'together', level: 'A1', meaning: 'with another person or people', example: 'We study English together.' },
  { word: 'beautiful', level: 'A1', meaning: 'very nice to look at', example: 'The park is beautiful in spring.' },
  { word: 'delicious', level: 'A1', meaning: 'tastes very good', example: 'This soup is delicious.' },

  // ---- A2 ----
  { word: 'actually', level: 'A2', meaning: 'used to say what is true or real', example: 'I thought it was hard, but it is actually easy.' },
  { word: 'especially', level: 'A2', meaning: 'more than others; in particular', example: 'I love fruit, especially mangoes.' },
  { word: 'decide', level: 'A2', meaning: 'to choose after thinking', example: 'I cannot decide what to eat.', forms: ['decided', 'deciding', 'decides'] },
  { word: 'enjoy', level: 'A2', meaning: 'to like doing something', example: 'I enjoy walking by the river.' },
  { word: 'whenever', level: 'A2', meaning: 'every time that', example: 'Call me whenever you need help.' },
  { word: 'probably', level: 'A2', meaning: 'very likely', example: 'It will probably rain tomorrow.' },
  { word: 'although', level: 'A2', meaning: 'used to show a contrast', example: 'Although it was late, we kept talking.' },
  { word: 'prefer', level: 'A2', meaning: 'to like one thing more than another', example: 'I prefer tea to coffee.', forms: ['preferred', 'preferring', 'prefers'] },
  { word: 'nervous', level: 'A2', meaning: 'a little afraid or worried', example: 'I felt nervous before my exam.' },
  { word: 'recently', level: 'A2', meaning: 'not long ago', example: 'I recently started a new hobby.' },
  { word: 'borrow', level: 'A2', meaning: 'to take something and give it back later', example: 'Can I borrow your pen?' },
  { word: 'exactly', level: 'A2', meaning: 'completely correct or precise', example: 'That is exactly what I meant.' },

  // ---- B1 ----
  { word: 'definitely', level: 'B1', meaning: 'without any doubt', example: 'I will definitely visit again.' },
  { word: 'manage', level: 'B1', meaning: 'to succeed in doing something difficult', example: 'I managed to finish on time.', forms: ['managed', 'managing', 'manages'] },
  { word: 'however', level: 'B1', meaning: 'used to introduce a contrast', example: 'It was cheap. However, it broke quickly.' },
  { word: 'convenient', level: 'B1', meaning: 'easy and useful for you', example: 'The bus stop is very convenient.' },
  { word: 'improve', level: 'B1', meaning: 'to get better or make something better', example: 'I want to improve my pronunciation.' },
  { word: 'opportunity', level: 'B1', meaning: 'a chance to do something good', example: 'It was a great opportunity to travel.', forms: ['opportunities'] },
  { word: 'realize', level: 'B1', meaning: 'to suddenly understand something', example: 'I realized I had forgotten my keys.', forms: ['realise', 'realised', 'realizing', 'realising'] },
  { word: 'embarrassing', level: 'B1', meaning: 'making you feel shy or ashamed', example: 'Falling on stage was so embarrassing.', forms: ['embarrassed', 'embarrass'] },
  { word: 'convince', level: 'B1', meaning: 'to make someone believe or agree', example: 'She convinced me to join the club.' },
  { word: 'worth it', level: 'B1', meaning: 'good enough to justify the effort or cost', example: 'The long trip was worth it.' },
  { word: 'unexpected', level: 'B1', meaning: 'not what you thought would happen', example: 'We got an unexpected phone call.', forms: ['unexpectedly'] },
  { word: 'experience', level: 'B1', meaning: 'something that happens to you; knowledge from doing', example: 'Living abroad was a great experience.' },

  // ---- B2 ----
  { word: 'reluctant', level: 'B2', meaning: 'not wanting to do something', example: 'He was reluctant to speak in public.', forms: ['reluctantly', 'reluctance'] },
  { word: 'considerable', level: 'B2', meaning: 'fairly large or important', example: 'It took a considerable amount of time.', forms: ['considerably'] },
  { word: 'overwhelmed', level: 'B2', meaning: 'feeling that there is too much to deal with', example: 'I felt overwhelmed by all the homework.', forms: ['overwhelming', 'overwhelm'] },
  { word: 'subtle', level: 'B2', meaning: 'small and not obvious', example: 'There is a subtle difference in meaning.', forms: ['subtly', 'subtlety'] },
  { word: 'inevitable', level: 'B2', meaning: 'certain to happen', example: 'Change is inevitable.', forms: ['inevitably'] },
  { word: 'perspective', level: 'B2', meaning: 'a particular way of thinking about something', example: 'Travel gave me a new perspective.', forms: ['perspectives'] },
  { word: 'ambitious', level: 'B2', meaning: 'having strong goals to succeed', example: 'She is young and ambitious.', forms: ['ambition', 'ambitions'] },
  { word: 'compromise', level: 'B2', meaning: 'an agreement where each side gives up something', example: 'We reached a compromise on the price.' },
  { word: 'thrive', level: 'B2', meaning: 'to grow and be successful or healthy', example: 'Plants thrive in this climate.', forms: ['thrived', 'thriving', 'thrives'] },
  { word: 'drawback', level: 'B2', meaning: 'a disadvantage', example: 'The only drawback is the price.', forms: ['drawbacks'] },
  { word: 'gradually', level: 'B2', meaning: 'slowly, step by step', example: 'My English gradually got better.', forms: ['gradual'] },
  { word: 'cope with', level: 'B2', meaning: 'to deal with something difficult', example: 'How do you cope with stress?', forms: ['coped with', 'coping with', 'copes with'] },

  // ---- C1 ----
  { word: 'ubiquitous', level: 'C1', meaning: 'seen or found everywhere', example: 'Smartphones are ubiquitous today.' },
  { word: 'meticulous', level: 'C1', meaning: 'very careful about every detail', example: 'He is meticulous about his notes.', forms: ['meticulously'] },
  { word: 'resilient', level: 'C1', meaning: 'able to recover quickly after problems', example: 'Children can be remarkably resilient.', forms: ['resilience'] },
  { word: 'nuance', level: 'C1', meaning: 'a very small difference in meaning or feeling', example: 'Tone adds nuance to what we say.', forms: ['nuances', 'nuanced'] },
  { word: 'unprecedented', level: 'C1', meaning: 'never having happened before', example: 'The city saw unprecedented growth.' },
  { word: 'scrutinize', level: 'C1', meaning: 'to examine very carefully', example: 'Experts scrutinized every detail.', forms: ['scrutinise', 'scrutiny', 'scrutinized', 'scrutinised'] },
  { word: 'pragmatic', level: 'C1', meaning: 'dealing with things in a practical way', example: 'We need a pragmatic solution.', forms: ['pragmatically'] },
  { word: 'mitigate', level: 'C1', meaning: 'to make something less serious', example: 'Trees mitigate the heat in cities.', forms: ['mitigated', 'mitigating', 'mitigation'] },
  { word: 'ambiguous', level: 'C1', meaning: 'having more than one possible meaning', example: 'The instructions were ambiguous.', forms: ['ambiguity'] },
  { word: 'outweigh', level: 'C1', meaning: 'to be more important than something else', example: 'The benefits outweigh the risks.', forms: ['outweighs', 'outweighed', 'outweighing'] },
  { word: 'in hindsight', level: 'C1', meaning: 'when you look back at something that happened', example: 'In hindsight, I should have asked for help.' },
  { word: 'for the sake of', level: 'C1', meaning: 'in order to help or achieve something', example: 'He stayed for the sake of his family.' },
];

export interface TopicCard {
  id: string;
  level: CefrLevel;
  category: 'daily-life' | 'opinion' | 'storytelling' | 'role-play' | 'fun';
  prompt: string;
  /** Follow-up questions to keep the answer going */
  followUps: string[];
  /** Useful words or phrases for the answer */
  vocab: string[];
}

/** Conversation prompts a host can push to the room, or aim at a quiet person ("spotlight") */
export const TOPIC_CARDS: TopicCard[] = [
  { id: 'a1-morning', level: 'A1', category: 'daily-life', prompt: 'Describe your morning. What do you do first?', followUps: ['What do you eat for breakfast?', 'How do you go to work or school?'], vocab: ['wake up', 'brush my teeth', 'usually'] },
  { id: 'a1-family', level: 'A1', category: 'daily-life', prompt: 'Tell us about one person in your family.', followUps: ['What does this person like to do?', 'How old are they?'], vocab: ['mother', 'brother', 'funny'] },
  { id: 'a1-food', level: 'A1', category: 'fun', prompt: 'What is your favorite food? Why do you like it?', followUps: ['Can you cook it?', 'Who do you eat it with?'], vocab: ['delicious', 'spicy', 'sweet'] },
  { id: 'a1-weekend', level: 'A1', category: 'daily-life', prompt: 'What do you do at the weekend?', followUps: ['Do you stay at home or go out?', 'Who do you meet?'], vocab: ['relax', 'friends', 'sometimes'] },
  { id: 'a2-trip', level: 'A2', category: 'storytelling', prompt: 'Tell us about a trip you remember. Where did you go?', followUps: ['Who did you go with?', 'What was the best part?'], vocab: ['we visited', 'it was amazing', 'by train'] },
  { id: 'a2-neighbourhood', level: 'A2', category: 'daily-life', prompt: 'Describe the place where you live. What do you like and dislike?', followUps: ['Is it quiet or busy?', 'Would you move somewhere else?'], vocab: ['crowded', 'near', 'convenient'] },
  { id: 'a2-hobby', level: 'A2', category: 'fun', prompt: 'What hobby would you like to try? Why?', followUps: ['What do you need to start?', 'Do you know anyone who does it?'], vocab: ['I would like to', 'learn', 'expensive'] },
  { id: 'a2-roleplay-cafe', level: 'A2', category: 'role-play', prompt: 'Role-play: one person is a waiter, one is a customer at a café. Order a drink and a snack.', followUps: ['Ask about the price.', 'Complain politely about something cold.'], vocab: ['Could I have', 'How much is', 'to take away'] },
  { id: 'a2-shopping', level: 'A2', category: 'daily-life', prompt: 'Do you like shopping? Where do you usually buy clothes?', followUps: ['Do you shop online?', 'What was the last thing you bought?'], vocab: ['cheap', 'try on', 'sale'] },
  { id: 'b1-learning', level: 'B1', category: 'opinion', prompt: 'What is the hardest part of learning English for you, and what helps?', followUps: ['What mistake do you make often?', 'What advice would you give a beginner?'], vocab: ['struggle with', 'improve', 'practice'] },
  { id: 'b1-embarrassing', level: 'B1', category: 'storytelling', prompt: 'Tell a short story about an embarrassing moment.', followUps: ['What did you do next?', 'Can you laugh about it now?'], vocab: ['I realized', 'out of nowhere', 'ever since'] },
  { id: 'b1-technology', level: 'B1', category: 'opinion', prompt: 'Is technology making our lives easier or more stressful?', followUps: ['Give a personal example.', 'What would you give up first?'], vocab: ['on the one hand', 'depend on', 'convenient'] },
  { id: 'b1-roleplay-interview', level: 'B1', category: 'role-play', prompt: 'Role-play: a job interview. One person interviews, the other answers "Tell me about yourself".', followUps: ['Ask about a strength and a weakness.', 'Ask why they want the job.'], vocab: ['I have experience in', 'I am good at', 'opportunity'] },
  { id: 'b1-childhood', level: 'B1', category: 'storytelling', prompt: 'What was your favorite thing to do as a child?', followUps: ['Do you still do it?', 'Who did you do it with?'], vocab: ['used to', 'grew up', 'memories'] },
  { id: 'b1-superpower', level: 'B1', category: 'fun', prompt: 'If you could have one superpower for a day, what would it be and what would you do?', followUps: ['Would you tell anyone?', 'What could go wrong?'], vocab: ['I would', 'if I could', 'incredible'] },
  { id: 'b2-remote', level: 'B2', category: 'opinion', prompt: 'Is working or studying from home better than going to an office or school? Defend your view.', followUps: ['What is the biggest drawback?', 'How would you convince a skeptic?'], vocab: ['flexibility', 'drawback', 'productive'] },
  { id: 'b2-change', level: 'B2', category: 'storytelling', prompt: 'Describe a decision that changed your life.', followUps: ['Were you reluctant at first?', 'Would you decide the same way today?'], vocab: ['turning point', 'in hindsight', 'looking back'] },
  { id: 'b2-future-city', level: 'B2', category: 'opinion', prompt: 'How will cities look in 50 years? What problems will they solve or create?', followUps: ['Would you want to live there?', 'Who will benefit the most?'], vocab: ['sustainable', 'inevitably', 'infrastructure'] },
  { id: 'b2-roleplay-complaint', level: 'B2', category: 'role-play', prompt: 'Role-play: return a faulty product to a shop. One person is the customer, the other is the manager.', followUps: ['The manager offers only a voucher.', 'The customer asks for a refund politely but firmly.'], vocab: ['I would like a refund', 'it stopped working', 'I understand, however'] },
  { id: 'b2-debate-social', level: 'B2', category: 'opinion', prompt: 'Should social media have an age limit? Take a side.', followUps: ['Answer the strongest counter-argument.', 'What rule would you propose?'], vocab: ['regulate', 'peer pressure', 'on balance'] },
  { id: 'b2-two-truths', level: 'B2', category: 'fun', prompt: 'Two truths and a lie: tell three things about yourself. Others guess the lie.', followUps: ['Defend your lie.', 'Ask the group follow-up questions.'], vocab: ['I swear', 'no way', 'that sounds fake because'] },
  { id: 'c1-ethics-ai', level: 'C1', category: 'opinion', prompt: 'Who should be responsible when an AI system makes a harmful decision?', followUps: ['Where do you draw the line?', 'How is this different from human error?'], vocab: ['accountability', 'liability', 'it is a grey area'] },
  { id: 'c1-culture', level: 'C1', category: 'opinion', prompt: 'Which part of your culture is most misunderstood abroad, and why?', followUps: ['How would you explain it in one minute?', 'What nuance do outsiders miss?'], vocab: ['stereotype', 'nuance', 'at face value'] },
  { id: 'c1-regret', level: 'C1', category: 'storytelling', prompt: 'Tell us about advice you ignored and what happened. What would you tell your younger self?', followUps: ['Was the advice actually wrong?', 'How did it shape you?'], vocab: ['with hindsight', 'I should have', 'in the long run'] },
  { id: 'c1-roleplay-negotiate', level: 'C1', category: 'role-play', prompt: 'Role-play: negotiate a salary or rent price. One side wants more, the other must stay within budget.', followUps: ['Find a compromise that works for both.', 'Use at least two persuasion phrases.'], vocab: ['meet you halfway', 'deal-breaker', 'given the circumstances'] },
  { id: 'c1-elevator', level: 'C1', category: 'fun', prompt: 'You have 60 seconds in an elevator to convince a stranger to try your favorite book, film or hobby. Go!', followUps: ['Answer one objection.', 'End with a memorable line.'], vocab: ['hooked', 'it is worth your time', 'trust me on this'] },
  { id: 'any-wyr', level: 'B1', category: 'fun', prompt: 'Would you rather live without music or without movies? Explain your choice.', followUps: ['What would you miss most?', 'Could you survive a week?'], vocab: ['I would rather', 'miss', 'impossible'] },
  { id: 'any-islands', level: 'A2', category: 'fun', prompt: 'You are on an island. You can bring three things. What do you choose?', followUps: ['Why not a phone?', 'What would you do on day one?'], vocab: ['bring', 'useful', 'survive'] },
];

export const MISSION_POINTS: Record<CefrLevel, number> = {
  A1: 5,
  A2: 6,
  B1: 8,
  B2: 10,
  C1: 12,
};

/** Extra points for finishing first, second and third in a round */
export const MISSION_SPEED_BONUS = [5, 3, 1];
