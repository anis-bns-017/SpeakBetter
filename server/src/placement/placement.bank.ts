// server/src/placement/placement.bank.ts
// Question bank for the placement test. `level` is 0..5 for A1..C2. The correct option is always
// written first; the service shuffles the options per attempt, so position gives nothing away.

export type PlacementSkill = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING';

export const SKILLS: readonly PlacementSkill[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'];

export interface PlacementItem {
  id: string;
  skill: PlacementSkill;
  level: number;
  prompt: string;
  /** Reading text shown above the question */
  passage?: string;
  /** Listening text: the browser reads it aloud, the learner never sees it */
  audio?: string;
  /** options[0] is the correct answer */
  options: [string, string, string, string];
}

const g = (id: string, level: number, prompt: string, options: PlacementItem['options']): PlacementItem => ({
  id,
  skill: 'GRAMMAR',
  level,
  prompt,
  options,
});

const v = (id: string, level: number, prompt: string, options: PlacementItem['options']): PlacementItem => ({
  id,
  skill: 'VOCABULARY',
  level,
  prompt,
  options,
});

const r = (
  id: string,
  level: number,
  passage: string,
  prompt: string,
  options: PlacementItem['options'],
): PlacementItem => ({ id, skill: 'READING', level, passage, prompt, options });

const l = (
  id: string,
  level: number,
  audio: string,
  prompt: string,
  options: PlacementItem['options'],
): PlacementItem => ({ id, skill: 'LISTENING', level, audio, prompt, options });

const PASSAGES = [
  // A1
  'Tom is ten years old. He has a dog called Max. Every day after school, Tom and Max play in the park. Tom\'s favourite food is pizza.',
  // A2
  'Last Saturday, Anna went shopping with her sister. They wanted to buy a present for their mother\'s birthday. The shops were very busy, so it took a long time. In the end, they bought a blue scarf and had lunch in a small café.',
  // B1
  'Many people now work from home at least some days a week. Supporters say it saves time and money because there is no daily journey to the office. However, some workers feel lonely and find it hard to separate work from their free time. Because of this, many companies are choosing a mixed model, where employees come to the office two or three days each week.',
  // B2
  'A recent study suggests that students who take handwritten notes remember concepts better than those who type them. The researchers argue that typing allows students to transcribe lectures word for word without really processing the information, whereas writing by hand forces them to summarise ideas in their own words. Critics, however, point out that the study involved only a small group and that laptops remain essential for many students with disabilities.',
  // C1
  'The notion that economic growth inevitably improves well-being has come under scrutiny. While GDP per capita has risen dramatically in many nations over the past fifty years, surveys of life satisfaction have remained stubbornly flat. Economists attribute this paradox, in part, to relative comparison: people judge their prosperity not in absolute terms but against that of their neighbours, so a general rise in incomes fails to produce a corresponding rise in contentment.',
  // C2
  'Far from being a mere stylistic flourish, the author\'s deliberate ambiguity serves a structural purpose: by withholding the narrator\'s motives, the novel compels readers to become complicit in constructing — and, ultimately, in doubting — their own interpretation. The result is less a story to be decoded than an exercise in the fallibility of reading itself.',
];

export const PLACEMENT_BANK: readonly PlacementItem[] = [
  // ---------------- Grammar ----------------
  g('g-a1-1', 0, 'She ___ a student.', ['is', 'am', 'are', 'be']),
  g('g-a1-2', 0, 'We ___ coffee every morning.', ['drink', 'drinks', 'drinking', 'to drink']),
  g('g-a2-1', 1, 'I ___ to the cinema yesterday.', ['went', 'go', 'goes', 'going']),
  g('g-a2-2', 1, "There isn't ___ milk in the fridge.", ['any', 'some', 'a', 'many']),
  g('g-b1-1', 2, 'If it rains tomorrow, we ___ at home.', ['will stay', 'stay', 'would stay', 'stayed']),
  g('g-b1-2', 2, 'I have lived here ___ 2019.', ['since', 'for', 'from', 'during']),
  g('g-b2-1', 3, 'I wish I ___ more time to travel.', ['had', 'have', 'would have', 'having']),
  g('g-b2-2', 3, 'By the time we arrived, the film ___.', [
    'had already started',
    'already started',
    'has already started',
    'was already starting',
  ]),
  g('g-c1-1', 4, 'Not only ___ the exam, but she also got the top score.', [
    'did she pass',
    'she passed',
    'she did pass',
    'passed she',
  ]),
  g('g-c1-2', 4, 'Had I known about the delay, I ___ earlier.', [
    'would have left',
    'would leave',
    'will have left',
    'had left',
  ]),
  g('g-c2-1', 5, 'The committee insisted that the report ___ before the end of the month.', [
    'be submitted',
    'is submitted',
    'was submitted',
    'will be submitted',
  ]),
  g('g-c2-2', 5, 'Were it not for her tireless support, the project ___ long ago.', [
    'would have collapsed',
    'would collapse',
    'had collapsed',
    'collapsed',
  ]),

  // ---------------- Vocabulary ----------------
  v('v-a1-1', 0, "Which word means the opposite of 'big'?", ['small', 'tall', 'old', 'long']),
  v('v-a1-2', 0, 'You can cut paper with ___.', ['scissors', 'a fork', 'a spoon', 'a plate']),
  v('v-a2-1', 1, "I'm very ___. I haven't eaten since breakfast.", ['hungry', 'tired', 'thirsty', 'angry']),
  v('v-a2-2', 1, "Please ___ the door; it's cold in here.", ['close', 'open', 'break', 'push']),
  v('v-b1-1', 2, 'The meeting was ___ because the manager was ill.', ['cancelled', 'collected', 'covered', 'cleaned']),
  v('v-b1-2', 2, "He's very ___; he always thinks about other people's feelings.", [
    'considerate',
    'careless',
    'bored',
    'ashamed',
  ]),
  v('v-b2-1', 3, 'The company decided to ___ its operations to Asia.', ['relocate', 'resolve', 'reserve', 'retrieve']),
  v('v-b2-2', 3, 'Her explanation was so ___ that nobody could understand it.', [
    'convoluted',
    'concise',
    'candid',
    'courteous',
  ]),
  v('v-c1-1', 4, "The scandal had a ___ effect on the company's reputation.", [
    'detrimental',
    'tentative',
    'lucrative',
    'spontaneous',
  ]),
  v('v-c1-2', 4, 'He gave an ___ answer, avoiding any real commitment.', [
    'evasive',
    'exhaustive',
    'lavish',
    'impartial',
  ]),
  v('v-c2-1', 5, "The politician's speech was full of ___: it sounded impressive but said nothing of substance.", [
    'bombast',
    'brevity',
    'sincerity',
    'nuance',
  ]),
  v('v-c2-2', 5, 'The audit was so ___ that not a single invoice went unchecked.', [
    'exhaustive',
    'perfunctory',
    'cursory',
    'tenuous',
  ]),

  // ---------------- Reading (two questions per passage) ----------------
  r('r-a1-1', 0, PASSAGES[0], "What is the dog's name?", ['Max', 'Tom', 'Pizza', 'Park']),
  r('r-a1-2', 0, PASSAGES[0], 'When do Tom and Max play in the park?', [
    'After school',
    'Before school',
    'At night',
    'At lunch',
  ]),
  r('r-a2-1', 1, PASSAGES[1], 'Why did Anna and her sister go shopping?', [
    'To get a birthday present',
    'To buy lunch',
    'To buy blue clothes for themselves',
    'To meet their mother',
  ]),
  r('r-a2-2', 1, PASSAGES[1], 'What did they do after they bought the present?', [
    'They had lunch',
    'They went home',
    'They went to another shop',
    'They met their mother',
  ]),
  r('r-b1-1', 2, PASSAGES[2], 'Which problem of working from home does the text mention?', [
    'Workers can feel lonely',
    'Travel costs go up',
    'Salaries become lower',
    'Offices become noisy',
  ]),
  r('r-b1-2', 2, PASSAGES[2], 'What are many companies choosing to do?', [
    'Combine home and office work',
    'Stop home working completely',
    'Close their offices',
    'Hire fewer people',
  ]),
  r('r-b2-1', 3, PASSAGES[3], 'According to the researchers, why is handwriting more effective?', [
    'It makes students put ideas in their own words',
    'It is faster than typing',
    'It uses less paper',
    'It is quieter in lectures',
  ]),
  r('r-b2-2', 3, PASSAGES[3], "What is the critics' main point?", [
    'The study may not apply to everyone',
    'Handwriting is too slow',
    'Students dislike lectures',
    'Typing is more accurate',
  ]),
  r('r-c1-1', 4, PASSAGES[4], "What 'paradox' does the passage describe?", [
    'Higher incomes have not made people happier overall',
    'Rich countries have become less productive',
    'GDP has fallen while happiness has risen',
    'Surveys on happiness are unreliable',
  ]),
  r('r-c1-2', 4, PASSAGES[4], 'According to the economists, why does this happen?', [
    'People compare themselves with others',
    'People save too much money',
    'Economic growth is not real',
    'Neighbours earn less than before',
  ]),
  r('r-c2-1', 5, PASSAGES[5], "What is the passage's main claim about the author's ambiguity?", [
    'It actively involves readers in interpreting the book',
    'It is purely decorative',
    'It shows the author did not plan the plot',
    'It makes the plot simpler to follow',
  ]),
  r('r-c2-2', 5, PASSAGES[5], 'What does the passage say the novel ultimately demonstrates?', [
    "Readers' interpretations can be unreliable",
    'There is one correct reading',
    'The narrator can be trusted',
    'Style matters more than structure',
  ]),

  // ---------------- Listening ----------------
  l('l-a1-1', 0, 'Hello, my name is Sara. I am from Spain. I am twenty years old.', 'Where is Sara from?', [
    'Spain',
    'Italy',
    'France',
    'Brazil',
  ]),
  l('l-a1-2', 0, 'The bus leaves at half past eight.', 'When does the bus leave?', [
    '8:30',
    '8:15',
    '8:45',
    '9:30',
  ]),
  l(
    'l-a2-1',
    1,
    "Excuse me, how do I get to the station? Go straight, then turn left at the bank. It's next to the post office.",
    'What should you do at the bank?',
    ['Turn left', 'Turn right', 'Go straight', 'Stop'],
  ),
  l(
    'l-a2-2',
    1,
    "I'd like a table for four at seven o'clock, please. Actually, could we make it half past seven? My friend is running late.",
    'What time is the table booked for?',
    ['7:30', '7:00', '8:00', '6:30'],
  ),
  l(
    'l-b1-1',
    2,
    'Thanks for calling. Unfortunately, the dentist is fully booked this week, but we have a free appointment next Tuesday at ten, or Wednesday afternoon at three.',
    'What does the receptionist offer?',
    [
      'Two possible times next week',
      'An appointment this week',
      'A call back tomorrow',
      'A different dentist',
    ],
  ),
  l(
    'l-b1-2',
    2,
    "I was going to take the train, but there's a strike on, so I'm going to drive instead. It'll take longer, but at least I'll get there.",
    'Why is the speaker going to drive?',
    ['The trains are on strike', "It's cheaper", 'The car is faster', 'They dislike trains'],
  ),
  l(
    'l-b2-1',
    3,
    "The proposal sounds promising on paper, but I'm concerned about the timeline. We'd need to complete the prototype in six weeks, and given that two of our engineers are on leave, I doubt that's realistic.",
    "What is the speaker's main concern?",
    [
      'Whether the schedule is achievable',
      'The cost of the project',
      'The quality of the idea',
      "The engineers' skills",
    ],
  ),
  l(
    'l-b2-2',
    3,
    "Had the weather been better, we'd have stayed another night, but the storm forced us to cut the trip short and head back on Friday.",
    'What happened?',
    [
      'They came back early because of the weather',
      'They stayed an extra night',
      'They cancelled the trip',
      'They left on Saturday',
    ],
  ),
  l(
    'l-c1-1',
    4,
    'While the initial results were encouraging, it would be premature to draw firm conclusions. The sample was small, and several participants dropped out, which may have skewed the findings.',
    'What does the speaker imply about the results?',
    [
      'They should be treated with caution',
      'They are conclusive',
      'They were disappointing',
      'They were ignored',
    ],
  ),
  l(
    'l-c1-2',
    4,
    "I wouldn't say the film was bad exactly. It's just that it promised so much more than it delivered.",
    "What is the speaker's opinion of the film?",
    ['It was disappointing', 'It was terrible', 'It was exceptionally good', 'It was too long'],
  ),
  l(
    'l-c2-1',
    5,
    'Her remarks, ostensibly a defence of the policy, read to many as a tacit admission that it had failed, though she stopped short of saying so outright.',
    'How did many people interpret her remarks?',
    [
      'As an indirect acknowledgement of failure',
      'As a clear defence of the policy',
      'As an outright apology',
      'As a call for a new policy',
    ],
  ),
  l(
    'l-c2-2',
    5,
    "It's hardly surprising that the scheme foundered. It was underfunded from the outset, and nobody had thought to consult the people it was meant to serve.",
    'Why did the scheme fail, according to the speaker?',
    [
      'It lacked funding and consultation',
      'It was too expensive to run',
      'It was far too popular',
      'It was opposed by the government',
    ],
  ),
];

const BY_ID = new Map(PLACEMENT_BANK.map((item) => [item.id, item]));

export const getItem = (id: string | null | undefined): PlacementItem | undefined =>
  id ? BY_ID.get(id) : undefined;
