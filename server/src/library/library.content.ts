/**
 * The reading and listening library: short texts for each level, each followed by a few questions. The
 * right answer is always written first here; the service shuffles the options for each reader.
 */

export const LIBRARY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type LibraryLevel = (typeof LIBRARY_LEVELS)[number];
export type TextKind = 'story' | 'dialogue' | 'article';

export interface Sentence {
  /** Who says it, in a dialogue */
  speaker?: string;
  text: string;
}

export interface Question {
  id: string;
  question: string;
  /** The right answer first */
  options: [string, string, string, string];
  explanation: string;
  /** The sentence that holds the answer */
  sentence: number;
}

export interface LibraryText {
  id: string;
  level: LibraryLevel;
  kind: TextKind;
  title: string;
  topic: string;
  summary: string;
  sentences: Sentence[];
  questions: Question[];
}

const s = (text: string, speaker?: string): Sentence => (speaker ? { speaker, text } : { text });
const q = (id: string, question: string, options: [string, string, string, string], explanation: string, sentence: number): Question => ({
  id,
  question,
  options,
  explanation,
  sentence,
});

export const LIBRARY: LibraryText[] = [
  // ---------------- A1 ----------------
  {
    id: 'a1-cafe',
    level: 'A1',
    kind: 'dialogue',
    title: 'At the café',
    topic: 'Food & drink',
    summary: 'Tom orders breakfast at a small café.',
    sentences: [
      s('Good morning! What would you like?', 'Waiter'),
      s('Good morning. A coffee with milk, please.', 'Tom'),
      s('Small or large?', 'Waiter'),
      s('Large, please. And can I have a cheese sandwich?', 'Tom'),
      s("Sorry, we don't have cheese today. We have egg or chicken.", 'Waiter'),
      s('OK, an egg sandwich, please.', 'Tom'),
      s('Anything else?', 'Waiter'),
      s('No, thank you. How much is it?', 'Tom'),
      s("That's six pounds fifty.", 'Waiter'),
      s('Here you are. Thank you!', 'Tom'),
    ],
    questions: [
      q('q1', 'What does Tom drink?', ['A large coffee with milk', 'A small tea', 'Orange juice', 'A large coffee without milk'], 'Tom asks for a coffee with milk, and then says "Large, please."', 3),
      q('q2', 'Why does Tom not get a cheese sandwich?', ["The café has no cheese today", 'He does not like cheese', 'It is too expensive', 'The café is closed'], 'The waiter says: "We don\'t have cheese today."', 4),
      q('q3', 'How much does Tom pay?', ['£6.50', '£5.60', '£6.15', '£16.50'], 'The waiter says: "That\'s six pounds fifty."', 8),
    ],
  },
  {
    id: 'a1-flat',
    level: 'A1',
    kind: 'story',
    title: 'My new flat',
    topic: 'Home',
    summary: 'Maria describes the flat she just moved into.',
    sentences: [
      s('My name is Maria and I have a new flat.'),
      s('It is in the city centre, near the train station.'),
      s('The flat is small, but it is very bright.'),
      s('There is one bedroom, a kitchen and a bathroom.'),
      s('My favourite room is the kitchen because it has a big window.'),
      s('From the window, I can see a park.'),
      s('I do not have a sofa yet, so I sit on the floor!'),
      s('On Saturday, my brother is coming to help me buy furniture.'),
    ],
    questions: [
      q('q1', 'Where is the flat?', ['Near the train station', 'Next to a school', 'Outside the city', 'Near the sea'], 'Maria says it is in the city centre, near the train station.', 1),
      q('q2', 'Why does Maria like the kitchen?', ['It has a big window', 'It is very big', 'It is new', 'It has a sofa'], 'Her favourite room is the kitchen "because it has a big window."', 4),
      q('q3', 'What will happen on Saturday?', ['Her brother will help her buy furniture', 'She will move to a new flat', 'She will paint the kitchen', 'She will go to the park'], 'On Saturday her brother is coming to help her buy furniture.', 7),
    ],
  },
  {
    id: 'a1-park',
    level: 'A1',
    kind: 'story',
    title: 'A day at the park',
    topic: 'Free time',
    summary: 'A family spends a sunny Sunday in the park.',
    sentences: [
      s('It is Sunday and the weather is sunny and warm.'),
      s('Ali and his family go to the park.'),
      s('His mother brings sandwiches, fruit and water.'),
      s('Ali and his sister play football on the grass.'),
      s('Their father reads a book under a tree.'),
      s('At one o\'clock, they eat lunch together.'),
      s('In the afternoon, it starts to rain, so they go home by bus.'),
      s('It is a short day, but everyone is happy.'),
    ],
    questions: [
      q('q1', 'What does Ali play?', ['Football', 'Tennis', 'Basketball', 'Cards'], 'Ali and his sister play football on the grass.', 3),
      q('q2', 'What does Ali\'s father do?', ['He reads a book', 'He plays football', 'He makes sandwiches', 'He sleeps'], 'Their father reads a book under a tree.', 4),
      q('q3', 'Why do they go home?', ['It starts to rain', 'It gets dark', 'The park closes', 'They are tired'], 'In the afternoon it starts to rain, so they go home.', 6),
    ],
  },

  // ---------------- A2 ----------------
  {
    id: 'a2-luggage',
    level: 'A2',
    kind: 'dialogue',
    title: 'Lost luggage',
    topic: 'Travel',
    summary: "Sara's suitcase doesn't arrive after her flight.",
    sentences: [
      s('Hello, can I help you?', 'Agent'),
      s('Yes, I hope so. My suitcase didn\'t come out with the others.', 'Sara'),
      s('I\'m sorry to hear that. Which flight were you on?', 'Agent'),
      s('The ten o\'clock flight from Madrid.', 'Sara'),
      s('Can you describe the suitcase, please?', 'Agent'),
      s('It\'s a large blue suitcase with a red ribbon on the handle.', 'Sara'),
      s('Thank you. I can see it\'s still in Madrid. It will arrive on the next flight this evening.', 'Agent'),
      s('Oh no. I need my clothes for a meeting tomorrow morning.', 'Sara'),
      s('Don\'t worry. We can bring it to your hotel tonight, before ten.', 'Agent'),
      s('That would be great. I\'m staying at the Park Hotel.', 'Sara'),
    ],
    questions: [
      q('q1', 'What does Sara\'s suitcase look like?', ['Large and blue, with a red ribbon', 'Small and red', 'Large and black, with a blue ribbon', 'Blue, with her name on it'], 'Sara says: "It\'s a large blue suitcase with a red ribbon on the handle."', 5),
      q('q2', 'Where is the suitcase now?', ['Still in Madrid', 'At the Park Hotel', 'On the plane', 'Lost forever'], 'The agent says: "I can see it\'s still in Madrid."', 6),
      q('q3', 'Why is Sara worried?', ['She needs her clothes for a meeting', 'She has no hotel', 'She will miss her flight', 'She lost her passport'], 'She needs her clothes for a meeting tomorrow morning.', 7),
    ],
  },
  {
    id: 'a2-cooking',
    level: 'A2',
    kind: 'story',
    title: 'The cooking class',
    topic: 'Food & drink',
    summary: 'Jun tries an Italian cooking class for the first time.',
    sentences: [
      s('Last Thursday, Jun went to his first cooking class.'),
      s('The teacher, Luca, is from Naples and he teaches Italian food.'),
      s('There were eight students in the class, and most of them were beginners like Jun.'),
      s('First, they made fresh pasta with flour, eggs and a little salt.'),
      s('It was harder than Jun expected, and his pasta was not very pretty.'),
      s('Then they cooked a simple tomato sauce with garlic and basil.'),
      s('At the end of the class, everyone ate together and talked.'),
      s('Jun\'s pasta tasted great, even if it looked strange.'),
      s('He has already booked the next class, where they will make pizza.'),
    ],
    questions: [
      q('q1', 'What did the students make first?', ['Fresh pasta', 'Pizza', 'Tomato sauce', 'Bread'], 'First, they made fresh pasta with flour, eggs and a little salt.', 3),
      q('q2', 'What was the problem with Jun\'s pasta?', ['It did not look very nice', 'It tasted bad', 'It was too salty', 'It was not cooked'], 'His pasta "was not very pretty", but it tasted great.', 4),
      q('q3', 'What will they make in the next class?', ['Pizza', 'Pasta again', 'Soup', 'A cake'], 'He booked the next class, where they will make pizza.', 8),
    ],
  },
  {
    id: 'a2-doctor',
    level: 'A2',
    kind: 'dialogue',
    title: "Calling the doctor's",
    topic: 'Health',
    summary: 'Omar calls to make an appointment because he feels ill.',
    sentences: [
      s('Good morning, Green Street Surgery.', 'Receptionist'),
      s('Hello. I\'d like to make an appointment with a doctor, please.', 'Omar'),
      s('Of course. What\'s the problem?', 'Receptionist'),
      s('I\'ve had a bad headache and a sore throat for three days.', 'Omar'),
      s('I see. The first appointment is on Wednesday at half past two.', 'Receptionist'),
      s('Is there anything earlier? I feel quite ill.', 'Omar'),
      s('Let me check. Someone cancelled, so we have one today at four o\'clock.', 'Receptionist'),
      s('Perfect, I\'ll take that one.', 'Omar'),
      s('Can I have your name and date of birth, please?', 'Receptionist'),
    ],
    questions: [
      q('q1', 'How long has Omar felt ill?', ['Three days', 'One day', 'A week', 'Two hours'], 'He has had a headache and a sore throat for three days.', 3),
      q('q2', 'When is Omar\'s appointment?', ['Today at four o\'clock', 'Wednesday at half past two', 'Tomorrow morning', 'Today at half past two'], 'Someone cancelled, so he takes the appointment today at four.', 6),
      q('q3', 'Why can Omar see the doctor earlier?', ['Someone cancelled', 'The doctor works late', 'It is an emergency', 'He paid extra'], 'The receptionist says: "Someone cancelled."', 6),
    ],
  },

  // ---------------- B1 ----------------
  {
    id: 'b1-interview',
    level: 'B1',
    kind: 'dialogue',
    title: 'The job interview',
    topic: 'Work',
    summary: 'Priya interviews for a job at a travel company.',
    sentences: [
      s('Thanks for coming in, Priya. Could you tell us a little about yourself?', 'Manager'),
      s('Of course. I studied tourism, and for the last two years I\'ve worked at a hotel reception.', 'Priya'),
      s('Why do you want to leave the hotel?', 'Manager'),
      s('I enjoy the job, but I\'d like to help people plan whole trips, not just their stay.', 'Priya'),
      s('What would you say is your biggest strength?', 'Manager'),
      s('I stay calm under pressure. Last summer we had a problem with forty bookings, and I sorted it out in one afternoon.', 'Priya'),
      s('And a weakness?', 'Manager'),
      s('I used to find it hard to say no to extra work, but I\'ve learned to plan my time better.', 'Priya'),
      s('That\'s honest. Do you have any questions for us?', 'Manager'),
      s('Yes. What does a typical day look like for someone in this role?', 'Priya'),
    ],
    questions: [
      q('q1', 'What is Priya\'s job now?', ['She works at a hotel reception', 'She is a tour guide', 'She studies tourism', 'She works at a travel company'], 'For the last two years she has worked at a hotel reception.', 1),
      q('q2', 'Why does she want the new job?', ['She wants to help plan whole trips', 'She wants more money', 'She dislikes the hotel', 'She wants to travel more'], 'She would like to help people plan whole trips, not just their stay.', 3),
      q('q3', 'What example does she give of her strength?', ['She fixed a problem with forty bookings quickly', 'She learned a new language', 'She managed a team', 'She worked every weekend'], 'She sorted out a problem with forty bookings in one afternoon.', 5),
    ],
  },
  {
    id: 'b1-village',
    level: 'B1',
    kind: 'story',
    title: 'A village without cars',
    topic: 'Places',
    summary: 'A small village decides to ban cars from its centre.',
    sentences: [
      s('Five years ago, the people of Lindholm voted to ban cars from the centre of their village.'),
      s('At first, many shop owners were worried that they would lose customers.'),
      s('The village built a large car park outside the centre and started a free electric bus.'),
      s('Within a year, the main street had become a place for markets, cafés and children playing.'),
      s('Surprisingly, the shops did better than before, because people stayed longer and walked past more windows.'),
      s('Not everyone is happy, though.'),
      s('Some older residents say it is now harder to carry heavy shopping home.'),
      s('To help them, the village now offers a delivery service by bicycle.'),
      s('Other towns in the region are watching closely and thinking about doing the same.'),
    ],
    questions: [
      q('q1', 'What were shop owners afraid of at first?', ['Losing customers', 'Paying more tax', 'Noisy markets', 'Closing early'], 'Many shop owners were worried that they would lose customers.', 1),
      q('q2', 'Why did the shops do better?', ['People stayed longer and walked past more shops', 'Prices went down', 'More tourists came by car', 'The bus stopped at every shop'], 'People stayed longer and walked past more windows.', 4),
      q('q3', 'How does the village help older residents?', ['A bicycle delivery service', 'Free taxis', 'Special parking places', 'A shop near their homes'], 'The village offers a delivery service by bicycle.', 7),
    ],
  },
  {
    id: 'b1-no',
    level: 'B1',
    kind: 'story',
    title: 'Learning to say no',
    topic: 'Everyday life',
    summary: 'Daniel realises that saying yes to everything is making him unhappy.',
    sentences: [
      s('Daniel was the kind of person who always said yes.'),
      s('If a colleague needed help, he stayed late; if a friend was moving house, he carried the boxes.'),
      s('Everyone liked him, but he was always tired and never had time for his own plans.'),
      s('One evening he realised that he hadn\'t played his guitar for almost a year.'),
      s('He decided to try an experiment: for one month, he would think for a moment before saying yes.'),
      s('The first time he said no, to a weekend shift, he felt terrible.'),
      s('But his manager simply said, "No problem, I\'ll ask someone else."'),
      s('By the end of the month, Daniel was sleeping better and had started a guitar course.'),
      s('He still helps people, but now he chooses when.'),
    ],
    questions: [
      q('q1', 'What was Daniel\'s problem?', ['He said yes to everything and had no time for himself', 'His colleagues did not like him', 'He could not find a job', 'He was bad at the guitar'], 'Everyone liked him, but he was always tired and had no time for his own plans.', 2),
      q('q2', 'What did Daniel notice one evening?', ['He hadn\'t played his guitar for almost a year', 'He was late for work', 'His friend was moving house', 'He had lost his guitar'], 'He realised he hadn\'t played his guitar for almost a year.', 3),
      q('q3', 'How did his manager react to the first no?', ['Calmly: he would ask someone else', 'He was angry', 'He gave Daniel more work', 'He offered more money'], 'His manager simply said, "No problem, I\'ll ask someone else."', 6),
    ],
  },

  // ---------------- B2 ----------------
  {
    id: 'b2-fourday',
    level: 'B2',
    kind: 'article',
    title: 'The four-day week',
    topic: 'Work',
    summary: 'What happened when a company let its staff work four days for the same pay.',
    sentences: [
      s('When a medium-sized software company announced that its staff would work four days a week for the same salary, many critics predicted disaster.'),
      s('Six months later, the results have surprised almost everyone.'),
      s('Productivity, measured by finished projects, rose by around ten percent.'),
      s('Sick days fell sharply, and the company found it much easier to attract new employees.'),
      s('Managers say the key was cutting unnecessary meetings, which used to fill a third of the week.'),
      s('However, the change has not been easy for every team.'),
      s('The customer support department still needs people available five days a week, so its staff work in rotating shifts.'),
      s('Some employees also admit that their working days now feel more intense.'),
      s('Even so, when the company asked whether people wanted to go back, fewer than five percent said yes.'),
    ],
    questions: [
      q('q1', 'According to managers, what made the change work?', ['Cutting unnecessary meetings', 'Hiring more staff', 'Longer working days', 'New software'], 'Managers say the key was cutting unnecessary meetings.', 4),
      q('q2', 'How did customer support solve its problem?', ['Staff work in rotating shifts', 'It closed on Fridays', 'It hired a new team', 'It used a chatbot'], 'Its staff work in rotating shifts so someone is there five days a week.', 6),
      q('q3', 'What is a downside some employees mention?', ['Working days feel more intense', 'Their pay went down', 'They lost holidays', 'They work at weekends'], 'Some employees admit their working days now feel more intense.', 7),
    ],
  },
  {
    id: 'b2-neighbour',
    level: 'B2',
    kind: 'dialogue',
    title: 'A difficult neighbour',
    topic: 'Home',
    summary: 'Elena talks to her neighbour about the noise at night.',
    sentences: [
      s('Hi, sorry to bother you. Have you got a minute?', 'Elena'),
      s('Sure, what\'s up?', 'Mark'),
      s('It\'s a bit awkward, but the music from your flat has been quite loud late at night recently.', 'Elena'),
      s('Oh, really? I had no idea it carried that far.', 'Mark'),
      s('I start work at six, so I\'m usually in bed by ten, and it\'s been keeping me awake.', 'Elena'),
      s('I\'m really sorry. My band has been practising here because our usual room was closed.', 'Mark'),
      s('That makes sense. Would it be possible to stop by ten on weekdays?', 'Elena'),
      s('Absolutely. And our room reopens next month, so it won\'t be for long.', 'Mark'),
      s('Thanks for being so understanding. I was worried this would turn into an argument.', 'Elena'),
      s('Not at all. I\'d much rather you told me than just put up with it.', 'Mark'),
    ],
    questions: [
      q('q1', 'Why is the noise a problem for Elena?', ['She starts work very early', 'She works from home', 'She has a baby', 'She is studying for exams'], 'She starts work at six, so she goes to bed by ten.', 4),
      q('q2', 'Why has Mark been playing music at home?', ['His band\'s usual room was closed', 'He just bought new speakers', 'He is having a party', 'He is learning the drums'], 'His band has been practising there because their usual room was closed.', 5),
      q('q3', 'What do they agree?', ['The music will stop by ten on weekdays', 'Mark will move out', 'Elena will buy earplugs', 'The band will play only at weekends'], 'Elena asks him to stop by ten on weekdays and he agrees.', 6),
    ],
  },
  {
    id: 'b2-forget',
    level: 'B2',
    kind: 'article',
    title: 'Why we forget',
    topic: 'Science',
    summary: 'Forgetting is not a failure of memory: it may help us think.',
    sentences: [
      s('We usually think of forgetting as a weakness, something that goes wrong in our brains.'),
      s('Yet many researchers now argue that forgetting is an essential part of how memory works.'),
      s('Every day we take in far more information than we could ever use.'),
      s('If we remembered everything, finding the one detail we need would become slower and harder.'),
      s('By letting unimportant memories fade, the brain keeps the useful ones easier to reach.'),
      s('This is also why reviewing something just before you are about to forget it is so effective.'),
      s('Each time you recall a fact with a little effort, the memory becomes stronger and lasts longer.'),
      s('In other words, a little forgetting, followed by remembering, is exactly what helps us learn.'),
    ],
    questions: [
      q('q1', 'What is the main idea of the article?', ['Forgetting is a useful part of memory', 'Forgetting is a sign of illness', 'We should try to remember everything', 'Memory gets worse with age'], 'Researchers argue that forgetting is an essential part of how memory works.', 1),
      q('q2', 'What would happen if we remembered everything?', ['Finding the detail we need would be harder', 'We would learn faster', 'We would never feel tired', 'We would need less sleep'], 'Finding the one detail we need would become slower and harder.', 3),
      q('q3', 'When is reviewing most effective?', ['Just before you are about to forget', 'Immediately after learning', 'Once a year', 'Only when you have forgotten completely'], 'Reviewing something just before you are about to forget it is so effective.', 5),
    ],
  },

  // ---------------- C1 ----------------
  {
    id: 'c1-choice',
    level: 'C1',
    kind: 'article',
    title: 'The paradox of choice',
    topic: 'Society',
    summary: 'Why having more options can leave us less satisfied.',
    sentences: [
      s('It seems self-evident that the more options we have, the better off we are.'),
      s('A wider choice should allow each of us to find exactly what suits us.'),
      s('Yet a growing body of research suggests that, beyond a certain point, abundance becomes a burden.'),
      s('In one well-known study, shoppers offered twenty-four kinds of jam were far less likely to buy any than those offered just six.'),
      s('Faced with too many alternatives, people tend to delay the decision, or avoid it altogether.'),
      s('Even when they do choose, they are often less content, haunted by the suspicion that another option would have been better.'),
      s('This does not mean that choice is bad, but that its benefits are not unlimited.'),
      s('Deliberately narrowing our options, and accepting "good enough", may be one of the simplest ways to feel more satisfied.'),
    ],
    questions: [
      q('q1', 'What did the jam study show?', ['Fewer options led to more people buying', 'People preferred twenty-four kinds of jam', 'Price matters more than choice', 'Shoppers bought more when offered more'], 'Shoppers offered twenty-four kinds were far less likely to buy than those offered six.', 3),
      q('q2', 'Why can people be less content after choosing from many options?', ['They suspect another option would have been better', 'They paid too much', 'They chose too quickly', 'They had to wait in line'], 'They are haunted by the suspicion that another option would have been better.', 5),
      q('q3', 'What does the writer suggest?', ['Narrowing our options and accepting "good enough"', 'Always choosing the cheapest option', 'Avoiding shopping altogether', 'Asking others to choose for us'], 'Deliberately narrowing our options and accepting "good enough" may help.', 7),
    ],
  },
  {
    id: 'c1-raise',
    level: 'C1',
    kind: 'dialogue',
    title: 'Negotiating a raise',
    topic: 'Work',
    summary: 'Nadia makes the case for a pay rise in her annual review.',
    sentences: [
      s('So, Nadia, before we wrap up, was there anything else you wanted to raise?', 'Director'),
      s('Yes, actually. I\'d like to talk about my salary.', 'Nadia'),
      s('Go on.', 'Director'),
      s('Since last year my role has expanded considerably: I now manage two junior analysts and the quarterly client reports.', 'Nadia'),
      s('That\'s true, and you\'ve handled it well.', 'Director'),
      s('Thank you. Having looked at comparable positions in the industry, I believe a ten percent increase would reflect that.', 'Nadia'),
      s('I appreciate the preparation. To be candid, ten percent is beyond what the budget allows this year.', 'Director'),
      s('I understand. Would there be room for six percent now, with a review in six months tied to clear targets?', 'Nadia'),
      s('That sounds workable. Let me put it to finance and come back to you by Friday.', 'Director'),
    ],
    questions: [
      q('q1', 'What reason does Nadia give for a raise?', ['Her responsibilities have grown', 'She has worked there for ten years', 'Her colleagues earn more', 'She has another job offer'], 'Her role has expanded: she manages two analysts and the client reports.', 3),
      q('q2', 'How did Nadia decide on ten percent?', ['She compared similar jobs in the industry', 'A colleague suggested it', 'It is the company policy', 'She guessed'], 'She looked at comparable positions in the industry.', 5),
      q('q3', 'What compromise does Nadia propose?', ['Six percent now, and a review in six months', 'Ten percent next year', 'A bonus instead of a raise', 'Fewer working hours'], 'She suggests six percent now, with a review in six months tied to targets.', 7),
    ],
  },
  {
    id: 'c1-city',
    level: 'C1',
    kind: 'story',
    title: 'The city that listened',
    topic: 'Places',
    summary: 'A mayor tries an unusual way of finding out what citizens want.',
    sentences: [
      s('When Ana Ferreira became mayor, she inherited a city weary of promises.'),
      s('Turnout at local elections had fallen below a third, and public meetings were attended mostly by the same handful of people.'),
      s('Rather than launching another survey, she tried something unusual: a citizens\' assembly chosen by lottery.'),
      s('Forty residents, reflecting the city\'s mix of ages, incomes and neighbourhoods, met every other weekend for three months.'),
      s('They heard from experts, argued, changed their minds, and finally agreed on a set of recommendations about housing.'),
      s('Several were bolder than anything the council would have dared propose on its own.'),
      s('Critics dismissed the experiment as a publicity stunt, but the mayor committed in advance to respond to every recommendation in public.'),
      s('Two years on, most have been adopted, and, perhaps more tellingly, turnout at the last election rose for the first time in a decade.'),
    ],
    questions: [
      q('q1', 'How were the assembly members chosen?', ['By lottery', 'By election', 'By the mayor', 'They volunteered'], 'She tried a citizens\' assembly chosen by lottery.', 2),
      q('q2', 'What does the writer say about some recommendations?', ['They were bolder than the council would have proposed', 'They were impossible to adopt', 'They copied other cities', 'They were all about transport'], 'Several were bolder than anything the council would have dared propose.', 5),
      q('q3', 'What is presented as the most telling result?', ['Election turnout rose for the first time in a decade', 'The mayor was re-elected', 'House prices fell', 'Critics changed their minds'], '"Perhaps more tellingly", turnout rose for the first time in a decade.', 7),
    ],
  },
];

export const TEXT_BY_ID = new Map(LIBRARY.map((t) => [t.id, t]));

/** Rough reading time: about 150 words a minute for a learner, never under a minute */
export function readingMinutes(text: LibraryText): number {
  const words = text.sentences.reduce((n, x) => n + x.text.split(/\s+/).length, 0);
  return Math.max(1, Math.round(words / 150));
}

/** Simple string hash, for a stable per-reader shuffle */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The order to show a question's options in for one reader: shuffled, but the same every time they open
 * the text. `order[i]` is the index in the bank (0 = the right answer) of the option shown at position i.
 */
export function optionOrder(seed: string, count = 4): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  let state = hash(seed) || 1;
  for (let i = count - 1; i > 0; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
