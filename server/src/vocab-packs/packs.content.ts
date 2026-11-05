// server/src/vocab-packs/packs.content.ts
/**
 * Themed vocabulary packs: 12 words each with a simple English meaning and an example sentence. Kept in code
 * (like the library and grammar course) so wording can change without a migration.
 *
 * Rules the tests enforce: the example contains the word exactly as written (so a quiz can blank it out),
 * and every word id is unique inside its pack.
 */

export type PackLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const PACK_LEVELS: PackLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'phrasal verb' | 'idiom' | 'conjunction';

export interface PackWord {
  id: string;
  word: string;
  pos: PartOfSpeech;
  meaning: string;
  example: string;
}

export interface VocabPack {
  id: string;
  level: PackLevel;
  title: string;
  topic: string;
  /** A lucide icon name the web app knows */
  icon: string;
  summary: string;
  words: PackWord[];
}

const w = (id: string, word: string, pos: PartOfSpeech, meaning: string, example: string): PackWord => ({ id, word, pos, meaning, example });

export const PACKS: VocabPack[] = [
  {
    id: 'a1-daily-routines',
    level: 'A1',
    title: 'Daily routines',
    topic: 'Daily life',
    icon: 'Sunrise',
    summary: 'The words for your day, from waking up to bedtime.',
    words: [
      w('w1', 'wake up', 'phrasal verb', 'to stop sleeping and open your eyes', 'I wake up at six o\'clock.'),
      w('w2', 'brush', 'verb', 'to clean your teeth or tidy your hair using bristles on a handle', 'I brush my teeth after breakfast.'),
      w('w3', 'shower', 'noun', 'a wash under running water', 'She takes a shower every morning.'),
      w('w4', 'breakfast', 'noun', 'the first meal of the day', 'We eat breakfast together.'),
      w('w5', 'commute', 'verb', 'to travel to work or school regularly', 'I commute to work by bus.'),
      w('w6', 'homework', 'noun', 'school work you do at home', 'I do my homework after dinner.'),
      w('w7', 'nap', 'noun', 'a short sleep during the day', 'The baby takes a nap at noon.'),
      w('w8', 'chores', 'noun', 'small jobs you do at home, like cleaning', 'We share the household chores.'),
      w('w9', 'leave', 'verb', 'to go away from a place', 'I leave home at eight.'),
      w('w10', 'relax', 'verb', 'to rest and feel calm', 'I relax by listening to music.'),
      w('w11', 'schedule', 'noun', 'a plan that shows when things will happen', 'My schedule is very busy today.'),
      w('w12', 'bedtime', 'noun', 'the time when you go to bed', 'My bedtime is ten o\'clock.'),
    ],
  },
  {
    id: 'a1-food-drink',
    level: 'A1',
    title: 'Food and drink',
    topic: 'Daily life',
    icon: 'Utensils',
    summary: 'Order in a restaurant and talk about what you like to eat.',
    words: [
      w('w1', 'menu', 'noun', 'a list of food you can order in a restaurant', 'Can I see the menu, please?'),
      w('w2', 'order', 'verb', 'to ask for food or drink in a restaurant', 'I want to order a cup of tea.'),
      w('w3', 'bill', 'noun', 'the paper that shows how much you must pay', 'Can we have the bill, please?'),
      w('w4', 'delicious', 'adjective', 'tasting very good', 'This soup is delicious.'),
      w('w5', 'hungry', 'adjective', 'wanting to eat', 'I am very hungry.'),
      w('w6', 'thirsty', 'adjective', 'wanting to drink', 'He is thirsty after the game.'),
      w('w7', 'spicy', 'adjective', 'having a strong, hot taste', 'I like spicy food.'),
      w('w8', 'sweet', 'adjective', 'tasting like sugar', 'This tea is too sweet.'),
      w('w9', 'snack', 'noun', 'a small amount of food between meals', 'I eat a snack at four o\'clock.'),
      w('w10', 'recipe', 'noun', 'instructions for cooking a food', 'My mother shared her recipe with me.'),
      w('w11', 'vegetable', 'noun', 'a plant you eat, like a carrot or a potato', 'A carrot is a healthy vegetable.'),
      w('w12', 'bake', 'verb', 'to cook food in an oven', 'I like to bake bread.'),
    ],
  },
  {
    id: 'a2-travel',
    level: 'A2',
    title: 'Travel and airports',
    topic: 'Travel',
    icon: 'Plane',
    summary: 'Book a trip, get through the airport and find a place to stay.',
    words: [
      w('w1', 'passport', 'noun', 'an official document that lets you travel to other countries', 'Don\'t forget your passport.'),
      w('w2', 'luggage', 'noun', 'the bags you take when you travel', 'My luggage is very heavy.'),
      w('w3', 'ticket', 'noun', 'a paper or code that lets you travel or enter a place', 'I bought a train ticket online.'),
      w('w4', 'gate', 'noun', 'the door at an airport where you get on the plane', 'Your flight leaves from gate twelve.'),
      w('w5', 'delay', 'noun', 'when something happens later than planned', 'There is a one-hour delay.'),
      w('w6', 'book', 'verb', 'to arrange and pay for a room, seat or ticket', 'I need to book a hotel.'),
      w('w7', 'journey', 'noun', 'a long trip from one place to another', 'The journey takes five hours.'),
      w('w8', 'tourist', 'noun', 'a person who visits a place for fun', 'She is a tourist in this city.'),
      w('w9', 'reservation', 'noun', 'an arrangement to keep a room or table for you', 'I have a reservation for two.'),
      w('w10', 'destination', 'noun', 'the place you are travelling to', 'Paris is our final destination.'),
      w('w11', 'customs', 'noun', 'the place at an airport where officers check your bags', 'We waited in line at customs.'),
      w('w12', 'accommodation', 'noun', 'a place to stay, like a hotel', 'We found cheap accommodation near the beach.'),
    ],
  },
  {
    id: 'a2-shopping-money',
    level: 'A2',
    title: 'Shopping and money',
    topic: 'Daily life',
    icon: 'ShoppingBag',
    summary: 'Prices, paying, and getting a better deal.',
    words: [
      w('w1', 'price', 'noun', 'the amount of money you pay for something', 'What is the price of this shirt?'),
      w('w2', 'cheap', 'adjective', 'costing little money', 'These shoes are very cheap.'),
      w('w3', 'expensive', 'adjective', 'costing a lot of money', 'That watch is too expensive.'),
      w('w4', 'discount', 'noun', 'a lower price than usual', 'There is a ten percent discount today.'),
      w('w5', 'receipt', 'noun', 'a paper that shows you paid', 'Keep the receipt in case you need to return it.'),
      w('w6', 'cash', 'noun', 'money in notes and coins', 'Do you take cash or card?'),
      w('w7', 'change', 'noun', 'the money you get back when you pay too much', 'Here is your change.'),
      w('w8', 'afford', 'verb', 'to have enough money to buy something', 'I can\'t afford a new phone.'),
      w('w9', 'bargain', 'noun', 'something you buy for less than its normal price', 'This jacket was a real bargain.'),
      w('w10', 'refund', 'noun', 'money given back when you return something', 'I asked the shop for a refund.'),
      w('w11', 'cashier', 'noun', 'the person who takes your money in a shop', 'The cashier gave me a bag.'),
      w('w12', 'fit', 'verb', 'to be the right size', 'These trousers don\'t fit me.'),
    ],
  },
  {
    id: 'a2-health',
    level: 'A2',
    title: 'Health and the body',
    topic: 'Health',
    icon: 'HeartPulse',
    summary: 'Describe how you feel and what you need at the doctor or pharmacy.',
    words: [
      w('w1', 'headache', 'noun', 'a pain in your head', 'I have a terrible headache.'),
      w('w2', 'fever', 'noun', 'a high body temperature when you are ill', 'The child has a fever.'),
      w('w3', 'medicine', 'noun', 'something you take to get better', 'Take this medicine twice a day.'),
      w('w4', 'appointment', 'noun', 'a planned time to see someone, like a doctor', 'I have a doctor\'s appointment at ten.'),
      w('w5', 'symptom', 'noun', 'a sign that you are ill', 'A cough is a common symptom of a cold.'),
      w('w6', 'cough', 'verb', 'to push air out of your throat with a noise', 'I cough a lot at night.'),
      w('w7', 'sore', 'adjective', 'painful, especially when touched', 'My throat is sore.'),
      w('w8', 'injury', 'noun', 'damage to your body, like a broken leg', 'He missed the match because of an injury.'),
      w('w9', 'recover', 'verb', 'to become well again after being ill', 'It took a week to recover from the flu.'),
      w('w10', 'pharmacy', 'noun', 'a shop where you buy medicine', 'The pharmacy is next to the bank.'),
      w('w11', 'rest', 'verb', 'to relax or sleep to get your strength back', 'You need to rest for a few days.'),
      w('w12', 'healthy', 'adjective', 'strong and well', 'She eats healthy food.'),
    ],
  },
  {
    id: 'b1-work',
    level: 'B1',
    title: 'Work and careers',
    topic: 'Work',
    icon: 'Briefcase',
    summary: 'Talk about your job, interviews, and life in an office.',
    words: [
      w('w1', 'colleague', 'noun', 'a person you work with', 'My colleague helped me with the report.'),
      w('w2', 'deadline', 'noun', 'the time by which you must finish something', 'The deadline is next Friday.'),
      w('w3', 'meeting', 'noun', 'a time when people come together to talk about work', 'We have a meeting at three.'),
      w('w4', 'salary', 'noun', 'the money you get every month for your job', 'He earns a good salary.'),
      w('w5', 'promotion', 'noun', 'a move to a better job in the same company', 'She got a promotion last year.'),
      w('w6', 'application', 'noun', 'a request for a job or a place', 'I sent my application yesterday.'),
      w('w7', 'interview', 'noun', 'a meeting where you answer questions to get a job', 'I have a job interview tomorrow.'),
      w('w8', 'manage', 'verb', 'to control or be in charge of something', 'I help to manage a small team.'),
      w('w9', 'experience', 'noun', 'knowledge you get from doing something', 'He has five years of experience.'),
      w('w10', 'responsible', 'adjective', 'having the duty to take care of something', 'I am responsible for the website.'),
      w('w11', 'overtime', 'noun', 'extra hours you work after your normal hours', 'We worked overtime to finish the project.'),
      w('w12', 'resign', 'verb', 'to officially leave your job', 'She decided to resign next month.'),
    ],
  },
  {
    id: 'b1-phrasal-verbs',
    level: 'B1',
    title: 'Everyday phrasal verbs',
    topic: 'Daily life',
    icon: 'Puzzle',
    summary: 'Two-word verbs that native speakers use all the time.',
    words: [
      w('w1', 'give up', 'phrasal verb', 'to stop trying', 'Don\'t give up on your dreams.'),
      w('w2', 'look after', 'phrasal verb', 'to take care of someone or something', 'She has to look after her little brother.'),
      w('w3', 'find out', 'phrasal verb', 'to learn a fact or the truth', 'I want to find out the truth.'),
      w('w4', 'turn down', 'phrasal verb', 'to say no to an offer', 'He decided to turn down the job.'),
      w('w5', 'run out of', 'phrasal verb', 'to use all of something so there is none left', 'We might run out of milk.'),
      w('w6', 'put off', 'phrasal verb', 'to delay something until later', 'Don\'t put off your homework.'),
      w('w7', 'get along', 'phrasal verb', 'to have a friendly relationship with someone', 'I get along well with my neighbours.'),
      w('w8', 'take off', 'phrasal verb', 'to leave the ground, like a plane', 'The plane will take off in ten minutes.'),
      w('w9', 'carry on', 'phrasal verb', 'to continue doing something', 'Please carry on with your work.'),
      w('w10', 'set up', 'phrasal verb', 'to start or arrange something new', 'They plan to set up a new business.'),
      w('w11', 'come across', 'phrasal verb', 'to find or meet something by chance', 'You may come across some old photos.'),
      w('w12', 'work out', 'phrasal verb', 'to find the answer to a problem', 'We need to work out a plan.'),
    ],
  },
  {
    id: 'b1-feelings',
    level: 'B1',
    title: 'Feelings and emotions',
    topic: 'People',
    icon: 'Smile',
    summary: 'Go beyond "happy" and "sad" with words that say exactly how you feel.',
    words: [
      w('w1', 'anxious', 'adjective', 'worried and nervous', 'I feel anxious before exams.'),
      w('w2', 'delighted', 'adjective', 'very pleased', 'She was delighted with the gift.'),
      w('w3', 'disappointed', 'adjective', 'sad because something was not as good as you hoped', 'I was disappointed with the result.'),
      w('w4', 'embarrassed', 'adjective', 'feeling shy or uncomfortable in front of other people', 'He felt embarrassed when he forgot her name.'),
      w('w5', 'furious', 'adjective', 'extremely angry', 'My dad was furious about the mess.'),
      w('w6', 'grateful', 'adjective', 'feeling thankful', 'I am grateful for your help.'),
      w('w7', 'jealous', 'adjective', 'unhappy because someone has something you want', 'She was jealous of her sister\'s success.'),
      w('w8', 'relieved', 'adjective', 'happy because a worry has gone away', 'We were relieved when the test was over.'),
      w('w9', 'confident', 'adjective', 'sure about your own ability', 'He feels confident about the interview.'),
      w('w10', 'curious', 'adjective', 'wanting to know or learn more', 'The children were curious about the animals.'),
      w('w11', 'annoyed', 'adjective', 'a little angry', 'I get annoyed when people are late.'),
      w('w12', 'convinced', 'adjective', 'completely sure about something', 'I am convinced that he is right.'),
    ],
  },
  {
    id: 'b2-academic',
    level: 'B2',
    title: 'Academic and IELTS words',
    topic: 'Study',
    icon: 'GraduationCap',
    summary: 'Useful words for essays, reports and exams.',
    words: [
      w('w1', 'analyse', 'verb', 'to study something carefully to understand it', 'We need to analyse the data.'),
      w('w2', 'significant', 'adjective', 'important or large enough to notice', 'There was a significant increase in sales.'),
      w('w3', 'evidence', 'noun', 'facts that show something is true', 'There is no evidence for that claim.'),
      w('w4', 'approach', 'noun', 'a way of dealing with something', 'She took a new approach to the problem.'),
      w('w5', 'issue', 'noun', 'an important topic or problem', 'Climate change is a major issue.'),
      w('w6', 'impact', 'noun', 'a strong effect on something', 'Social media has a big impact on teenagers.'),
      w('w7', 'whereas', 'conjunction', 'used to compare two different things', 'Tom likes tea, whereas Anna prefers coffee.'),
      w('w8', 'consequence', 'noun', 'a result of something that happened', 'Every action has a consequence.'),
      w('w9', 'reliable', 'adjective', 'able to be trusted', 'This is a reliable source of information.'),
      w('w10', 'contrast', 'noun', 'a clear difference between two things', 'There is a sharp contrast between the two cities.'),
      w('w11', 'estimate', 'verb', 'to guess an amount or number', 'They estimate that five thousand people came.'),
      w('w12', 'sufficient', 'adjective', 'enough for what you need', 'There is sufficient time to finish the test.'),
    ],
  },
  {
    id: 'c1-idioms',
    level: 'C1',
    title: 'Advanced idioms',
    topic: 'Expressions',
    icon: 'Sparkles',
    summary: 'Colourful expressions that make your English sound natural.',
    words: [
      w('w1', 'a blessing in disguise', 'idiom', 'something that seems bad but turns out well', 'Losing that job was a blessing in disguise.'),
      w('w2', 'break the ice', 'idiom', 'to make people feel relaxed when they first meet', 'He told a joke to break the ice.'),
      w('w3', 'hit the nail on the head', 'idiom', 'to say exactly the right thing', 'You hit the nail on the head with that comment.'),
      w('w4', 'bite the bullet', 'idiom', 'to do something difficult that you have avoided', 'I had to bite the bullet and apologise.'),
      w('w5', 'the last straw', 'idiom', 'the final problem that makes you lose patience', 'His rude reply was the last straw.'),
      w('w6', 'under the weather', 'idiom', 'slightly ill', 'I\'m feeling a bit under the weather today.'),
      w('w7', 'once in a blue moon', 'idiom', 'very rarely', 'We eat out once in a blue moon.'),
      w('w8', 'cut corners', 'idiom', 'to do something badly to save time or money', 'Never cut corners on safety.'),
      w('w9', 'on the fence', 'idiom', 'not able to decide', 'I\'m still on the fence about moving abroad.'),
      w('w10', 'call it a day', 'idiom', 'to stop working for today', 'It\'s late, so let\'s call it a day.'),
      w('w11', 'a piece of cake', 'idiom', 'something very easy', 'The exam was a piece of cake.'),
      w('w12', 'spill the beans', 'idiom', 'to tell a secret', 'Please don\'t spill the beans about the party.'),
    ],
  },
];

export const PACK_BY_ID = new Map(PACKS.map((p) => [p.id, p]));
export const TOTAL_PACK_WORDS = PACKS.reduce((n, p) => n + p.words.length, 0);
