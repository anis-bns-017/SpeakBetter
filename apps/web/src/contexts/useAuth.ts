// apps/web/src/contexts/useAuth.ts
// The signed-in person and the sign-in actions. AuthProvider (AuthContext.tsx) fills this in; screens read it
// with useAuth(). Kept apart from the provider so editing either file hot-reloads cleanly.
import { createContext, useContext } from "react";
import type { RegisterData } from "../lib/api/auth";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  /** MODERATOR and ADMIN can open the admin section */
  role?: "USER" | "MODERATOR" | "ADMIN";
  createdAt?: string;
  profile?: {
    nativeLanguage: string;
    learningLanguages: string[];
    xp: number;
    streak: number;
    level?: string | null;
    levelAssessedAt?: string | null;
    /** Empty until the first-day guide is finished or skipped (routes send new accounts to /welcome) */
    onboardedAt?: string | null;
  };
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
