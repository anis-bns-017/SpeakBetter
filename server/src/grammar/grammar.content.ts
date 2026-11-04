// server/src/grammar/grammar.content.ts
/**
 * The grammar course: short lessons, each with the rule explained, the mistakes learners make with it, and
 * six exercises. Kept in code (like the library) so wording can change without a migration.
 *
 * Exercise kinds:
 *  - blank   fill the gap (`___`) by choosing; options[0] is the right one, the page shuffles them per learner
 *  - correct choose the correct sentence; options[0] is the right one
 *  - order   put the words in order; `words` is the right order, `alsoAccept` lists other right sentences
 *  - type    type the missing word(s); `answers` lists every accepted answer
 */

import type { MistakePattern } from '../learning/mistakes';

export type GrammarLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const GRAMMAR_LEVELS: GrammarLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type GrammarExercise =
  | { id: string; kind: 'blank'; prompt: string; options: string[]; explanation: string }
  | { id: string; kind: 'correct'; prompt: string; options: string[]; explanation: string }
  | { id: string; kind: 'order'; prompt: string; words: string[]; alsoAccept?: string[]; explanation: string }
  | { id: string; kind: 'type'; prompt: string; answers: string[]; explanation: string };

export interface GrammarLesson {
  id: string;
  level: GrammarLevel;
  title: string;
  /** The kind of mistake this lesson fixes, so it can be recommended to people who keep making it */
  pattern: MistakePattern | null;
  summary: string;
  intro: string;
  rules: Array<{ title: string; body: string; examples: string[] }>;
  mistakes: Array<{ wrong: string; right: string; why: string }>;
  exercises: GrammarExercise[];
}

