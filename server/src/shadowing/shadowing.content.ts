// server/src/shadowing/shadowing.content.ts
/**
 * The shadowing course: tracks of short lessons, each a set of lines to hear and say back the same way.
 * Every lesson trains one thing (rising questions, linking, weak forms, stress...) and says how in its tip.
 * Written for this app. Lines are kept short enough to say in one breath, so the recogniser can score them.
 */

export type ShadowLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const SHADOW_LEVELS: ShadowLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type ShadowTrackId = 'everyday' | 'questions' | 'connected' | 'stress' | 'travel' | 'stories' | 'work' | 'opinions' | 'sounds';

export interface ShadowTrack {
  id: ShadowTrackId;
  label: string;
  description: string;
  /** A lucide icon name the web app knows */
  icon: string;
}

export interface ShadowLesson {
  id: string;
  track: ShadowTrackId;
  level: ShadowLevel;
  title: string;
  /** The skill in a few words, shown on the card */
  focus: string;
  /** How to do it, one or two sentences */
  tip: string;
  lines: string[];
}

export const TRACKS: ShadowTrack[] = [
  { id: 'everyday', label: 'Everyday conversations', description: 'Natural lines for meeting people, making plans and asking for help.', icon: 'MessageCircle' },
  { id: 'questions', label: 'Questions and intonation', description: 'Make your voice go up and down the way English speakers do.', icon: 'MessageCircleQuestion' },
  { id: 'connected', label: 'Connected speech', description: 'Link words together, use weak forms and sound smooth instead of word by word.', icon: 'Link' },
  { id: 'stress', label: 'Stress and rhythm', description: 'Hit the important words and let the small ones fall, so you are easy to follow.', icon: 'Activity' },
  { id: 'travel', label: 'Travel', description: 'Ask the way, check in and sort out problems on the road.', icon: 'Plane' },
  { id: 'stories', label: 'Telling stories', description: 'Narrate what happened with good pacing, pauses and feeling.', icon: 'BookOpen' },
  { id: 'work', label: 'Work and interviews', description: 'Sound confident introducing yourself, answering interview questions and running meetings.', icon: 'Briefcase' },
  { id: 'opinions', label: 'Opinions and presentations', description: 'Give opinions, build an IELTS-style answer and present with impact.', icon: 'Presentation' },
  { id: 'sounds', label: 'Tricky sounds', description: 'Tongue twisters for the sounds learners mix up most: TH, R and L, V and W.', icon: 'Zap' },
];

