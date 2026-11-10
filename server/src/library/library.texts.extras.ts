/** Key words and talking points for the first fifteen texts (library.texts.core.ts), by text id. */
import { v, type VocabItem } from './library.types';

export const CORE_EXTRAS: Record<string, { vocab: VocabItem[]; discuss: string[] }> = {
  'a1-cafe': {
    vocab: [v('sandwich', 'two slices of bread with food between them', 3), v('large', 'big', 3), v('anything', 'something, no matter what', 6), v('pounds', 'the money used in the UK', 8)],
    discuss: ['What do you usually have for breakfast?', 'Order a drink and a snack in a café. What do you say?'],
  },
  'a1-flat': {
    vocab: [v('flat', 'a home on one floor of a building', 0), v('bright', 'with a lot of light', 2), v('window', 'the glass opening in a wall', 4), v('furniture', 'tables, chairs, beds and sofas', 7)],
    discuss: ['Describe your home. How many rooms does it have?', 'What is your favourite room, and why?'],
  },
  'a1-park': {
    vocab: [v('weather', 'sun, rain, wind and temperature', 0), v('grass', 'the short green plant on the ground', 3), v('lunch', 'the meal in the middle of the day', 5), v('rain', 'water that falls from the sky', 6)],
    discuss: ['What do you do on a sunny Sunday?', 'Do you like going to the park? Who do you go with?'],
  },
  'a2-luggage': {
    vocab: [v('suitcase', 'a large bag for travelling', 1), v('flight', 'a journey by plane', 2), v('describe', 'say what something looks like', 4), v('ribbon', 'a long thin piece of cloth used as decoration', 5)],
    discuss: ['Have you ever lost something while travelling?', 'What do you always pack in your suitcase?'],
  },
  'a2-cooking': {
    vocab: [v('beginners', 'people who are new to something', 2), v('flour', 'the white powder used to make bread and pasta', 3), v('garlic', 'a strong-smelling vegetable used in cooking', 5), v('booked', 'arranged a place in advance', 8)],
    discuss: ['What can you cook well?', 'Would you like to take a cooking class? What would you learn?'],
  },
  'a2-doctor': {
    vocab: [v('appointment', 'a time arranged to see someone', 1), v('headache', 'a pain in your head', 3), v('sore throat', 'a painful throat', 3), v('cancelled', 'decided not to come after all', 6)],
    discuss: ['What do you do when you feel ill?', 'Practise making an appointment by phone with a partner.'],
  },
  'b1-interview': {
    vocab: [v('strength', 'something you do very well', 4), v('weakness', 'something you find difficult', 6), v('under pressure', 'in a stressful situation', 5), v('typical', 'normal; what usually happens', 9)],
    discuss: ['What is your biggest strength? Give an example.', 'What question would you ask at the end of an interview?'],
  },
  'b1-village': {
    vocab: [v('ban', 'officially say that something is not allowed', 0), v('residents', 'people who live in a place', 6), v('surprisingly', 'in a way that is not expected', 4), v('delivery', 'taking goods to someone’s home', 7)],
    discuss: ['Would you like a car-free centre in your town? Why or why not?', 'How do you usually travel around your city?'],
  },
  'b1-no': {
    vocab: [v('colleague', 'a person you work with', 1), v('realised', 'suddenly understood', 3), v('experiment', 'a test to find out what happens', 4), v('shift', 'a period of work at a fixed time', 5)],
    discuss: ['Is it hard for you to say no? When?', 'What would you do with more free time?'],
  },
  'b2-fourday': {
    vocab: [v('productivity', 'how much work is done in a given time', 2), v('attract', 'bring in; make people want to come', 3), v('rotating', 'changing in turn', 6), v('intense', 'very strong or demanding', 7)],
    discuss: ['Would you prefer a four-day week? What could go wrong?', 'How could meetings be made shorter at work or school?'],
  },
  'b2-neighbour': {
    vocab: [v('awkward', 'uncomfortable and embarrassing', 2), v('carried', 'travelled through the air', 3), v('understanding', 'kind and ready to see another person’s view', 8), v('put up with', 'accept something annoying', 9)],
    discuss: ['How do you handle a problem with a neighbour?', 'Why can polite requests work better than complaints?'],
  },
  'b2-forget': {
    vocab: [v('essential', 'absolutely necessary', 1), v('fade', 'slowly become weaker', 4), v('recall', 'remember something', 6), v('effort', 'hard work, mental or physical', 6)],
    discuss: ['How do you remember new vocabulary?', 'Do you think forgetting can be useful? Give an example.'],
  },
  'c1-choice': {
    vocab: [v('self-evident', 'obvious without needing proof', 0), v('abundance', 'a very large amount', 2), v('content', 'happy with what you have', 5), v('deliberately', 'on purpose', 7)],
    discuss: ['Do you ever have too many choices? When?', 'Is "good enough" a sensible way to decide? Explain.'],
  },
  'c1-raise': {
    vocab: [v('raise', 'bring up a subject for discussion', 0), v('comparable', 'similar enough to compare', 5), v('candid', 'honest and direct', 6), v('workable', 'able to be done in practice', 8)],
    discuss: ['How would you prepare to ask for a pay rise?', 'Why does the manager suggest a review "tied to clear targets"?'],
  },
  'c1-city': {
    vocab: [v('weary', 'tired, especially of something', 0), v('turnout', 'the number of people who vote', 1), v('recommendations', 'suggestions for what to do', 4), v('stunt', 'something done only to get attention', 6)],
    discuss: ['Would you join a citizens’ assembly chosen by lottery?', 'How could cities listen to their residents better?'],
  },
};
