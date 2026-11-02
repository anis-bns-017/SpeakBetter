/**
 * Practice content: the sounds learners of English most often mix up (as word pairs and sentences),
 * and sentences for each level. Hand-written, so it needs no paid service.
 */

export interface SoundSet {
  key: SoundKey;
  /** "th as in think" */
  label: string;
  ipa: string;
  tip: string;
  /** [the word to say, the word it is often heard as] */
  pairs: Array<[string, string]>;
  sentences: string[];
}

export const SOUND_KEYS = ['TH', 'V_W', 'V_B', 'R_L', 'I_EE', 'A_E', 'S_SH', 'Z_S', 'F_P', 'U_OO'] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

export const isSoundKey = (value: unknown): value is SoundKey =>
  typeof value === 'string' && (SOUND_KEYS as readonly string[]).includes(value);

export const SOUNDS: Record<SoundKey, SoundSet> = {
  TH: {
    key: 'TH',
    label: 'th as in think and this',
    ipa: '/θ/ /ð/',
    tip: 'Put the tip of your tongue lightly between your teeth and blow air out. Do not touch the roof of your mouth, or it turns into s, t or d.',
    pairs: [['think', 'sink'], ['three', 'tree'], ['thank', 'tank'], ['thin', 'tin'], ['they', 'day'], ['then', 'den']],
    sentences: ['I think three of them are thirsty.', 'They thanked their mother on Thursday.'],
  },
  V_W: {
    key: 'V_W',
    label: 'v as in very (not w)',
    ipa: '/v/',
    tip: 'For v, rest your top teeth on your bottom lip and let your voice buzz. For w, round your lips without touching your teeth.',
    pairs: [['vest', 'west'], ['vine', 'wine'], ['very', 'wary'], ['veil', 'whale'], ['vet', 'wet']],
    sentences: ['We visited a very wet village.', 'Victor wore a warm vest in winter.'],
  },
  V_B: {
    key: 'V_B',
    label: 'v as in van (not b)',
    ipa: '/v/',
    tip: 'Keep your lips apart for v: top teeth on the bottom lip, with a buzz. For b, both lips close and pop open.',
    pairs: [['van', 'ban'], ['vote', 'boat'], ['very', 'berry'], ['vest', 'best'], ['curve', 'curb']],
    sentences: ['The van is very big.', 'Every vote is valuable.'],
  },
  R_L: {
    key: 'R_L',
    label: 'r and l',
    ipa: '/r/ /l/',
    tip: 'For l, press the tip of your tongue behind your top teeth. For r, pull your tongue back so it touches nothing, and round your lips a little.',
    pairs: [['right', 'light'], ['rice', 'lice'], ['read', 'lead'], ['pray', 'play'], ['correct', 'collect'], ['road', 'load']],
    sentences: ['Turn right at the red light.', 'Laura really loves rolling hills.'],
  },
  I_EE: {
    key: 'I_EE',
    label: 'short i (ship) and long ee (sheep)',
    ipa: '/ɪ/ /iː/',
    tip: 'The ee in sheep is long, with your lips spread as if smiling. The i in ship is short and relaxed. Make the difference in length clear.',
    pairs: [['ship', 'sheep'], ['live', 'leave'], ['fill', 'feel'], ['bit', 'beat'], ['sit', 'seat'], ['hit', 'heat']],
    sentences: ['Please sit in this seat.', 'The sheep live on a big ship.'],
  },
  A_E: {
    key: 'A_E',
    label: 'a in bad and e in bed',
    ipa: '/æ/ /e/',
    tip: 'For the a in bad, open your mouth wide and drop your jaw. The e in bed is smaller, with your mouth half open.',
    pairs: [['bad', 'bed'], ['man', 'men'], ['sat', 'set'], ['pan', 'pen'], ['had', 'head']],
    sentences: ['The man had a bad headache.', 'Ten black cats sat on the bed.'],
  },
  S_SH: {
    key: 'S_SH',
    label: 's and sh',
    ipa: '/s/ /ʃ/',
    tip: 'For sh, push your lips forward and pull your tongue a little back. For s, smile slightly and keep your tongue close behind your teeth.',
    pairs: [['sip', 'ship'], ['sea', 'she'], ['sort', 'short'], ['save', 'shave'], ['sell', 'shell']],
    sentences: ['She sells seashells by the sea.', 'Sam should shop on Sunday.'],
  },
  Z_S: {
    key: 'Z_S',
    label: 'z as in zoo (not s)',
    ipa: '/z/',
    tip: 'Z is s with your voice on. Touch your throat: for z you should feel it buzz.',
    pairs: [['zip', 'sip'], ['zoo', 'sue'], ['prize', 'price'], ['eyes', 'ice'], ['buzz', 'bus']],
    sentences: ['The zebra is busy at the zoo.', 'She closed her eyes and won a prize.'],
  },
  F_P: {
    key: 'F_P',
    label: 'f and p',
    ipa: '/f/ /p/',
    tip: 'For f, rest your top teeth on your bottom lip and blow. For p, close both lips and release a small puff of air.',
    pairs: [['fan', 'pan'], ['fine', 'pine'], ['fast', 'past'], ['coffee', 'copy'], ['fork', 'pork']],
    sentences: ['Five friends found a perfect place.', 'Please pass the coffee pot.'],
  },
  U_OO: {
    key: 'U_OO',
    label: 'short u (full) and long oo (fool)',
    ipa: '/ʊ/ /uː/',
    tip: 'The oo in fool is long, with your lips tightly rounded. The u in full is short and relaxed.',
    pairs: [['full', 'fool'], ['pull', 'pool'], ['look', 'luke'], ['could', 'cooed']],
    sentences: ['Could you pull me out of the pool?', 'Look at the full moon.'],
  },
};

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
export type PracticeLevel = (typeof LEVELS)[number];

