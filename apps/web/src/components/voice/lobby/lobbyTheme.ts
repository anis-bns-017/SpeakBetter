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
  void: "var(--sx-bg-page-0b0714)",
  surface: "var(--sx-bg-card-1c1430)",
  surfaceRaised: "var(--sx-bg-raised-251c3e)",
  surfaceHover: "var(--sx-bg-hover-2d1f4a)",
  border: "var(--sx-border-322754)",
  borderLight: "var(--sx-border-4a3a6e)",
  spotlight: "var(--sx-accent-f5a623)",
  spotlightDim: "var(--sx-accent-245-166-35-160)",
  live: "var(--sx-accent-2dd4bf)",
  liveDim: "var(--sx-accent-45-212-191-140)",
  textPrimary: "var(--sx-text-f4efff)",
  textMuted: "var(--sx-text-9c90b8)",
  textSecondary: "var(--sx-text-6b5f8a)",
  danger: "var(--sx-accent-ef4444)",
  success: "var(--sx-accent-34d399)",
  info: "var(--sx-accent-60a5fa)",
  purple: "var(--sx-accent-a78bfa)",
  pink: "var(--sx-accent-f472b6)",
  cyan: "var(--sx-accent-67e8f9)",
} as const;

export const TYPE_ACCENTS: Record<string, string> = {
  OPEN: "var(--sx-accent-2dd4bf)",
  PRIVATE: "var(--sx-accent-f5a623)",
  STAGE: "var(--sx-accent-a78bfa)",
  SCHEDULED: "var(--sx-accent-38bdf8)",
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
