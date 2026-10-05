import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authApi } from "../lib/api/auth";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  profile?: {
    nativeLanguage: string;
    learningLanguages: string[];
    xp: number;
    streak: number;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await authApi.getMe();
        setUser(response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setUser(response.data.user);
  };

  const register = async (data: any) => {
    const response = await authApi.register(data);
    setUser(response.data.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore
    }
    setUser(null);
  };

  // ✅ NEW — used by the Google OAuth callback page
  const refreshUser = async (): Promise<User | null> => {
    try {
      const response = await authApi.getMe();
      setUser(response.data);
      return response.data;
    } catch {
      setUser(null);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
