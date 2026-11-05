// server/src/roleplay/roleplay.content.ts
/**
 * Guided role-play: everyday situations as short conversations. The app reads the other person's lines; at
 * each of your turns you pick one of two natural replies and say it aloud. Kept in code so the wording can
 * change without a migration.
 */

export type ScenarioLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
export const SCENARIO_LEVELS: ScenarioLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

export interface Exchange {
  /** What the other person says */
  partner: string;
  /** Two good replies; either is fine */
  replies: [string, string];
}

export interface Scenario {
  id: string;
  level: ScenarioLevel;
  title: string;
  /** One line that sets the scene */
  setting: string;
  /** Who you are, and who you talk to */
  you: string;
  partner: string;
  /** A lucide icon name the web app knows */
  icon: string;
  exchanges: Exchange[];
  /** What the other person says at the end */
  closing: string;
  phrases: Array<{ phrase: string; use: string }>;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'a1-cafe',
    level: 'A1',
    title: 'Ordering at a café',
    setting: 'You walk into a busy café and go to the counter.',
    you: 'Customer',
    partner: 'Barista',
    icon: 'Coffee',
    exchanges: [
      { partner: 'Hi! What can I get for you?', replies: ['Can I have a cup of tea, please?', "I'd like a coffee with milk, please."] },
      { partner: 'Sure. What size would you like, small or large?', replies: ['A small one, please.', 'Large, please.'] },
      { partner: 'Would you like anything to eat?', replies: ['Yes, a piece of chocolate cake, please.', 'No, thank you. Just the drink.'] },
      { partner: 'Is that for here or to take away?', replies: ['For here, please.', 'To take away, please.'] },
      { partner: "That's four dollars fifty, please.", replies: ['Here you are.', 'Can I pay by card?'] },
    ],
    closing: 'Thank you! Have a nice day.',
    phrases: [
      { phrase: 'Can I have ..., please?', use: 'The easiest polite way to order' },
      { phrase: "I'd like ...", use: 'Another polite way to ask for something' },
      { phrase: 'For here or to take away?', use: 'Eating in the café, or taking it with you' },
      { phrase: 'Here you are.', use: 'What you say when you give someone something' },
    ],
  },
  {
    id: 'a1-meeting-someone',
    level: 'A1',
    title: 'Meeting someone new',
    setting: 'It is your first day in an English class. The person next to you says hello.',
    you: 'New student',
    partner: 'Sam, a classmate',
    icon: 'Hand',
    exchanges: [
      { partner: "Hi! I'm Sam. What's your name?", replies: ["Hi Sam, I'm Rina. Nice to meet you.", 'Hello! My name is Arif.'] },
      { partner: 'Nice to meet you too. Where are you from?', replies: ["I'm from Bangladesh.", "I'm from Dhaka, in Bangladesh."] },
      { partner: 'Cool! What do you do?', replies: ["I'm a student.", 'I work in a bank.'] },
      { partner: 'What do you like doing in your free time?', replies: ['I like playing football.', 'I love reading and watching films.'] },
      { partner: 'Me too! Do you want to have coffee after class?', replies: ["Yes, I'd love to!", "Sorry, I'm busy today. Maybe tomorrow?"] },
    ],
    closing: 'Great. See you later!',
    phrases: [
      { phrase: 'Nice to meet you.', use: 'When you meet someone for the first time' },
      { phrase: "I'm from ...", use: 'Saying where you come from' },
      { phrase: 'What do you do?', use: 'Asking about someone\'s job or studies' },
      { phrase: "I'd love to!", use: 'Saying yes to an invitation, happily' },
    ],
  },
  {
    id: 'a2-hotel',
    level: 'A2',
    title: 'Checking in at a hotel',
    setting: 'You arrive at your hotel after a long journey.',
    you: 'Guest',
    partner: 'Receptionist',
    icon: 'BedDouble',
    exchanges: [
      { partner: 'Good evening. Welcome to the Park Hotel. How can I help you?', replies: ['Hi, I have a reservation. My name is Karim Ahmed.', "Good evening. I'd like to check in, please."] },
      { partner: 'Let me see. Yes, a double room for three nights. Can I see your passport, please?', replies: ['Of course. Here it is.', 'Sure, here you go.'] },
      { partner: 'Thank you. Breakfast is from seven to ten. Would you like it included?', replies: ['Yes, please. How much does it cost?', "No, thanks. I'll eat outside."] },
      { partner: "Your room is on the fourth floor. Here's your key card.", replies: ["Thank you. What's the Wi-Fi password?", 'Thanks. Is there a lift?'] },
      { partner: 'Do you need any help with your luggage?', replies: ['No, thank you. I can manage.', 'Yes, please. My bag is quite heavy.'] },
    ],
    closing: 'Enjoy your stay!',
    phrases: [
      { phrase: "I'd like to check in, please.", use: 'Starting at the hotel desk' },
      { phrase: 'I have a reservation.', use: 'You booked the room before' },
      { phrase: 'Is breakfast included?', use: 'Asking if breakfast is part of the price' },
      { phrase: 'I can manage.', use: 'Politely saying you do not need help' },
    ],
  },
  {
    id: 'a2-directions',
    level: 'A2',
    title: 'Asking for directions',
    setting: 'You are in a new city and cannot find your way.',
    you: 'Visitor',
    partner: 'A local person',
    icon: 'Map',
    exchanges: [
      { partner: 'Hi, you look lost. Can I help?', replies: ['Yes, please. How do I get to the train station?', 'Excuse me, where is the nearest bank?'] },
      { partner: 'Go straight on and turn left at the traffic lights.', replies: ['Turn left at the traffic lights. OK.', 'Sorry, could you say that again, please?'] },
      { partner: "Then it's on your right, next to the post office.", replies: ['Is it far from here?', 'How long does it take to walk there?'] },
      { partner: 'About ten minutes on foot.', replies: ['Great. Is there a bus too?', "Perfect, I'll walk."] },
      { partner: 'Yes, the number twelve bus stops right there.', replies: ['Thank you so much for your help.', 'Thanks a lot. Have a good day!'] },
    ],
    closing: "You're welcome. Good luck!",
    phrases: [
      { phrase: 'How do I get to ...?', use: 'Asking the way to a place' },
      { phrase: 'Could you say that again, please?', use: 'When you did not understand' },
      { phrase: 'Is it far from here?', use: 'Asking about the distance' },
      { phrase: 'on foot', use: 'Walking' },
    ],
  },
  {
    id: 'a2-doctor',
    level: 'A2',
    title: "At the doctor's",
    setting: 'You have not felt well for a few days, so you go to see a doctor.',
    you: 'Patient',
    partner: 'Doctor',
    icon: 'Stethoscope',
    exchanges: [
      { partner: 'Hello, come in. What seems to be the problem?', replies: ["I've had a bad headache for two days.", 'I have a sore throat and a cough.'] },
      { partner: 'I see. Do you have a fever?', replies: ['Yes, I think so. I feel very hot.', "No, I don't think so."] },
      { partner: 'Are you taking any medicine at the moment?', replies: ["No, I'm not.", "Yes, I'm taking some painkillers."] },
      { partner: "You need to rest and drink plenty of water. I'll give you a prescription.", replies: ['How often should I take the medicine?', 'Thank you. When should I come back?'] },
      { partner: "Twice a day, after meals. Come back if you don't feel better in a week.", replies: ['OK, I will. Thank you, doctor.', 'Thank you very much.'] },
    ],
    closing: 'Get well soon.',
    phrases: [
      { phrase: 'What seems to be the problem?', use: 'What a doctor asks first' },
      { phrase: "I've had ... for two days.", use: 'Saying how long you have been ill' },
      { phrase: 'a prescription', use: 'A paper from the doctor to get medicine' },
      { phrase: 'How often should I take it?', use: 'Asking how many times a day' },
    ],
  },
  {
    id: 'b1-job-interview',
    level: 'B1',
    title: 'A job interview',
    setting: 'You are in a job interview for a role you really want.',
    you: 'Candidate',
    partner: 'Interviewer',
    icon: 'Briefcase',
    exchanges: [
      {
        partner: 'Thanks for coming in. Could you tell me a little about yourself?',
        replies: ["Sure. I studied business, and I've worked in sales for three years.", "Of course. I'm a recent graduate and I'm really interested in marketing."],
      },
      {
        partner: 'Why do you want to work for our company?',
        replies: ["I really admire your products, and I'd like to grow with a company like yours.", "I've heard great things about your team, and the role matches my skills."],
      },
      { partner: 'What would you say is your biggest strength?', replies: ["I'm very organised, and I always meet my deadlines.", "I'm good at working with people and solving problems."] },
      {
        partner: 'Can you tell me about a difficult situation at work and how you handled it?',
        replies: ['Once a client was unhappy, so I listened carefully and we found a solution together.', 'We had a very tight deadline, so I made a plan and shared the work.'],
      },
      { partner: 'Do you have any questions for us?', replies: ['Yes. What does a typical day look like in this role?', 'Could you tell me about the next steps in the process?'] },
    ],
    closing: "Great questions. We'll be in touch by the end of the week.",
    phrases: [
      { phrase: 'Could you tell me about ...?', use: 'A polite way to ask for information' },
      { phrase: 'I always meet my deadlines.', use: 'I finish work on time' },
      { phrase: 'the next steps', use: 'What happens after this meeting' },
      { phrase: "We'll be in touch.", use: 'We will contact you' },
    ],
  },
  {
    id: 'b1-shop-return',
    level: 'B1',
    title: 'Returning something to a shop',
    setting: 'Something you bought is not right, so you take it back to the shop.',
    you: 'Customer',
    partner: 'Shop assistant',
    icon: 'ShoppingBag',
    exchanges: [
      { partner: 'Hi there. How can I help you today?', replies: ["Hi. I bought this jacket last week, but it doesn't fit.", "Hello. I'd like to return these headphones. They don't work."] },
      { partner: "I'm sorry to hear that. Do you have the receipt?", replies: ['Yes, here it is.', "I'm afraid I lost it, but I paid by card."] },
      { partner: 'Thank you. Would you like an exchange or a refund?', replies: ["I'd prefer a refund, please.", 'Could I exchange it for a bigger size?'] },
      { partner: "No problem. It'll take three to five days to appear in your account.", replies: ["That's fine. Thank you.", 'OK. Will I get an email to confirm it?'] },
      { partner: 'Is there anything else I can help you with?', replies: ["No, that's all. Thanks for your help.", "No, thank you. You've been very helpful."] },
    ],
    closing: "You're welcome. Have a nice day!",
    phrases: [
      { phrase: "It doesn't fit.", use: 'The size is wrong' },
      { phrase: "I'm afraid ...", use: 'A soft way to give bad news' },
      { phrase: 'an exchange or a refund', use: 'Another item, or your money back' },
      { phrase: "I'd prefer ...", use: 'Saying which one you want' },
    ],
  },
  {
    id: 'b2-salary',
    level: 'B2',
    title: 'Negotiating a salary',
    setting: 'A company has just offered you a job. Now you talk about money.',
    you: 'Candidate',
    partner: 'Hiring manager',
    icon: 'Handshake',
    exchanges: [
      {
        partner: "We'd like to offer you the position. The starting salary is forty-five thousand.",
        replies: ["Thank you, I'm really pleased. Could we talk about the salary a little?", "That's great news. I was hoping for something closer to fifty thousand."],
      },
      {
        partner: 'Of course. What did you have in mind?',
        replies: ['Based on my experience and the market rate, I was thinking of around fifty thousand.', 'Given the responsibilities of the role, I think fifty thousand would be fair.'],
      },
      {
        partner: "That's above our budget. We could go up to forty-seven thousand.",
        replies: ['I appreciate that. Would you consider extra holiday days to make up the difference?', 'Could we agree on forty-seven now, with a review after six months?'],
      },
      { partner: "A review after six months sounds reasonable. I'll put that in writing.", replies: ['That works for me. Thank you for being flexible.', 'Great. When would you like me to start?'] },
      { partner: 'Could you start on the first of next month?', replies: ["Yes, that's perfect.", "I need to give four weeks' notice, so the fifteenth would be better."] },
    ],
    closing: 'Wonderful. Welcome to the team!',
    phrases: [
      { phrase: 'What did you have in mind?', use: 'Asking someone for their number or idea' },
      { phrase: 'Based on my experience ...', use: 'Giving a reason for what you ask' },
      { phrase: 'to make up the difference', use: 'To cover what is missing' },
      { phrase: "to give notice", use: 'To tell your current employer you are leaving' },
    ],
  },
  {
    id: 'c1-meeting',
    level: 'C1',
    title: 'Disagreeing politely in a meeting',
    setting: 'In a team meeting, a colleague suggests something you do not agree with.',
    you: 'Team member',
    partner: 'Dana, a colleague',
    icon: 'MessagesSquare',
    exchanges: [
      {
        partner: 'I think we should cut the marketing budget by half next year.',
        replies: ["I see where you're coming from, but I'm not sure that's the best approach.", "That's an interesting idea, although I have a few concerns."],
      },
      { partner: "Why not? We're spending far too much on ads.", replies: ['Fair point, but our ads bring in most of our new customers.', "I'd argue that cutting it so sharply could hurt our growth."] },
      {
        partner: 'So what would you suggest instead?',
        replies: ['What if we reduced it gradually and measured the impact each month?', 'Perhaps we could move part of the budget to the channels that work best.'],
      },
      {
        partner: "Hmm, I hadn't thought of that. But it might take too long.",
        replies: ["That's a valid concern. We could set a clear deadline of three months.", 'I take your point. Shall we try it for one quarter and then review?'],
      },
      { partner: "All right, let's put both options to the team on Friday.", replies: ["Sounds good. I'll prepare some figures to support it.", 'Agreed. Thanks for being open to it.'] },
    ],
    closing: 'Thanks. Good discussion.',
    phrases: [
      { phrase: "I see where you're coming from, but ...", use: 'Showing you understand before you disagree' },
      { phrase: "I'd argue that ...", use: 'Giving your opinion firmly but politely' },
      { phrase: 'What if we ...?', use: 'Suggesting another way' },
      { phrase: 'I take your point.', use: 'Accepting part of what someone said' },
    ],
  },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));
