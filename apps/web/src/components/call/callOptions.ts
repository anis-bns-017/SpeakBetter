// apps/web/src/components/call/callOptions.ts
import type { CallGoal, CallLevel, ReportReason } from "./callApi";
import { msg } from "../../i18n/core";

export const LEVEL_OPTIONS: Array<{ value: CallLevel; label: string; hint: string }> = [
  { value: "beginner", label: msg("Beginner"), hint: msg("Short, simple sentences") },
  { value: "intermediate", label: msg("Intermediate"), hint: msg("I can hold a conversation") },
  { value: "advanced", label: msg("Advanced"), hint: msg("Fluent, want a challenge") },
];

export const GOAL_OPTIONS: Array<{ value: CallGoal; label: string; emoji: string }> = [
  { value: "casual", label: msg("Casual chat"), emoji: "☕" },
  { value: "interview", label: msg("Interview prep"), emoji: "🎯" },
  { value: "work", label: msg("Work English"), emoji: "💼" },
  { value: "travel", label: msg("Travel"), emoji: "✈️" },
  { value: "fun", label: msg("Just for fun"), emoji: "🎲" },
];

export const REPORT_OPTIONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: "HARASSMENT", label: msg("Insults or harassment"), hint: msg("Bullying, threats, shouting at me") },
  { value: "SEXUAL", label: msg("Sexual content"), hint: msg("Sexual talk or requests") },
  { value: "HATE", label: msg("Hate speech"), hint: msg("Slurs or hatred toward a group") },
  { value: "SPAM", label: msg("Spam or selling"), hint: msg("Ads, scams, links") },
  { value: "UNDERAGE", label: msg("Seems under 18"), hint: msg("They sound like a child") },
  { value: "OTHER", label: msg("Something else"), hint: msg("Anything that felt wrong") },
];
