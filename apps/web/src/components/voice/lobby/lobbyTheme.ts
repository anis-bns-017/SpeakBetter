// apps/web/src/components/voice/lobby/lobbyTheme.ts
import type { ElementType } from "react";
import {
  Users,
  Lock,
  Radio,
  Calendar,
  MessageCircle,
  BookOpen,
  Music,
  Gamepad2,
  Coffee,
  Mic,
} from "lucide-react";

export const COLORS = {
  void: "#0B0714",
  surface: "#1C1430",
  surfaceRaised: "#251C3E",
  surfaceHover: "#2D1F4A",
  border: "#322754",
  borderLight: "#4A3A6E",
  spotlight: "#F5A623",
  spotlightDim: "rgba(245, 166, 35, 0.16)",
  live: "#2DD4BF",
  liveDim: "rgba(45, 212, 191, 0.14)",
  textPrimary: "#F4EFFF",
  textMuted: "#9C90B8",
  textSecondary: "#6B5F8A",
  danger: "#EF4444",
  success: "#34D399",
  info: "#60A5FA",
  purple: "#A78BFA",
  pink: "#F472B6",
  cyan: "#67E8F9",
} as const;

export const TYPE_ACCENTS: Record<string, string> = {
  OPEN: "#2DD4BF",
  PRIVATE: "#F5A623",
  STAGE: "#A78BFA",
  SCHEDULED: "#38BDF8",
};

export const TYPE_LABELS: Record<string, string> = {
  OPEN: "Open",
  PRIVATE: "Private",
  STAGE: "Stage",
  SCHEDULED: "Scheduled",
};

export const TYPE_CONFIG: Record<
  string,
  { label: string; icon: ElementType }
> = {
  OPEN: { label: "Open", icon: Users },
  PRIVATE: { label: "Private", icon: Lock },
  STAGE: { label: "Stage", icon: Radio },
  SCHEDULED: { label: "Scheduled", icon: Calendar },
};

export const TOPICS = [
  { name: "Conversation", icon: MessageCircle, color: "text-blue-400" },
  { name: "Language Learning", icon: BookOpen, color: "text-emerald-400" },
  { name: "Music", icon: Music, color: "text-pink-400" },
  { name: "Gaming", icon: Gamepad2, color: "text-purple-400" },
  { name: "Social", icon: Users, color: "text-cyan-400" },
  { name: "Casual", icon: Coffee, color: "text-amber-400" },
  { name: "Podcast", icon: Radio, color: "text-indigo-400" },
  { name: "Study", icon: BookOpen, color: "text-emerald-400" },
  { name: "Interview", icon: Mic, color: "text-red-400" },
  { name: "Panel", icon: Users, color: "text-violet-400" },
];

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Chinese",
  "Korean",
  "Portuguese",
  "Italian",
  "Russian",
];

/** One-tap starting points in the create-room flow */
export const ROOM_TEMPLATES = [
  {
    id: "free-talk",
    label: "Free talk",
    emoji: "💬",
    hint: "Relaxed chat, anyone welcome",
    values: {
      name: "Free talk",
      description: "Relaxed conversation. All levels welcome.",
      type: "OPEN",
      maxParticipants: 20,
      topics: ["Conversation", "Casual"],
    },
  },
  {
    id: "practice-pair",
    label: "Practice partner",
    emoji: "🤝",
    hint: "A small room to practise one-on-one",
    values: {
      name: "Practice partner",
      description: "Small group so everyone gets plenty of speaking time.",
      type: "OPEN",
      maxParticipants: 4,
      topics: ["Language Learning", "Conversation"],
    },
  },
  {
    id: "interview",
    label: "Interview prep",
    emoji: "🎯",
    hint: "Mock interviews with feedback",
    values: {
      name: "Interview prep",
      description: "Take turns asking and answering. Give each other feedback.",
      type: "OPEN",
      maxParticipants: 6,
      topics: ["Interview", "Study"],
    },
  },
  {
    id: "stage",
    label: "Stage talk",
    emoji: "🎤",
    hint: "A few speakers, many listeners",
    values: {
      name: "Stage talk",
      description: "Speakers on stage, everyone else listens and raises a hand.",
      type: "STAGE",
      maxParticipants: 100,
      topics: ["Panel", "Podcast"],
    },
  },
] as const;