export const LESSONS: ShadowLesson[] = [
  // ---------------------------------------------------------------- everyday
  {
    id: 'a1-meeting-someone',
    track: 'everyday',
    level: 'A1',
    title: 'Meeting someone new',
    focus: 'Friendly, falling statements',
    tip: 'Let your voice fall at the end of each statement. A friendly smile changes the sound too, so smile while you speak.',
    lines: [
      'Hi, my name is Sara.',
      'Nice to meet you.',
      "I'm from Brazil, but I live in London now.",
      "What's your name?",
      'I work in a small hotel near the station.',
      'See you tomorrow!',
    ],
  },
  {
    id: 'a2-making-plans',
    track: 'everyday',
    level: 'A2',
    title: 'Making plans',
    focus: 'Suggestions that sound warm',
    tip: 'Start suggestions a little higher and keep them light. Stress the activity and the time, like "a MOVIE on SATURDAY".',
    lines: [
      'Are you free on Saturday evening?',
      'Why don\'t we go and see a movie?',
      "That sounds great, but I'm busy until seven.",
      'How about meeting at half past seven, then?',
      "Perfect. Let's meet outside the cinema.",
      "I'll send you a message when I leave home.",
    ],
  },
  {
    id: 'b1-asking-favours',
    track: 'everyday',
    level: 'B1',
    title: 'Asking for favours',
    focus: 'Polite requests',
    tip: 'Polite requests start high and fall gently. Slow down a little on "would you mind" and "I was wondering".',
    lines: [
      'Sorry to bother you, have you got a minute?',
      'I was wondering if you could help me with something.',
      'Would you mind watering my plants next week?',
      "I'm away for a few days and I don't want them to die.",
      'Of course, just leave me the key.',
      "Thanks so much, I really owe you one.",
    ],
  },

  // ---------------------------------------------------------------- questions
  {
    id: 'a1-yes-no-questions',
    track: 'questions',
    level: 'A1',
    title: 'Yes/no questions go up',
    focus: 'Rising intonation',
    tip: 'When the answer is yes or no, let your voice rise on the last stressed word and keep it up to the end.',
    lines: [
      'Are you hungry?',
      'Do you like coffee?',
      'Is this your bag?',
      'Can you help me, please?',
      'Have you been here before?',
      'Is it far from here?',
    ],
  },
  {
    id: 'a2-wh-questions',
    track: 'questions',
    level: 'A2',
    title: 'Wh- questions come down',
    focus: 'Falling intonation in questions',
    tip: 'Questions with what, where, when, why and how usually fall at the end, like a statement. Stress the question word and the key word.',
    lines: [
      'Where do you live?',
      'What time does the shop close?',
      'How long have you been learning English?',
      'Why did you choose this job?',
      'When is your birthday?',
      'Which bus goes to the airport?',
    ],
  },
  {
    id: 'b2-question-tags',
    track: 'questions',
    level: 'B2',
    title: 'Question tags',
    focus: 'Checking versus really asking',
    tip: 'A falling tag means you expect agreement; a rising tag means you really are not sure. Copy the tune of each line exactly.',
    lines: [
      "It's a lovely day, isn't it?",
      "You haven't seen my keys, have you?",
      "She's coming tonight, isn't she?",
      "We don't need to book, do we?",
      "That was a great film, wasn't it?",
      "You'll call me later, won't you?",
    ],
  },

  // ---------------------------------------------------------------- connected speech
  {
    id: 'a2-linking',
    track: 'connected',
    level: 'A2',
    title: 'Linking words together',
    focus: 'Consonant to vowel linking',
    tip: 'When a word ends in a consonant and the next starts with a vowel, join them: "an apple" sounds like "a napple". The linked words are marked.',
    lines: [
      'Can I have an apple, please?',
      'Turn it off and on again.',
      "It's an old house in an empty street.",
      'Pick it up and put it away.',
      'I need a cup of tea.',
      'Come in and sit on the sofa.',
    ],
  },
  {
    id: 'b1-weak-forms',
    track: 'connected',
    level: 'B1',
    title: 'Weak forms',
    focus: 'Small words get small',
    tip: 'Words like to, of, and, can, for and was are usually weak: "to" sounds like "tuh" and "and" like "n". The weak ones are marked.',
    lines: [
      'I want to go for a walk.',
      'A cup of tea and a piece of cake.',
      'I can swim, but not very well.',
      'She was waiting for the bus at the station.',
      'We have to be there at nine.',
      'Some of them are from the north of England.',
    ],
  },
  {
    id: 'b2-fast-speech',
    track: 'connected',
    level: 'B2',
    title: 'Natural fast speech',
    focus: 'Sounds that disappear',
    tip: 'In fast speech, t and d often vanish between consonants: "next week" sounds like "neks week". Aim for smooth, not perfect, sounds.',
    lines: [
      'I must go next week.',
      "I don't know what you mean.",
      'Did you get the last train?',
      'We just missed it by a minute.',
      'What are you going to do about it?',
      'Let me know as soon as you find out.',
    ],
  },

  // ---------------------------------------------------------------- stress and rhythm
  {
    id: 'a2-rhythm',
    track: 'stress',
    level: 'A2',
    title: 'Strong words, weak words',
    focus: 'The beat of English',
    tip: 'English keeps a beat on the important words (nouns, verbs, adjectives) and squeezes the small words between them. Stressed words are in bold.',
    lines: [
      'I need to buy some bread.',
      'She drives to work every day.',
      'We had a lovely time at the beach.',
      'He wants a bigger flat in the city.',
      'They play football in the park on Sundays.',
      'Put the books on the table by the door.',
    ],
  },
  {
    id: 'b1-contrast-stress',
    track: 'stress',
    level: 'B1',
    title: 'Contrast stress',
    focus: 'Stress the difference',
    tip: 'When you correct someone or compare two things, stress the word that is different: "I said the RED one, not the BLUE one".',
    lines: [
      'I said the red one, not the blue one.',
      'It starts at eight, not at nine.',
      "I'm not angry, I'm just tired.",
      'She wanted tea, but he wanted coffee.',
      "It's not my phone, it's yours.",
      'We met in June, not in July.',
    ],
  },
  {
    id: 'c1-emphasis',
    track: 'stress',
    level: 'C1',
    title: 'Stress for emphasis',
    focus: 'Changing meaning with stress',
    tip: 'Moving the stress changes what you mean. Lean on the emphatic words, such as "really", "never" and "did", and slow down slightly on them.',
    lines: [
      'I really did try my best.',
      'I have never been so embarrassed in my life.',
      'That is exactly what I was trying to say.',
      'It was the worst decision we could have made.',
      'You do realise how important this is, right?',
      'The problem is not the money, it is the time.',
    ],
  },

  // ---------------------------------------------------------------- travel
  {
    id: 'a1-asking-the-way',
    track: 'travel',
    level: 'A1',
    title: 'Asking the way',
    focus: 'Clear, simple questions',
    tip: 'Say place names slowly and clearly, and stress them. Pause briefly after "excuse me".',
    lines: [
      'Excuse me, where is the train station?',
      'Go straight on and turn left.',
      "It's next to the bank.",
      'Is it near here?',
      "It's about five minutes on foot.",
      'Thank you very much.',
    ],
  },
  {
    id: 'a2-at-the-hotel',
    track: 'travel',
    level: 'A2',
    title: 'At the hotel',
    focus: 'Polite and clear',
    tip: 'Hotel staff speak fast. Keep the rhythm: stress the key word in each line (booking, breakfast, key) and link the small words.',
    lines: [
      'Hello, I have a booking for two nights.',
      "The name is Hassan, that's with a double S.",
      'What time is breakfast in the morning?',
      'Could I have a room with a view?',
      'Is there a lift to the third floor?',
      'Can I leave my bags here after checkout?',
    ],
  },
  {
    id: 'b1-travel-problems',
    track: 'travel',
    level: 'B1',
    title: 'Sorting out problems',
    focus: 'Calm but firm',
    tip: 'Keep your voice low and steady, and stress the facts: what, when and what you want. Avoid rising at the end, or you sound unsure.',
    lines: [
      "I'm afraid there's a problem with my room.",
      "The air conditioning isn't working.",
      'My flight has been cancelled and I need another one.',
      'Is there any way you could change my seat?',
      "I've been waiting for over an hour.",
      'I would like to speak to the manager, please.',
    ],
  },

  // ---------------------------------------------------------------- stories
  {
    id: 'a2-my-weekend',
    track: 'stories',
    level: 'A2',
    title: 'My weekend',
    focus: 'Past tense endings',
    tip: 'Say the -ed endings: "walked" ends in a t sound, "played" in a d sound, and "visited" gets an extra syllable.',
    lines: [
      'On Saturday I visited my grandparents.',
      'We walked by the river and talked for hours.',
      'In the evening we cooked a big dinner together.',
      'On Sunday it rained all day.',
      'So I stayed at home and watched a film.',
      'It was quiet, but I enjoyed it.',
    ],
  },
  {
    id: 'b1-funny-story',
    track: 'stories',
    level: 'B1',
    title: 'A funny thing happened',
    focus: 'Pauses and build-up',
    tip: 'Good storytellers pause before the surprise. Slow down on the key moment and let your voice show the feeling.',
    lines: [
      'You will never guess what happened to me yesterday.',
      'I was standing in a long queue at the supermarket.',
      'Suddenly, the man in front of me turned around.',
      'It was my old teacher from primary school!',
      'He still remembered my name after twenty years.',
      'We ended up having coffee together.',
    ],
  },
  {
    id: 'b2-lesson-learned',
    track: 'stories',
    level: 'B2',
    title: 'A lesson I learned',
    focus: 'Reflective, measured pace',
    tip: 'Reflective stories sound best a bit slower. Pause at the commas and stress the words that carry the lesson.',
    lines: [
      'A few years ago, I took a job I really did not want.',
      'At first, I felt completely out of place.',
      'But slowly, I started to enjoy the challenge.',
      'Looking back, it taught me to be more patient.',
      'Now I try not to judge things too quickly.',
      'Sometimes the hardest choices turn out to be the best.',
    ],
  },

  // ---------------------------------------------------------------- work
  {
    id: 'b1-introducing-yourself',
    track: 'work',
    level: 'B1',
    title: 'Introducing yourself at work',
    focus: 'Confident and clear',
    tip: 'Speak at a steady pace, stress your name and your role, and let each sentence fall at the end to sound sure of yourself.',
    lines: [
      "Hi everyone, I'm Lina, the new marketing assistant.",
      "I've just moved here from the Madrid office.",
      "I'll be working mainly on social media.",
      'Before this, I worked for a small design agency.',
      'Please feel free to come and say hello.',
      "I'm looking forward to working with you all.",
    ],
  },
  {
    id: 'b2-job-interview',
    track: 'work',
    level: 'B2',
    title: 'Job interview answers',
    focus: 'Pacing longer answers',
    tip: 'Break long answers into chunks with short pauses. Stress the results and numbers, because those are what interviewers remember.',
    lines: [
      'I have five years of experience in customer service.',
      'In my last role, I managed a team of eight people.',
      'We increased customer satisfaction by twenty percent.',
      "I'm good at staying calm under pressure.",
      'One weakness is that I find it hard to say no.',
      "I'm working on it by planning my time more carefully.",
    ],
  },
  {
    id: 'c1-leading-a-meeting',
    track: 'work',
    level: 'C1',
    title: 'Leading a meeting',
    focus: 'Signposting with authority',
    tip: 'Signposts like "first of all" and "moving on" guide listeners. Pause after them and use a falling tone to sound in control.',
    lines: [
      "Right, let's get started, shall we?",
      'First of all, thanks for making the time today.',
      'The main aim is to agree on next quarter\'s budget.',
      "Moving on, I'd like to hear your thoughts on the timeline.",
      'Could we park that idea and come back to it later?',
      'To sum up, we have three action points to follow up on.',
    ],
  },

  // ---------------------------------------------------------------- opinions
  {
    id: 'b1-giving-opinions',
    track: 'opinions',
    level: 'B1',
    title: 'Giving your opinion',
    focus: 'Opinion phrases',
    tip: 'Stress the opinion word ("think", "honestly", "agree") and pause slightly after the opening phrase before the main point.',
    lines: [
      'In my opinion, public transport should be free.',
      'I honestly think it would reduce traffic.',
      'I see your point, but I am not sure I agree.',
      'It depends on how much it would cost.',
      'For me, the most important thing is safety.',
      'That is a good question, let me think.',
    ],
  },
  {
    id: 'b2-ielts-speaking',
    track: 'opinions',
    level: 'B2',
    title: 'IELTS Speaking answers',
    focus: 'Fluency and extended answers',
    tip: 'Examiners listen for smooth, connected speech. Keep going without long gaps, use linking phrases and vary your tone.',
    lines: [
      "That's an interesting question, actually.",
      "I'd say I'm more of a morning person.",
      'The main reason is that I can concentrate better early on.',
      'Having said that, it really depends on the day.',
      'For example, at weekends I tend to sleep in.',
      'Overall, I think a routine makes me more productive.',
    ],
  },
  {
    id: 'c1-presenting',
    track: 'opinions',
    level: 'C1',
    title: 'Presenting with impact',
    focus: 'Pauses, contrast and power',
    tip: 'Strong speakers use silence. Pause before the key idea, stress the contrast and finish on a falling tone.',
    lines: [
      'Imagine a city with no traffic at all.',
      'Not fewer cars, but no cars at all.',
      'It sounds impossible, but it is already happening.',
      'The question is not whether we can, but whether we will.',
      'Let me show you three reasons why this matters.',
      'The future of our cities starts with a single decision.',
    ],
  },

  // ---------------------------------------------------------------- tricky sounds
  {
    id: 'a2-th-sounds',
    track: 'sounds',
    level: 'A2',
    title: 'TH: think and this',
    focus: 'Tongue between the teeth',
    tip: 'Put the tip of your tongue lightly between your teeth and blow. "Think" is just air; "this" adds your voice.',
    lines: [
      'I think this is the third one.',
      'They thanked their mother and father.',
      'Thirty thousand people were there on Thursday.',
      'This thing is better than that thing.',
      'Both brothers think the weather is fine.',
      'Thank you for the birthday cake.',
    ],
  },
  {
    id: 'b1-r-and-l',
    track: 'sounds',
    level: 'B1',
    title: 'R and L',
    focus: 'Two different tongues',
    tip: 'For L, touch the ridge behind your top teeth. For R, pull your tongue back and do not touch anything; round your lips a little.',
    lines: [
      'Red lorry, yellow lorry.',
      'The road is long and really lovely.',
      'Laura reads a lot of library books.',
      'Please collect the light blue rug.',
      'Rory loves rice and lemon.',
      'The rain fell lightly on the roof.',
    ],
  },
  {
    id: 'b2-v-and-w',
    track: 'sounds',
    level: 'B2',
    title: 'V and W',
    focus: 'Teeth or round lips',
    tip: 'For V, your top teeth touch your bottom lip and you buzz. For W, round your lips like a kiss and open them; no teeth.',
    lines: [
      'We visited a very wet village.',
      'Will you have vanilla or walnut?',
      'The wind was violent all week.',
      'Vincent went west with his wife.',
      'Very few voters were worried.',
      'Which van will we use on Wednesday?',
    ],
  },
];

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));
export const TRACK_BY_ID = new Map(TRACKS.map((t) => [t.id, t]));
