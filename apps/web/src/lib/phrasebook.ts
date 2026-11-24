// Useful English phrases by situation. Each has a short note on when to use it and a Bangla meaning.
// The Bangla lines are a first draft: have a native speaker read them.
import { msg } from "../i18n/core";

export interface Phrase {
  id: string;
  en: string;
  /** When to use it, in simple English */
  note: string;
  bn: string;
}

export interface Situation {
  id: string;
  title: string;
  blurb: string;
  phrases: Phrase[];
}

const p = (id: string, en: string, note: string, bn: string): Phrase => ({ id, en, note, bn });

export const SITUATIONS: Situation[] = [
  {
    id: "meeting",
    title: msg("Meeting people"),
    blurb: msg("Greetings and small talk"),
    phrases: [
      p("meet-1", "Nice to meet you.", "The first time you meet someone.", "আপনার সঙ্গে পরিচিত হয়ে ভালো লাগলো।"),
      p("meet-2", "How's it going?", "A friendly way to say hello.", "কেমন চলছে?"),
      p("meet-3", "What do you do for a living?", "To ask about someone's job.", "আপনি কী কাজ করেন?"),
      p("meet-4", "I'm originally from Bangladesh.", "To say where you come from.", "আমি মূলত বাংলাদেশের মানুষ।"),
      p("meet-5", "We should catch up soon.", "To suggest meeting again.", "আমাদের শিগগিরই আবার দেখা করা উচিত।"),
      p("meet-6", "It was great talking to you.", "To end a chat politely.", "আপনার সঙ্গে কথা বলে খুব ভালো লাগলো।"),
    ],
  },
  {
    id: "help",
    title: msg("When you don't understand"),
    blurb: msg("Ask for repeats and explanations"),
    phrases: [
      p("help-1", "Could you say that again, please?", "You did not hear it well.", "দয়া করে আবার বলবেন?"),
      p("help-2", "Could you speak a little more slowly?", "Someone is speaking too fast.", "একটু ধীরে বলবেন?"),
      p("help-3", "What does that word mean?", "You do not know a word.", "ওই শব্দটার মানে কী?"),
      p("help-4", "Sorry, I didn't catch that.", "You missed what was said.", "দুঃখিত, আমি ঠিক বুঝতে পারিনি।"),
      p("help-5", "Do you mean...?", "To check you understood.", "আপনি কি বলতে চাইছেন...?"),
      p("help-6", "How do you say this in English?", "You know the idea but not the English word.", "এটা ইংরেজিতে কীভাবে বলে?"),
    ],
  },
  {
    id: "food",
    title: msg("Cafés and restaurants"),
    blurb: msg("Order food and pay"),
    phrases: [
      p("food-1", "Could I see the menu, please?", "When you sit down.", "মেনুটা একটু দেখতে পারি?"),
      p("food-2", "I'd like the chicken, please.", "To order politely.", "আমি চিকেনটা নিতে চাই।"),
      p("food-3", "Does this have nuts in it?", "To ask about allergies.", "এতে কি বাদাম আছে?"),
      p("food-4", "Could we have the bill, please?", "When you want to pay.", "বিলটা দিতে পারবেন?"),
      p("food-5", "Is service included?", "To ask about the tip.", "সার্ভিস চার্জ কি ধরা আছে?"),
      p("food-6", "That was delicious, thank you.", "To compliment the food.", "খুব সুস্বাদু ছিল, ধন্যবাদ।"),
    ],
  },
  {
    id: "travel",
    title: msg("Travel and directions"),
    blurb: msg("Get around a new place"),
    phrases: [
      p("trav-1", "Excuse me, how do I get to the station?", "To ask the way.", "মাফ করবেন, স্টেশনে কীভাবে যাব?"),
      p("trav-2", "Is it far from here?", "To ask the distance.", "এটা কি এখান থেকে অনেক দূরে?"),
      p("trav-3", "Which platform does the train leave from?", "At a station.", "ট্রেনটা কোন প্ল্যাটফর্ম থেকে ছাড়ে?"),
      p("trav-4", "I have a reservation under the name Rahman.", "When you check in at a hotel.", "রহমান নামে আমার বুকিং আছে।"),
      p("trav-5", "Could you recommend a good place to eat nearby?", "To ask for advice.", "কাছাকাছি কোথায় ভালো খাবার পাওয়া যায় বলতে পারেন?"),
      p("trav-6", "My flight has been delayed.", "To explain a problem.", "আমার ফ্লাইট দেরি করছে।"),
    ],
  },
  {
    id: "shopping",
    title: msg("Shopping"),
    blurb: msg("Prices, sizes and returns"),
    phrases: [
      p("shop-1", "How much is this?", "To ask the price.", "এটার দাম কত?"),
      p("shop-2", "Do you have this in a larger size?", "At a clothes shop.", "এটা কি বড় সাইজে আছে?"),
      p("shop-3", "Can I try this on?", "To try clothes.", "এটা কি পরে দেখতে পারি?"),
      p("shop-4", "Is there any discount?", "To ask for a lower price.", "কোনো ছাড় আছে কি?"),
      p("shop-5", "I'd like to return this, please.", "To take something back.", "আমি এটা ফেরত দিতে চাই।"),
      p("shop-6", "I'm just looking, thanks.", "When you do not need help.", "আমি শুধু দেখছি, ধন্যবাদ।"),
    ],
  },
  {
    id: "work",
    title: msg("Work and meetings"),
    blurb: msg("Sound clear and professional"),
    phrases: [
      p("work-1", "Could we schedule a meeting for tomorrow?", "To plan a meeting.", "আমরা কি আগামীকাল একটা মিটিং ঠিক করতে পারি?"),
      p("work-2", "I'll get back to you by Friday.", "To promise an answer.", "আমি শুক্রবারের মধ্যে আপনাকে জানাব।"),
      p("work-3", "Let me check and let you know.", "When you are not sure yet.", "আমি দেখে আপনাকে জানাচ্ছি।"),
      p("work-4", "I see your point, but I have a different view.", "To disagree politely.", "আপনার কথা বুঝতে পারছি, তবে আমার মত ভিন্ন।"),
      p("work-5", "Could you send me the details by email?", "To ask for information in writing.", "বিস্তারিত কি ইমেইলে পাঠাতে পারবেন?"),
      p("work-6", "Sorry for the delay in replying.", "To start a late reply.", "উত্তর দিতে দেরি হওয়ায় দুঃখিত।"),
    ],
  },
  {
    id: "calls",
    title: msg("Phone and video calls"),
    blurb: msg("Calls, bad connections and plans"),
    phrases: [
      p("call-1", "Can you hear me okay?", "To check the sound.", "আপনি কি আমার কথা ঠিকমতো শুনতে পাচ্ছেন?"),
      p("call-2", "The connection is bad. Could you repeat that?", "When the line is poor.", "সংযোগ খারাপ। আবার বলবেন?"),
      p("call-3", "I'll call you back in ten minutes.", "When you cannot talk now.", "আমি দশ মিনিট পরে আপনাকে ফোন করব।"),
      p("call-4", "Could I speak to Mr Khan, please?", "To ask for someone.", "মিস্টার খানের সঙ্গে কি কথা বলতে পারি?"),
      p("call-5", "Let's keep in touch.", "To end a call warmly.", "চলুন যোগাযোগ রাখি।"),
      p("call-6", "Sorry, you're on mute.", "When someone forgot to unmute.", "দুঃখিত, আপনার মাইক বন্ধ আছে।"),
    ],
  },
  {
    id: "health",
    title: msg("Health and emergencies"),
    blurb: msg("Say what is wrong and get help"),
    phrases: [
      p("hlth-1", "I don't feel well.", "To say you are ill.", "আমার শরীর ভালো লাগছে না।"),
      p("hlth-2", "I have a headache and a fever.", "To describe symptoms.", "আমার মাথাব্যথা আর জ্বর আছে।"),
      p("hlth-3", "I'm allergic to penicillin.", "To tell a doctor.", "আমার পেনিসিলিনে অ্যালার্জি আছে।"),
      p("hlth-4", "Could you call an ambulance, please?", "In an emergency.", "দয়া করে একটা অ্যাম্বুলেন্স ডাকবেন?"),
      p("hlth-5", "How often should I take this medicine?", "At the pharmacy.", "এই ওষুধ কতবার খাব?"),
      p("hlth-6", "I've lost my passport.", "To report a problem.", "আমি আমার পাসপোর্ট হারিয়ে ফেলেছি।"),
    ],
  },
  {
    id: "opinions",
    title: msg("Opinions and feelings"),
    blurb: msg("Agree, disagree and explain"),
    phrases: [
      p("opin-1", "In my opinion, it's a great idea.", "To give your view.", "আমার মতে, এটা দারুণ একটা ধারণা।"),
      p("opin-2", "I totally agree with you.", "To agree strongly.", "আমি আপনার সঙ্গে পুরোপুরি একমত।"),
      p("opin-3", "I'm not sure about that.", "To doubt politely.", "এ বিষয়ে আমি নিশ্চিত নই।"),
      p("opin-4", "That's a good point.", "To respect someone's idea.", "এটা একটা ভালো কথা।"),
      p("opin-5", "I'm really looking forward to it.", "To say you are excited.", "আমি এর জন্য সত্যিই অপেক্ষা করে আছি।"),
      p("opin-6", "I'm sorry to hear that.", "When someone shares bad news.", "এটা শুনে আমি দুঃখিত।"),
    ],
  },
];

export const ALL_PHRASES: Phrase[] = SITUATIONS.flatMap((s) => s.phrases);

/** Phrases that match every word typed, in the English, the note or the Bangla */
export function searchPhrases(query: string, situationId?: string): Array<Phrase & { situation: string }> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: Array<Phrase & { situation: string }> = [];
  for (const s of SITUATIONS) {
    if (situationId && s.id !== situationId) continue;
    for (const ph of s.phrases) {
      const hay = `${ph.en} ${ph.note} ${ph.bn}`.toLowerCase();
      if (words.every((w) => hay.includes(w))) out.push({ ...ph, situation: s.id });
    }
  }
  return out;
}