export const SENTENCES: Record<PracticeLevel, string[]> = {
  A1: [
    'My name is Sam and I live in a small town.',
    'I have two brothers and one sister.',
    'I drink tea every morning.',
    'The weather is very nice today.',
    'Where is the nearest bus stop?',
    'I like to read books in the evening.',
  ],
  A2: [
    'Last weekend I visited my grandparents in the village.',
    'Could you tell me how to get to the station?',
    'I usually go to work by train.',
    'We are planning a trip to the mountains next month.',
    'She has been learning English for three years.',
    'I would like a cup of coffee, please.',
  ],
  B1: [
    'I think working from home has both advantages and disadvantages.',
    'If I had more free time, I would learn to play the guitar.',
    'The film was much better than I expected.',
    'I have never travelled abroad, but I would love to.',
    'Could you explain that again a little more slowly?',
    'Recently I have started going to the gym three times a week.',
  ],
  B2: [
    'Although the project was challenging, the team managed to finish it on time.',
    'It is often said that technology brings people closer together.',
    'I would rather spend my weekends outdoors than stay at home.',
    'The government should invest more in public transport.',
    'Had I known about the delay, I would have left earlier.',
    'Learning a language requires patience as well as practice.',
  ],
  C1: [
    'The consequences of the decision were far more significant than anyone anticipated.',
    'Despite considerable opposition, the proposal was eventually approved.',
    'It is worth bearing in mind that first impressions are not always accurate.',
    'Her argument, while persuasive, overlooked several crucial details.',
    'Thoroughly researching the subject beforehand would have saved us a great deal of time.',
    'The phenomenon has been studied extensively, yet it remains poorly understood.',
  ],
};

/** Words a speech recogniser cannot tell apart, so hearing one for the other is not a mistake */
export const HOMOPHONES: string[][] = [
  ['to', 'too', 'two'],
  ['there', 'their', "they're"],
  ['for', 'four'],
  ['right', 'write'],
  ['see', 'sea'],
  ['i', 'eye'],
  ['know', 'no'],
  ['hear', 'here'],
  ['by', 'buy', 'bye'],
  ['one', 'won'],
  ['ate', 'eight'],
  ['your', "you're"],
  ['its', "it's"],
  ['whether', 'weather'],
  ['week', 'weak'],
  ['meet', 'meat'],
  ['peace', 'piece'],
  ['road', 'rode'],
  ['sun', 'son'],
  ['new', 'knew'],
];
