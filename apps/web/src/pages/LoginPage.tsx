import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { ArrowRight, Eye, EyeOff, Languages, MessageCircle, Mic, Sparkles } from "lucide-react";
import { AuthShell } from "../components/common/AuthShell";
import { Button, Card, Field, Input } from "../components/ui";

const FEATURES = [
  { icon: Sparkles, title: "AI practice", text: "Feedback on every sentence you say" },
  { icon: Languages, title: "Multiple languages", text: "Learn in the language you think in" },
  { icon: MessageCircle, title: "Real conversations", text: "Voice rooms and chat with learners" },
  { icon: Mic, title: "Fast learning", text: "Short daily sessions that stick" },
];

const STATS = [
  { value: "50K+", label: "Learners" },
  { value: "24/7", label: "Access" },
  { value: "AI", label: "Powered" },
];

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back! 🎉");
      navigate("/");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  // ===== GOOGLE LOGIN =====
  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <AuthShell
      eyebrow="AI powered language learning"
      title={
        <>
          Speak any language.
          <br />
          <span className="italic text-amber-300">Build confidence.</span>
        </>
      }
      blurb="Practise out loud every day, with a coach that listens, corrects and keeps you going."
      features={FEATURES}
      stats={STATS}
    >
      <Card className="p-7 sm:p-8">
        <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">Welcome back</h1>
        <p className="mt-1.5 mb-7 text-sm text-slate-600 dark:text-slate-400">Continue your language journey.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email address" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="h-[18px] w-[18px]" aria-hidden /> : <Eye className="h-[18px] w-[18px]" aria-hidden />}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between text-sm">
            <label className="flex min-h-11 items-center gap-2 text-slate-700 dark:text-slate-300">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
              Remember me
            </label>
            <Link
              to="/forgot-password"
              className="inline-flex min-h-11 items-center rounded-md font-semibold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" size="lg" loading={isLoading} className="w-full">
            {!isLoading && (
              <>
                Sign in <ArrowRight className="h-4 w-4" aria-hidden />
              </>
            )}
            {isLoading && "Signing in…"}
          </Button>
        </form>

        {/* ===== DIVIDER ===== */}
        <div className="my-6 flex items-center gap-4" role="separator" aria-label="or">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        {/* ===== GOOGLE LOGIN BUTTON ===== */}
        <Button type="button" variant="secondary" size="lg" onClick={handleGoogleLogin} className="w-full">
          <svg className="h-5 w-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.6 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.5 5.5C41.6 35.6 44 30.2 44 24c0-1.3-.1-2.4-.4-3.5z"
            />
          </svg>
          Continue with Google
        </Button>

        <p className="mt-7 border-t border-line pt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Don't have an account?
          <Link
            to="/register"
            className="ml-1.5 inline-flex min-h-8 items-center rounded-md font-bold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
          >
            Create one
          </Link>
        </p>
      </Card>
    </AuthShell>
  );
};
