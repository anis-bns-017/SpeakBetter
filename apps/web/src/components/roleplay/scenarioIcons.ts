import { BedDouble, Briefcase, Coffee, Drama, Hand, Handshake, Map, MessagesSquare, ShoppingBag, Stethoscope, type LucideIcon } from "lucide-react";

/** The icon each role-play scenario names; anything new falls back to the theatre masks */
const ICONS: Record<string, LucideIcon> = { BedDouble, Briefcase, Coffee, Hand, Handshake, Map, MessagesSquare, ShoppingBag, Stethoscope };

export const scenarioIcon = (name: string): LucideIcon => ICONS[name] ?? Drama;