export const GRAMMAR: GrammarLesson[] = [
  // ---------------------------------------------------------------- A1
  {
    id: 'a1-to-be',
    level: 'A1',
    title: 'Am, is, are',
    pattern: 'AGREEMENT',
    summary: 'The verb "to be": who you are, where you are, how old you are.',
    intro: 'The verb "be" changes its form for each person. It is the most common verb in English, so it is the best place to start.',
    rules: [
      {
        title: 'Choose the right form',
        body: 'Use am with I, is with he, she and it, and are with we, you and they.',
        examples: ['I am a student.', 'She is from Dhaka.', 'They are my friends.'],
      },
      {
        title: 'Say no, and ask questions',
        body: 'Add not after the verb for "no". For a question, put the verb before the person.',
        examples: ['He is not (isn\'t) at home.', 'Are you ready?', 'Is she your sister?'],
      },
      {
        title: 'Short forms',
        body: 'In speech we shorten be: I\'m, you\'re, he\'s, she\'s, it\'s, we\'re, they\'re.',
        examples: ['I\'m tired.', 'We\'re late.'],
      },
    ],
    mistakes: [
      { wrong: 'She are my sister.', right: 'She is my sister.', why: 'She goes with is.' },
      { wrong: 'I am agree.', right: 'I agree.', why: 'Do not add am before another verb.' },
      { wrong: 'I have 20 years.', right: 'I am 20 years old.', why: 'We use be for age, not have.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'She ___ a teacher.', options: ['is', 'are', 'am', 'be'], explanation: 'She takes is.' },
      { id: 'q2', kind: 'blank', prompt: 'We ___ from Bangladesh.', options: ['are', 'is', 'am', 'be'], explanation: 'We takes are.' },
      {
        id: 'q3',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['I am 20 years old.', 'I have 20 years old.', 'I am have 20 years.', 'I has 20 years old.'],
        explanation: 'We use am/is/are for age: I am 20 years old.',
      },
      { id: 'q4', kind: 'order', prompt: 'Put the words in order to make a question.', words: ['Are', 'you', 'ready', 'for', 'class?'], explanation: 'In a question, are comes before you.' },
      { id: 'q5', kind: 'type', prompt: 'My brothers ___ at home now.', answers: ['are'], explanation: 'My brothers means they, so we use are.' },
      { id: 'q6', kind: 'type', prompt: '___ he your friend?', answers: ['is'], explanation: 'He takes is, and in a question it comes first.' },
    ],
  },
  {
    id: 'a1-present-simple',
    level: 'A1',
    title: 'Present simple',
    pattern: 'AGREEMENT',
    summary: 'Talk about habits, routines and facts: "He works every day."',
    intro: 'We use the present simple for things that happen again and again, and for things that are always true.',
    rules: [
      {
        title: 'Add -s for he, she and it',
        body: 'With I, you, we and they use the plain verb. With he, she and it add -s (or -es after s, sh, ch, x, o: watches, goes).',
        examples: ['I work in a bank.', 'She works in a school.', 'He watches TV at night.'],
      },
      {
        title: 'Negatives use do not / does not',
        body: 'Use don\'t or doesn\'t, then the plain verb. The -s moves to does, so the verb has no -s.',
        examples: ['They don\'t drink tea.', 'She doesn\'t like fish.'],
      },
      {
        title: 'Questions use Do / Does',
        body: 'Start with Do or Does, then the person, then the plain verb.',
        examples: ['Do you live here?', 'Does he play football?'],
      },
    ],
    mistakes: [
      { wrong: 'He work every day.', right: 'He works every day.', why: 'He needs -s on the verb.' },
      { wrong: 'She doesn\'t likes tea.', right: 'She doesn\'t like tea.', why: 'After doesn\'t the verb has no -s.' },
      { wrong: 'Do he play?', right: 'Does he play?', why: 'He takes does.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'He ___ to school every day.', options: ['goes', 'go', 'going', 'gone'], explanation: 'He needs -es on go: goes.' },
      { id: 'q2', kind: 'blank', prompt: 'They ___ coffee in the morning.', options: ['don\'t drink', 'doesn\'t drink', 'don\'t drinks', 'not drink'], explanation: 'They takes don\'t, then the plain verb.' },
      {
        id: 'q3',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['She doesn\'t like tea.', 'She doesn\'t likes tea.', 'She don\'t like tea.', 'She not like tea.'],
        explanation: 'She takes doesn\'t, and the verb stays plain: like.',
      },
      { id: 'q4', kind: 'order', prompt: 'Put the words in order to make a question.', words: ['Does', 'he', 'play', 'football', 'on', 'Sundays?'], explanation: 'Does comes first, then he, then the plain verb play.' },
      { id: 'q5', kind: 'type', prompt: 'My sister ___ (work) in a bank.', answers: ['works'], explanation: 'My sister means she, so add -s: works.' },
      { id: 'q6', kind: 'type', prompt: '___ your parents live in Dhaka?', answers: ['do'], explanation: 'Your parents means they, so we use Do.' },
    ],
  },
  {
    id: 'a1-articles',
    level: 'A1',
    title: 'A, an and the',
    pattern: 'ARTICLE',
    summary: 'When to use a, an, the, or nothing at all.',
    intro: 'Articles are small words, but they come up in nearly every sentence. A few simple rules cover most cases.',
    rules: [
      {
        title: 'A or an: listen to the sound',
        body: 'Use an before a vowel sound and a before a consonant sound. It is about sound, not spelling.',
        examples: ['an apple', 'an hour (the h is silent)', 'a university (it starts with a "y" sound)'],
      },
      {
        title: 'The: something specific',
        body: 'Use the when both of you know which one, or when there is only one.',
        examples: ['Close the door, please.', 'The sun is hot today.'],
      },
      {
        title: 'No article',
        body: 'Use no article for plural nouns and uncountable nouns when you talk in general.',
        examples: ['I love music.', 'Dogs are loyal.'],
      },
    ],
    mistakes: [
      { wrong: 'I have a apple.', right: 'I have an apple.', why: 'Apple starts with a vowel sound.' },
      { wrong: 'She is teacher.', right: 'She is a teacher.', why: 'A job needs a / an.' },
      { wrong: 'The life is hard.', right: 'Life is hard.', why: 'Life in general needs no article.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'I eat ___ apple every day.', options: ['an', 'a', 'the', 'some'], explanation: 'Apple starts with a vowel sound, so we use an.' },
      { id: 'q2', kind: 'blank', prompt: 'Look at ___ moon! It is so bright.', options: ['the', 'a', 'an', 'some'], explanation: 'There is only one moon, so we use the.' },
      { id: 'q3', kind: 'blank', prompt: 'She is ___ honest person.', options: ['an', 'a', 'the', 'one'], explanation: 'The h in honest is silent, so the word starts with a vowel sound: an.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['He is a doctor.', 'He is doctor.', 'He is an doctor.', 'He a doctor.'],
        explanation: 'A job needs an article, and doctor starts with a consonant sound: a doctor.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order.', words: ['I', 'need', 'an', 'umbrella', 'today.'], explanation: 'Umbrella starts with a vowel sound, so we use an.' },
      { id: 'q6', kind: 'type', prompt: 'My brother studies at ___ university in Dhaka. (a / an)', answers: ['a'], explanation: 'University starts with a "y" sound, so we use a.' },
    ],
  },

  // ---------------------------------------------------------------- A2
  {
    id: 'a2-past-simple',
    level: 'A2',
    title: 'Past simple',
    pattern: 'TENSE',
    summary: 'Say what happened: "We went home. She didn\'t call."',
    intro: 'We use the past simple for finished actions at a time in the past, like yesterday, last week or in 2019.',
    rules: [
      {
        title: 'Regular and irregular verbs',
        body: 'Regular verbs add -ed (worked, played). Many common verbs are irregular and you need to learn them.',
        examples: ['go → went', 'see → saw', 'have → had', 'buy → bought', 'eat → ate'],
      },
      {
        title: 'Negatives: did not + plain verb',
        body: 'Use didn\'t and the plain verb. The past is already in did, so the verb does not change.',
        examples: ['I didn\'t go to school.', 'She didn\'t know the answer.'],
      },
      {
        title: 'Questions: Did + person + plain verb',
        body: 'Start with Did, then the person, then the plain verb.',
        examples: ['Did you see the film?', 'Did he call you?'],
      },
    ],
    mistakes: [
      { wrong: 'I goed to the market.', right: 'I went to the market.', why: 'Go is irregular: went.' },
      { wrong: 'She didn\'t went.', right: 'She didn\'t go.', why: 'After didn\'t the verb is plain.' },
      { wrong: 'Did you saw it?', right: 'Did you see it?', why: 'After did the verb is plain.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'We ___ a great film last night.', options: ['saw', 'see', 'seen', 'sawed'], explanation: 'See is irregular: saw.' },
      { id: 'q2', kind: 'blank', prompt: 'She didn\'t ___ the answer.', options: ['know', 'knew', 'known', 'knowed'], explanation: 'After didn\'t the verb stays plain: know.' },
      {
        id: 'q3',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['I bought a new phone yesterday.', 'I buyed a new phone yesterday.', 'I did bought a new phone yesterday.', 'I buy a new phone yesterday.'],
        explanation: 'Buy is irregular: bought.',
      },
      { id: 'q4', kind: 'order', prompt: 'Put the words in order to make a question.', words: ['Did', 'you', 'finish', 'your', 'homework', 'yesterday?'], alsoAccept: ['Did you finish your homework yesterday'], explanation: 'Did, then you, then the plain verb finish.' },
      { id: 'q5', kind: 'type', prompt: 'Last year, my family ___ (go) to Cox\'s Bazar.', answers: ['went'], explanation: 'Go is irregular: went.' },
      { id: 'q6', kind: 'type', prompt: 'He ___ breakfast this morning. (not eat)', answers: ['didn\'t eat', 'did not eat'], explanation: 'Use didn\'t + the plain verb: didn\'t eat.' },
    ],
  },
  {
    id: 'a2-prepositions',
    level: 'A2',
    title: 'In, on and at',
    pattern: 'PREPOSITION',
    summary: 'The three small words for time and place.',
    intro: 'In, on and at go from big to small: in for long periods and large spaces, on for days and surfaces, at for exact points.',
    rules: [
      {
        title: 'Time',
        body: 'at for clock times and points (at 5 pm, at night, at the weekend). on for days and dates. in for months, years, seasons and parts of the day.',
        examples: ['at 9 o\'clock', 'on Monday / on 14 March', 'in July / in 2020 / in the morning'],
      },
      {
        title: 'Place',
        body: 'at for a point (at the bus stop). on for a surface (on the table). in for inside something (in a room, in a city, in a country).',
        examples: ['at the station', 'on the wall', 'in Chittagong'],
      },
    ],
    mistakes: [
      { wrong: 'See you in Monday.', right: 'See you on Monday.', why: 'Days take on.' },
      { wrong: 'I wake up in 6 o\'clock.', right: 'I wake up at 6 o\'clock.', why: 'Clock times take at.' },
      { wrong: 'He lives at Dhaka.', right: 'He lives in Dhaka.', why: 'Cities take in.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'The class starts ___ 9 o\'clock.', options: ['at', 'on', 'in', 'by'], explanation: 'Clock times take at.' },
      { id: 'q2', kind: 'blank', prompt: 'My birthday is ___ 14 March.', options: ['on', 'in', 'at', 'of'], explanation: 'Dates take on.' },
      { id: 'q3', kind: 'blank', prompt: 'They live ___ Chittagong.', options: ['in', 'at', 'on', 'to'], explanation: 'Cities take in.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['I was born in 2001.', 'I was born on 2001.', 'I was born at 2001.', 'I was born at the 2001.'],
        explanation: 'Years take in.',
      },
      {
        id: 'q5',
        kind: 'order',
        prompt: 'Put the words in order.',
        words: ['Let\'s', 'meet', 'at', 'the', 'station', 'on', 'Friday.'],
        alsoAccept: ['Let\'s meet on Friday at the station'],
        explanation: 'At the station is a place, on Friday is a day.',
      },
      { id: 'q6', kind: 'type', prompt: 'I usually study ___ the evening.', answers: ['in'], explanation: 'Parts of the day take in (in the morning, in the evening), but we say at night.' },
    ],
  },
  {
    id: 'a2-comparatives',
    level: 'A2',
    title: 'Comparing things',
    pattern: null,
    summary: 'Taller, more expensive, the best: compare people and things.',
    intro: 'Use the comparative to compare two things and the superlative to pick the top one out of three or more.',
    rules: [
      {
        title: 'Short words: add -er / -est',
        body: 'For short adjectives add -er, then than. For the top one use the and -est. Double the last letter after a short vowel (big → bigger).',
        examples: ['My brother is taller than me.', 'She is the tallest in the class.', 'Today is hotter than yesterday.'],
      },
      {
        title: 'Long words: more / the most',
        body: 'For adjectives with two or more syllables (and not ending in -y) use more and the most. Do not add -er as well.',
        examples: ['This phone is more expensive than that one.', 'It is the most interesting film.'],
      },
      {
        title: 'Irregular ones',
        body: 'Learn these by heart: good → better → the best, bad → worse → the worst.',
        examples: ['This is better than that.', 'She is the best student.'],
      },
    ],
    mistakes: [
      { wrong: 'He is more taller.', right: 'He is taller.', why: 'Use either -er or more, never both.' },
      { wrong: 'Taller that me.', right: 'Taller than me.', why: 'The word is than.' },
      { wrong: 'the most good', right: 'the best', why: 'Good is irregular.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'My brother is ___ than me.', options: ['taller', 'more tall', 'tallest', 'the taller'], explanation: 'Tall is short, so add -er: taller.' },
      { id: 'q2', kind: 'blank', prompt: 'This phone is ___ than that one.', options: ['more expensive', 'expensiver', 'most expensive', 'more expensiver'], explanation: 'Expensive is long, so use more.' },
      { id: 'q3', kind: 'blank', prompt: 'She is the ___ student in our class.', options: ['best', 'better', 'most good', 'goodest'], explanation: 'Good is irregular: better, the best.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['Dhaka is bigger than Sylhet.', 'Dhaka is more big than Sylhet.', 'Dhaka is bigger that Sylhet.', 'Dhaka is biggest than Sylhet.'],
        explanation: 'Big doubles the g: bigger, and then follows.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order.', words: ['This', 'book', 'is', 'more', 'interesting', 'than', 'that', 'one.'], explanation: 'Interesting is long: more interesting than.' },
      { id: 'q6', kind: 'type', prompt: 'Today is ___ than yesterday. (hot)', answers: ['hotter'], explanation: 'Hot is short and ends in vowel + consonant, so double the t: hotter.' },
    ],
  },

  // ---------------------------------------------------------------- B1
  {
    id: 'b1-present-perfect',
    level: 'B1',
    title: 'Present perfect',
    pattern: 'TENSE',
    summary: 'Connect the past and now: "I have lived here for two years."',
    intro: 'The present perfect links the past to the present. It is used for experience, for results you can see now, and for things that started before and still continue.',
    rules: [
      {
        title: 'Form: have / has + past participle',
        body: 'Use have with I, you, we, they and has with he, she, it. Irregular verbs have special participles (gone, seen, eaten, done).',
        examples: ['I have never eaten sushi.', 'She has gone to the market.'],
      },
      {
        title: 'For and since',
        body: 'Use for with a length of time and since with a starting point.',
        examples: ['I have lived here for five years.', 'I have lived here since 2019.'],
      },
      {
        title: 'Not with a finished time',
        body: 'If you say when it happened (yesterday, in 2019, last week), use the past simple instead.',
        examples: ['I saw him yesterday. (not "I have seen him yesterday")'],
      },
    ],
    mistakes: [
      { wrong: 'I have seen him yesterday.', right: 'I saw him yesterday.', why: 'Yesterday is a finished time: past simple.' },
      { wrong: 'I live here since 2020.', right: 'I have lived here since 2020.', why: 'It started in the past and continues now.' },
      { wrong: 'She has went.', right: 'She has gone.', why: 'Use the past participle: gone.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'I have never ___ sushi.', options: ['eaten', 'ate', 'eat', 'eating'], explanation: 'After have use the past participle: eaten.' },
      { id: 'q2', kind: 'blank', prompt: 'She has lived here ___ 2019.', options: ['since', 'for', 'from', 'in'], explanation: 'Since goes with a starting point like 2019.' },
      { id: 'q3', kind: 'blank', prompt: 'We have known each other ___ ten years.', options: ['for', 'since', 'from', 'during'], explanation: 'For goes with a length of time.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['I saw him yesterday.', 'I have seen him yesterday.', 'I have saw him yesterday.', 'I seen him yesterday.'],
        explanation: 'Yesterday is a finished time, so use the past simple.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order to make a question.', words: ['Have', 'you', 'ever', 'been', 'to', 'London?'], explanation: 'Have comes first, then the person, then ever and the participle.' },
      { id: 'q6', kind: 'type', prompt: 'He has ___ (go) to the market, so he isn\'t at home.', answers: ['gone'], explanation: 'The past participle of go is gone.' },
    ],
  },
  {
    id: 'b1-first-conditional',
    level: 'B1',
    title: 'First conditional',
    pattern: 'TENSE',
    summary: 'Real possibilities: "If it rains, we will stay home."',
    intro: 'Use the first conditional for things that may really happen in the future, and what will happen as a result.',
    rules: [
      {
        title: 'If + present simple, will + plain verb',
        body: 'The if part uses the present simple (even though it talks about the future). The result part uses will.',
        examples: ['If it rains, we will stay at home.', 'If you study, you will pass.'],
      },
      {
        title: 'Never will after if',
        body: 'Do not put will in the if part. The result part can also use can, may or might.',
        examples: ['If she calls, I will tell her.', 'If you hurry, you might catch the bus.'],
      },
      {
        title: 'Unless means if not',
        body: 'Unless is followed by a positive verb, because it already means "if not".',
        examples: ['Unless you hurry, you will miss the bus.'],
      },
    ],
    mistakes: [
      { wrong: 'If it will rain, I will stay.', right: 'If it rains, I will stay.', why: 'No will in the if part.' },
      { wrong: 'Unless you don\'t hurry...', right: 'Unless you hurry...', why: 'Unless already means "if not".' },
      { wrong: 'If you study, you would pass.', right: 'If you study, you will pass.', why: 'Real possibility: will, not would.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'If it ___ tomorrow, we will stay at home.', options: ['rains', 'will rain', 'rained', 'would rain'], explanation: 'The if part uses the present simple.' },
      { id: 'q2', kind: 'blank', prompt: 'If you ___ hard, you will pass the exam.', options: ['study', 'will study', 'studied', 'studying'], explanation: 'No will after if: study.' },
      { id: 'q3', kind: 'blank', prompt: 'If she calls, I ___ her the news.', options: ['will tell', 'would tell', 'told', 'am telling'], explanation: 'The result of a real possibility uses will.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['Unless you hurry, you will miss the bus.', 'Unless you won\'t hurry, you will miss the bus.', 'Unless you will hurry, you will miss the bus.', 'Unless you hurry, you would miss the bus.'],
        explanation: 'Unless means "if not", so the verb after it is positive and in the present.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order.', words: ['If', 'I', 'see', 'him,', 'I', 'will', 'tell', 'him.'], explanation: 'If + present simple, will + plain verb.' },
      { id: 'q6', kind: 'type', prompt: 'If we ___ (leave) now, we will arrive on time.', answers: ['leave'], explanation: 'The if part uses the present simple: leave.' },
    ],
  },
  {
    id: 'b1-modals',
    level: 'B1',
    title: 'Can, should and must',
    pattern: 'TENSE',
    summary: 'Ability, advice, rules and possibility.',
    intro: 'Modal verbs such as can, should and must always come before a plain verb. They never take -s and never take "to".',
    rules: [
      {
        title: 'One shape for every person',
        body: 'Modal + plain verb. No -s for he, she or it, and no to afterwards.',
        examples: ['She can speak three languages.', 'You must go now.'],
      },
      {
        title: 'What each one means',
        body: 'can / could: ability, polite requests. should: advice. must / have to: strong obligation. may / might: possibility.',
        examples: ['Could you open the window?', 'You should see a doctor.', 'It might rain later.'],
      },
      {
        title: 'Mustn\'t is not "don\'t have to"',
        body: 'Mustn\'t means it is forbidden. Don\'t have to means it is not necessary.',
        examples: ['You mustn\'t smoke here.', 'You don\'t have to pay. It is free.'],
      },
    ],
    mistakes: [
      { wrong: 'She can speaks English.', right: 'She can speak English.', why: 'No -s after a modal.' },
      { wrong: 'You must to go.', right: 'You must go.', why: 'No to after a modal.' },
      { wrong: 'You mustn\'t pay, it is free.', right: 'You don\'t have to pay, it is free.', why: 'It is not necessary, not forbidden.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'You ___ wear a seatbelt. It is the law.', options: ['must', 'mustn\'t', 'don\'t have to', 'might'], explanation: 'The law makes it an obligation: must.' },
      { id: 'q2', kind: 'blank', prompt: 'You ___ pay to enter. It is free.', options: ['don\'t have to', 'mustn\'t', 'shouldn\'t', 'must'], explanation: 'It is free, so paying is not necessary: don\'t have to.' },
      { id: 'q3', kind: 'blank', prompt: 'If you have a headache, you ___ see a doctor.', options: ['should', 'should to', 'must to', 'can to'], explanation: 'Advice uses should, followed by a plain verb.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['She can speak three languages.', 'She can speaks three languages.', 'She can to speak three languages.', 'She cans speak three languages.'],
        explanation: 'Modal + plain verb: no -s and no to.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order to make a polite request.', words: ['Could', 'you', 'open', 'the', 'window,', 'please?'], explanation: 'Could + person + plain verb is a polite request.' },
      { id: 'q6', kind: 'type', prompt: 'Take an umbrella. It ___ rain later. (possible, not sure)', answers: ['might', 'may', 'could'], explanation: 'May, might and could all show something is possible.' },
    ],
  },

  // ---------------------------------------------------------------- B2
  {
    id: 'b2-passive',
    level: 'B2',
    title: 'The passive voice',
    pattern: 'TENSE',
    summary: 'Focus on what happened, not who did it: "The bridge was built in 1998."',
    intro: 'Use the passive when the action matters more than the person who did it, or when you do not know who did it.',
    rules: [
      {
        title: 'Form: be + past participle',
        body: 'Change be to match the tense: is made, was built, has been done, will be sent.',
        examples: ['English is spoken in many countries.', 'The bridge was built in 1998.', 'The report will be finished by Friday.'],
      },
      {
        title: 'Add by to name the doer',
        body: 'Add by + person only if it is important. Often it is left out.',
        examples: ['The song was written by a famous poet.', 'My phone was stolen.'],
      },
      {
        title: 'Only some verbs',
        body: 'Only verbs that take an object can be passive. Verbs like happen, arrive and die cannot.',
        examples: ['The accident happened. (not "was happened")'],
      },
    ],
    mistakes: [
      { wrong: 'The window broken yesterday.', right: 'The window was broken yesterday.', why: 'Do not forget the verb be.' },
      { wrong: 'The cake was ate.', right: 'The cake was eaten.', why: 'Use the past participle: eaten.' },
      { wrong: 'It was happened last night.', right: 'It happened last night.', why: 'Happen cannot be passive.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'English ___ in many countries.', options: ['is spoken', 'speaks', 'is speaking', 'spoken'], explanation: 'Present passive: is + spoken.' },
      { id: 'q2', kind: 'blank', prompt: 'The bridge ___ in 1998.', options: ['was built', 'built', 'is built', 'has built'], explanation: 'A finished past time: was + built.' },
      { id: 'q3', kind: 'blank', prompt: 'The report ___ by Friday.', options: ['will be finished', 'will finish', 'will be finish', 'is finish'], explanation: 'Future passive: will be + past participle.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['The letter was written yesterday.', 'The letter wrote yesterday.', 'The letter was wrote yesterday.', 'The letter has written yesterday.'],
        explanation: 'Was + the past participle written (not wrote).',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order.', words: ['My', 'phone', 'was', 'stolen', 'on', 'the', 'bus.'], alsoAccept: ['On the bus my phone was stolen'], explanation: 'Subject + was + past participle.' },
      { id: 'q6', kind: 'type', prompt: 'A lot of rice ___ (grow) in Bangladesh.', answers: ['is grown'], explanation: 'Present passive: is grown.' },
    ],
  },
  {
    id: 'b2-conditionals',
    level: 'B2',
    title: 'Second and third conditional',
    pattern: 'TENSE',
    summary: 'Imagine things that are not true: "If I were rich..." and "If I had known..."',
    intro: 'The second conditional is about unreal or unlikely things now. The third conditional is about the past, when it is too late to change.',
    rules: [
      {
        title: 'Second: if + past simple, would + plain verb',
        body: 'Use the past simple in the if part, even though you mean now. With be, many people say were for every person.',
        examples: ['If I were rich, I would travel the world.', 'If I had more time, I would learn French.'],
      },
      {
        title: 'Third: if + past perfect, would have + participle',
        body: 'Use had + past participle in the if part, and would have + past participle in the result.',
        examples: ['If I had known, I would have called you.', 'If she had studied, she would have passed.'],
      },
      {
        title: 'No would in the if part',
        body: 'Do not put would right after if. It goes in the result part only.',
        examples: ['If I had money, I would buy it. (not "If I would have money")'],
      },
    ],
    mistakes: [
      { wrong: 'If I would have money, I would buy it.', right: 'If I had money, I would buy it.', why: 'No would after if.' },
      { wrong: 'If I knew, I would have told you.', right: 'If I had known, I would have told you.', why: 'The past needs had + participle.' },
      { wrong: 'If he would study, he would pass.', right: 'If he studied, he would pass.', why: 'Past simple in the if part.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'If I ___ rich, I would travel the world.', options: ['were', 'am', 'will be', 'would be'], explanation: 'Unreal now: if + were.' },
      { id: 'q2', kind: 'blank', prompt: 'If she had studied, she ___ the exam.', options: ['would have passed', 'would pass', 'will pass', 'had passed'], explanation: 'Third conditional result: would have + participle.' },
      { id: 'q3', kind: 'blank', prompt: 'If I ___ you, I would apologise.', options: ['were', 'am', 'would be', 'will be'], explanation: 'Advice with an unreal idea: if I were you.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['If I had known, I would have called you.', 'If I would have known, I would have called you.', 'If I knew, I would have called you.', 'If I had known, I would call you yesterday.'],
        explanation: 'Third conditional: if + had known, would have + participle.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order.', words: ['If', 'I', 'had', 'more', 'time,', 'I', 'would', 'learn', 'French.'], explanation: 'Second conditional: if + past simple, would + plain verb.' },
      { id: 'q6', kind: 'type', prompt: 'If they ___ (leave) earlier, they wouldn\'t have missed the train.', answers: ['had left'], explanation: 'Third conditional if part: had + past participle.' },
    ],
  },

  // ---------------------------------------------------------------- C1
  {
    id: 'c1-inversion',
    level: 'C1',
    title: 'Inversion for emphasis',
    pattern: 'WORD_ORDER',
    summary: 'Sound more formal: "Never have I seen such a view."',
    intro: 'After some negative or limiting words at the start of a sentence, English swaps the subject and the helper verb, as in a question. It adds emphasis and sounds formal.',
    rules: [
      {
        title: 'Negative words first',
        body: 'After never, rarely, seldom, hardly, not only and little, put the helper verb before the subject. If there is no helper, add do / does / did.',
        examples: ['Never have I seen such a beautiful view.', 'Rarely does he arrive late.', 'Not only did he pass, but he also won a prize.'],
      },
      {
        title: 'Hardly ... when',
        body: 'Hardly had + subject + participle, when + past simple.',
        examples: ['Hardly had we sat down when the phone rang.'],
      },
      {
        title: 'Dropping if',
        body: 'In formal writing, drop if and start with Had, Should or Were.',
        examples: ['Had I known, I would have helped. (= If I had known)', 'Should you need help, call me.'],
      },
    ],
    mistakes: [
      { wrong: 'Never I have seen it.', right: 'Never have I seen it.', why: 'Swap the helper verb and the subject.' },
      { wrong: 'Not only he came, but...', right: 'Not only did he come, but...', why: 'Add did and use the plain verb.' },
      { wrong: 'Rarely she goes out.', right: 'Rarely does she go out.', why: 'Add does and use the plain verb.' },
    ],
    exercises: [
      { id: 'q1', kind: 'blank', prompt: 'Never ___ such a beautiful view.', options: ['have I seen', 'I have seen', 'I saw', 'did I seen'], explanation: 'After never, the helper verb comes first: have I seen.' },
      { id: 'q2', kind: 'blank', prompt: 'Rarely ___ late for work.', options: ['is he', 'he is', 'does he', 'he does'], explanation: 'After rarely, swap the verb and the subject: is he.' },
      { id: 'q3', kind: 'blank', prompt: 'Not only ___ the exam, but he also won a prize.', options: ['did he pass', 'he passed', 'he did pass', 'passed he'], explanation: 'Not only + did + subject + plain verb.' },
      {
        id: 'q4',
        kind: 'correct',
        prompt: 'Which sentence is correct?',
        options: ['Had I known, I would have helped.', 'Had I knew, I would have helped.', 'I had known, would have helped.', 'Would I had known, I would have helped.'],
        explanation: 'Had + subject + participle replaces if I had known.',
      },
      { id: 'q5', kind: 'order', prompt: 'Put the words in order.', words: ['Hardly', 'had', 'we', 'sat', 'down', 'when', 'the', 'phone', 'rang.'], explanation: 'Hardly had + subject + participle, when + past simple.' },
      { id: 'q6', kind: 'type', prompt: 'Seldom ___ she complain about her work.', answers: ['does'], explanation: 'Seldom + does + subject + plain verb.' },
    ],
  },
];

export const LESSON_BY_ID = new Map(GRAMMAR.map((l) => [l.id, l]));
