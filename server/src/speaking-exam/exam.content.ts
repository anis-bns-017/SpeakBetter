// server/src/speaking-exam/exam.content.ts
// Question bank for the speaking mock test: three parts in the style of the common spoken English exams.
// Part 1: short personal questions on one topic. Part 2: a cue card, one minute to prepare and up to two to talk.
// Part 3: deeper follow-up questions on the Part 2 theme. All wording here is our own.

export interface Part1Topic {
  id: string;
  topic: string;
  questions: string[];
}

export interface CueCard {
  id: string;
  topic: string;
  prompt: string;
  points: string[];
  /** Part 3 follow-ups on the same theme */
  followUps: string[];
}

export const PART1_TOPICS: Part1Topic[] = [
  {
    id: 'home',
    topic: 'Home and neighbourhood',
    questions: [
      'Can you describe the place where you live?',
      'What do you like most about your neighbourhood?',
      'Is there anything you would change about your home?',
      'Who do you live with, and what do you enjoy doing together?',
    ],
  },
  {
    id: 'work-study',
    topic: 'Work or study',
    questions: [
      'Do you work or are you a student at the moment?',
      'What do you enjoy most about it?',
      'Is there anything about it that you find difficult?',
      'What would you like to do in the future?',
    ],
  },
  {
    id: 'food',
    topic: 'Food and cooking',
    questions: [
      'What kind of food do you enjoy eating most?',
      'Do you like cooking? Why or why not?',
      'Has your taste in food changed since you were a child?',
      'Do you prefer eating at home or in restaurants?',
    ],
  },
  {
    id: 'free-time',
    topic: 'Free time',
    questions: [
      'What do you usually do in your free time?',
      'Do you prefer relaxing at home or going out?',
      'Is there a hobby you would like to try one day?',
      'How much free time do you have during a normal week?',
    ],
  },
  {
    id: 'technology',
    topic: 'Technology',
    questions: [
      'How often do you use your phone, and what for?',
      'Which piece of technology could you not live without?',
      'Do you think people depend too much on technology?',
      'How did you learn to use computers or phones?',
    ],
  },
  {
    id: 'travel',
    topic: 'Travel',
    questions: [
      'Do you like travelling? Why?',
      'What was the last place you visited?',
      'Do you prefer travelling alone or with other people?',
      'Which country would you most like to visit, and why?',
    ],
  },
  {
    id: 'friends',
    topic: 'Friends and family',
    questions: [
      'How often do you see your friends?',
      'What do you like to do together?',
      'Are you more like your mother or your father?',
      'Do you think it is important to keep in touch with old friends?',
    ],
  },
  {
    id: 'weather',
    topic: 'Weather and seasons',
    questions: [
      'What is the weather usually like where you live?',
      'Which season do you like best, and why?',
      'Does the weather change what you do each day?',
      'Do you prefer hot or cold weather?',
    ],
  },
  {
    id: 'health',
    topic: 'Health and fitness',
    questions: [
      'How do you keep yourself healthy?',
      'Do you do any sport or exercise regularly?',
      'What do you usually eat for a healthy meal?',
      'Do you think people today are healthier than in the past?',
    ],
  },
  {
    id: 'shopping',
    topic: 'Shopping',
    questions: [
      'Do you enjoy shopping? Why, or why not?',
      'Do you prefer shopping online or in a shop?',
      'What was the last thing you bought for yourself?',
      'How do you decide what to spend your money on?',
    ],
  },
  {
    id: 'music',
    topic: 'Music',
    questions: [
      'What kind of music do you like to listen to?',
      'When do you usually listen to music?',
      'Did you learn to play an instrument when you were younger?',
      'Has the music you enjoy changed since you were a child?',
    ],
  },
  {
    id: 'languages',
    topic: 'Languages',
    questions: [
      'Which languages can you speak?',
      'Why did you start learning English?',
      'What do you find most difficult about learning a language?',
      'How do you practise your English outside class?',
    ],
  },
];

