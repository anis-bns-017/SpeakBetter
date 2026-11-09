import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Zap, TrendingUp, Users, Brain, Check } from "lucide-react";
import { AuthShell } from "../components/common/AuthShell";
import { Button, Card, Field, Input, Select } from "../components/ui";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "bn", name: "Bengali" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
];

const BENEFITS = [
  {
    icon: Brain,
    title: "AI Conversation Coach",
    description: "Practice real conversations with intelligent feedback",
  },
  {
    icon: TrendingUp,
    title: "Smart Progress Tracking",
    description: "See your improvement with detailed analytics",
  },
  {
    icon: Users,
    title: "Global Community",
    description: "Connect with learners worldwide",
  },
  {
    icon: Zap,
    title: "Daily Challenges",
    description: "Build confidence with personalized exercises",
  },
];

const STATS = [
  { value: "50K+", label: "Active Learners" },
  { value: "25+", label: "Languages" },
  { value: "4.9", label: "Rating" },
];

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    nativeLanguage: "en",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    window.location.href = `${apiUrl}/auth/google`;
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const passwordRules = useMemo(
    () => [
      {
        label: "8 characters",
        valid: formData.password.length >= 8,
      },
      {
        label: "Uppercase letter",
        valid: /[A-Z]/.test(formData.password),
      },
      {
        label: "Number",
        valid: /\d/.test(formData.password),
      },
      {
        label: "Special character",
        valid: /[^A-Za-z0-9]/.test(formData.password),
      },
    ],
    [formData.password],
  );

  const passwordScore = passwordRules.filter((item) => item.valid).length;

  const passwordStrength = [
    {
      label: "",
      color: "bg-slate-300",
    },
    {
      label: "Weak",
      color: "bg-red-500",
    },
    {
      label: "Fair",
      color: "bg-orange-500",
    },
    {
      label: "Good",
      color: "bg-indigo-500",
    },
    {
      label: "Strong",
      color: "bg-emerald-500",
    },
  ][passwordScore];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordScore < 2) {
      toast.error("Please create a stronger password");
      return;
    }

    setIsLoading(true);

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        nativeLanguage: formData.nativeLanguage,
        learningLanguages: ["en"],
      });

      toast.success("Welcome to SpeakBetter 🚀");
      navigate("/");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };
  const passwordsMismatch = !!formData.confirmPassword && formData.password !== formData.confirmPassword;

  const eyeToggle = (shown: boolean, toggle: () => void, label: string) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={shown ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={shown}
      className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-white"
    >
      {shown ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
    </button>
  );

  return (
    <AuthShell
      eyebrow="AI powered language learning"
      title={
        <>
          Master any
          <br />
          language, <span className="italic text-amber-300">faster.</span>
        </>
      }
      blurb="Learn speaking, vocabulary and pronunciation with personalised lessons designed around your learning style."
      features={BENEFITS.map((b) => ({ icon: b.icon, title: b.title, text: b.description }))}
      stats={STATS}
    >
      <Card className="p-7 sm:p-8">
        <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">Join SpeakBetter</h1>
        <p className="mt-1.5 mb-7 text-sm text-slate-600 dark:text-slate-400">Start your learning journey today.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Full name" htmlFor="reg-name">
            <Input
              id="reg-name"
              type="text"
              required
              autoComplete="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Your name"
            />
          </Field>

          <Field label="Email address" htmlFor="reg-email">
            <Input
              id="reg-email"
              type="email"
              required
              autoComplete="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Native language" htmlFor="reg-lang">
            <Select id="reg-lang" value={formData.nativeLanguage} onChange={(e) => updateField("nativeLanguage", e.target.value)}>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Password" htmlFor="reg-password">
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder="Create a password"
                className="pr-12"
              />
              {eyeToggle(showPassword, () => setShowPassword(!showPassword), "password")}
            </div>

            {formData.password && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className={`h-1.5 flex-1 rounded-full ${item <= passwordScore ? passwordStrength.color : "bg-slate-200 dark:bg-white/10"}`}
                    />
                  ))}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">
                  Strength:
                  <span className="ml-1 font-semibold text-slate-900 dark:text-white">{passwordStrength.label}</span>
                </p>

                <ul className="grid grid-cols-2 gap-2">
                  {passwordRules.map((rule) => (
                    <li key={rule.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check size={14} aria-hidden className={rule.valid ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
                      {rule.label}
                      <span className="sr-only">{rule.valid ? " (met)" : " (not met yet)"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Field>

          <Field label="Confirm password" htmlFor="reg-confirm" error={passwordsMismatch ? "Passwords do not match" : undefined}>
            <div className="relative">
              <Input
                id="reg-confirm"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                invalid={passwordsMismatch}
                value={formData.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                placeholder="Type it again"
                className="pr-12"
              />
              {eyeToggle(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword), "confirmation")}
            </div>
          </Field>

          <Button type="submit" size="lg" loading={isLoading} className="w-full">
            {isLoading ? (
              "Creating account…"
            ) : (
              <>
                Create account <ArrowRight size={18} aria-hidden />
              </>
            )}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-4" role="separator" aria-label="or">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        <div className="space-y-3">
          <Button type="button" variant="secondary" size="lg" onClick={handleGoogleLogin} className="w-full">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M21.35 11.1h-9.18v2.98h5.28c-.23 1.52-1.76 4.45-5.28 4.45-3.18 0-5.78-2.63-5.78-5.87s2.6-5.87 5.78-5.87c1.81 0 3.02.77 3.72 1.43l2.54-2.47C16.8 4.22 14.75 3.3 12.17 3.3 7.47 3.3 3.65 7.12 3.65 11.83s3.82 8.53 8.52 8.53c4.91 0 8.17-3.45 8.17-8.31 0-.56-.06-.95-.13-1.36z" />
            </svg>
            Continue with Google
          </Button>

          <Button type="button" variant="secondary" size="lg" className="w-full">
            Continue with Apple
          </Button>
        </div>

        <div className="mt-7 space-y-3 border-t border-line pt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Already have an account?
            <Link
              to="/login"
              className="ml-1.5 inline-flex min-h-8 items-center rounded-md font-bold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
            >
              Sign in
            </Link>
          </p>

          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck size={14} aria-hidden />
            Your information is secure
          </p>
        </div>
      </Card>
    </AuthShell>
  );
};
