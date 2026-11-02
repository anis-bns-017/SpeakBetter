// apps/web/src/components/call/callOptions.ts
import type { CallGoal, CallLevel, ReportReason } from "./callApi";

export const LEVEL_OPTIONS: Array<{ value: CallLevel; label: string; hint: string }> = [
  { value: "beginner", label: "Beginner", hint: "Short, simple sentences" },
  { value: "intermediate", label: "Intermediate", hint: "I can hold a conversation" },
  { value: "advanced", label: "Advanced", hint: "Fluent, want a challenge" },
];

export const GOAL_OPTIONS: Array<{ value: CallGoal; label: string; emoji: string }> = [
  { value: "casual", label: "Casual chat", emoji: "☕" },
  { value: "interview", label: "Interview prep", emoji: "🎯" },
  { value: "work", label: "Work English", emoji: "💼" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "fun", label: "Just for fun", emoji: "🎲" },
];

export const REPORT_OPTIONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: "HARASSMENT", label: "Insults or harassment", hint: "Bullying, threats, shouting at me" },
  { value: "SEXUAL", label: "Sexual content", hint: "Sexual talk or requests" },
  { value: "HATE", label: "Hate speech", hint: "Slurs or hatred toward a group" },
  { value: "SPAM", label: "Spam or selling", hint: "Ads, scams, links" },
  { value: "UNDERAGE", label: "Seems under 18", hint: "They sound like a child" },
  { value: "OTHER", label: "Something else", hint: "Anything that felt wrong" },
];