export const CUE_CARDS: CueCard[] = [
  {
    id: 'teacher',
    topic: 'A person who taught you something',
    prompt: 'Describe a person who taught you something important.',
    points: ['who this person is', 'what they taught you', 'how they taught it', 'and explain why it mattered to you'],
    followUps: [
      'What makes someone a good teacher, in your opinion?',
      'How has the way people learn changed over the last twenty years?',
      'Should schools spend more time on practical skills than on exam subjects?',
    ],
  },
  {
    id: 'journey',
    topic: 'A memorable journey',
    prompt: 'Describe a journey that you remember well.',
    points: ['where you went', 'who you went with', 'what happened on the way', 'and explain why you remember it'],
    followUps: [
      'Why do some people prefer to travel in a group?',
      'How does tourism affect the places people visit?',
      'Do you think travelling is more important for young people than for older people?',
    ],
  },
  {
    id: 'object',
    topic: 'An object that is special to you',
    prompt: 'Describe an object that is special to you.',
    points: ['what it is', 'where you got it', 'how long you have had it', 'and explain why it is special'],
    followUps: [
      'Why do people keep things that have no practical use?',
      'Do you think people care too much about owning things today?',
      'How might the things people value change in the future?',
    ],
  },
  {
    id: 'skill',
    topic: 'A skill you would like to learn',
    prompt: 'Describe a skill you would like to learn.',
    points: ['what the skill is', 'why you want to learn it', 'how you would learn it', 'and explain how it would help you'],
    followUps: [
      'Is it easier to learn new skills as a child or as an adult?',
      'What skills do you think will matter most in the future?',
      "Should employers train their staff, or is that the worker's own job?",
    ],
  },
  {
    id: 'event',
    topic: 'A celebration or event',
    prompt: 'Describe a celebration you enjoyed.',
    points: ['what the celebration was', 'who was there', 'what you did', 'and explain why you enjoyed it'],
    followUps: [
      'Why do people celebrate festivals and special days?',
      'Are traditional celebrations becoming less important?',
      'How do celebrations differ between cities and villages?',
    ],
  },
  {
    id: 'place',
    topic: 'A place where you feel relaxed',
    prompt: 'Describe a place where you go to relax.',
    points: ['where it is', 'how often you go there', 'what you do there', 'and explain why it helps you relax'],
    followUps: [
      'Why do some people find nature more relaxing than cities?',
      'How can workplaces help employees to relax?',
      'Do you think people today are more stressed than in the past?',
    ],
  },
  {
    id: 'book',
    topic: 'A book, film or show',
    prompt: 'Describe a book, film or TV show that you enjoyed.',
    points: ['what it was', 'what it was about', 'when you read or watched it', 'and explain why you enjoyed it'],
    followUps: [
      'Do you think people read less than they used to?',
      'How do films and books influence the way people think?',
      'Should the government support the arts?',
    ],
  },
  {
    id: 'decision',
    topic: 'A difficult decision',
    prompt: 'Describe a time when you made a difficult decision.',
    points: ['what the decision was', 'why it was difficult', 'what you decided', 'and explain how you felt afterwards'],
    followUps: [
      'Do people make better decisions alone or after asking others?',
      'What kinds of decisions should young people be allowed to make for themselves?',
      'How do you think technology changes the way people decide things?',
    ],
  },
  {
    id: 'person',
    topic: 'Someone who inspires you',
    prompt: 'Describe a person who has inspired you.',
    points: ['who this person is', 'how you know them', 'what they have done', 'and explain why they inspire you'],
    followUps: [
      'What qualities make someone a good role model?',
      'Are famous people always good role models for young people?',
      'How have the people who inspire us changed over time?',
    ],
  },
  {
    id: 'gift',
    topic: 'A gift',
    prompt: 'Describe a gift that you gave or received.',
    points: ['what the gift was', 'who it was for', 'why it was chosen', 'and explain how the person felt about it'],
    followUps: [
      'Why do people give gifts on special occasions?',
      'Is it better to give money or a present?',
      'Do you think gift-giving traditions are changing?',
    ],
  },
  {
    id: 'mistake',
    topic: 'Learning from a mistake',
    prompt: 'Describe a time when you made a mistake and learnt from it.',
    points: ['what the mistake was', 'when it happened', 'what you did about it', 'and explain what you learnt'],
    followUps: [
      'Why are some people afraid of making mistakes?',
      'Should schools punish students for mistakes?',
      'Do people learn more from success or from failure?',
    ],
  },
  {
    id: 'tradition',
    topic: 'A tradition',
    prompt: 'Describe a tradition in your family or country.',
    points: ['what the tradition is', 'when it takes place', 'what people do', 'and explain why it is important'],
    followUps: [
      'Why do some traditions disappear over time?',
      'How can young people be encouraged to keep traditions alive?',
      'Do you think technology is changing traditions?',
    ],
  },
];
