import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { authApi, type RegisterData } from "../lib/api/auth";
import { AuthContext, type User } from "./useAuth";
import { ReconnectScreen } from "../components/common/ReconnectScreen";
import { isSignedOutError, RETRY_DELAYS_MS } from "../lib/api/authErrors";
import { removePushOnSignOut } from "../lib/push";
import { clearOfflineData } from "../lib/offline";



export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // The server didn't answer when the app started: we don't know yet whether the person is signed in
  const [unreachable, setUnreachable] = useState(false);
  const [checking, setChecking] = useState(false);
  const attempt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const alive = useRef(true);
  // The retry calls the latest loadUser through this, so the function never refers to itself
  const retry = useRef<() => void>(() => {});

  const loadUser = useCallback(async () => {
    window.clearTimeout(timer.current);
    setChecking(true);
    try {
      const response = await authApi.getMe();
      if (!alive.current) return;
      setUser(response.data);
      setUnreachable(false);
      setIsLoading(false);
      attempt.current = 0;
    } catch (error) {
      if (!alive.current) return;
      if (isSignedOutError(error)) {
        setUser(null);
        setUnreachable(false);
        setIsLoading(false);
      } else {
        // Keep the session as it is and try again shortly
        setUnreachable(true);
        const delay = RETRY_DELAYS_MS[Math.min(attempt.current, RETRY_DELAYS_MS.length - 1)];
        attempt.current++;
        timer.current = window.setTimeout(() => retry.current(), delay);
      }
    } finally {
      if (alive.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    retry.current = () => void loadUser();
  }, [loadUser]);

  useEffect(() => {
    alive.current = true;
    // On the next tick, so the first check doesn't set state while this effect runs
    timer.current = window.setTimeout(() => void loadUser(), 0);
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, [loadUser]);

  // Back online, or back to this tab: try straight away instead of waiting for the next retry
  useEffect(() => {
    if (!unreachable) return;
    const now = () => {
      if (document.visibilityState === "visible") void loadUser();
    };
    window.addEventListener("online", now);
    document.addEventListener("visibilitychange", now);
    return () => {
      window.removeEventListener("online", now);
      document.removeEventListener("visibilitychange", now);
    };
  }, [unreachable, loadUser]);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    setUser(response.data.user);
  };

  const register = async (data: RegisterData) => {
    const response = await authApi.register(data);
    setUser(response.data.user);
  };

  const logout = async () => {
    // This device must stop getting this person's notifications once they are signed out
    await removePushOnSignOut();
    await clearOfflineData();
    try {
      await authApi.logout();
    } catch {
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
    } catch (error) {
      // Only a real "signed out" answer clears the user; a server hiccup keeps what we have
      if (isSignedOutError(error)) setUser(null);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, refreshUser, setUser }}
    >
      {isLoading && unreachable ? <ReconnectScreen checking={checking} onRetry={() => void loadUser()} /> : children}
    </AuthContext.Provider>
  );
};
