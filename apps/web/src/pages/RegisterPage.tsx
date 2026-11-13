import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/useAuth";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Zap, TrendingUp, Users, Check, Mic } from "lucide-react";
import { AuthShell } from "../components/common/AuthShell";
import { useT } from "../i18n";
import { isNativeApp } from "../lib/pwa";
import { Button, Card, Field, Input, Select } from "../components/ui";
import { asApiError } from "../lib/api/errors";
import { tr, msg } from "../i18n/core";
import { API_URL } from "../lib/api/serverUrl";

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
    icon: Mic,
    title: msg("Speak from day one"),
    description: msg("Live voice rooms and calls with other learners"),
  },
  {
    icon: TrendingUp,
    title: msg("See yourself improve"),
    description: msg("Streaks, levels and a clear picture of your week"),
  },
  {
    icon: Users,
    title: msg("A kind community"),
    description: msg("Learners like you, and moderators who keep it friendly"),
  },
  {
    icon: Zap,
    title: msg("Reviews that stick"),
    description: msg("Your own mistakes come back as quick cards"),
  },
];

const STATS = [
  { value: "Free", label: msg("To use") },
  { value: "A1–C2", label: msg("Every level") },
  { value: "13,000", label: msg("Dictionary words") },
];

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { t } = useT();
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
    const apiUrl = API_URL;
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
        label: msg("8 characters"),
        valid: formData.password.length >= 8,
      },
      {
        label: msg("Uppercase letter"),
        valid: /[A-Z]/.test(formData.password),
      },
      {
        label: msg("Number"),
        valid: /\d/.test(formData.password),
      },
      {
        label: msg("Special character"),
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
      label: msg("Weak"),
      color: "bg-red-500",
    },
    {
      label: msg("Fair"),
      color: "bg-orange-500",
    },
    {
      label: msg("Good"),
      color: "bg-indigo-500",
    },
    {
      label: msg("Strong"),
      color: "bg-emerald-500",
    },
  ][passwordScore];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(t("Passwords do not match"));
      return;
    }

    if (passwordScore < 2) {
      toast.error(t("Please create a stronger password"));
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

      toast.success(t("Welcome to SpeakBetter 🚀"));
      navigate("/");
    } catch (caught) {
      const error = asApiError(caught);
      toast.error(t(error.response?.data?.message || "Registration failed"));
    } finally {
      setIsLoading(false);
    }
  };
  const passwordsMismatch = !!formData.confirmPassword && formData.password !== formData.confirmPassword;

  const eyeToggle = (shown: boolean, toggle: () => void, label: string) => (
    <button
      type="button"
      onClick={toggle}
      aria-label={t(shown ? `Hide ${label}` : `Show ${label}`)}
      aria-pressed={shown}
      className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-white"
    >
      {shown ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
    </button>
  );

  return (
    <AuthShell
      eyebrow={tr("English practice, out loud")}
      title={
        <>
          {t("Speak English")}
          <br />
          <span className="italic text-amber-300">{t("with confidence.")}</span>
        </>
      }
      blurb="Practise speaking with real people, at your level, and keep every correction as a quick review."
      features={BENEFITS.map((b) => ({ icon: b.icon, title: b.title, text: b.description }))}
      stats={STATS}
    >
      <Card className="p-7 sm:p-8">
        <h1 className="text-[28px] leading-tight text-slate-900 dark:text-white">{t("Join SpeakBetter")}</h1>
        <p className="mt-1.5 mb-7 text-sm text-slate-600 dark:text-slate-400">{t("Start your learning journey today.")}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label={t("Full name")} htmlFor="reg-name">
            <Input
              id="reg-name"
              type="text"
              required
              autoComplete="name"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder={t("Your name")}
            />
          </Field>

          <Field label={t("Email address")} htmlFor="reg-email">
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

          <Field label={t("Native language")} htmlFor="reg-lang">
            <Select id="reg-lang" value={formData.nativeLanguage} onChange={(e) => updateField("nativeLanguage", e.target.value)}>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("Password")} htmlFor="reg-password">
            <div className="relative">
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => updateField("password", e.target.value)}
                placeholder={t("Create a password")}
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
                  {t("Strength:")}
                  <span className="ml-1 font-semibold text-slate-900 dark:text-white">{t(passwordStrength.label)}</span>
                </p>

                <ul className="grid grid-cols-2 gap-2">
                  {passwordRules.map((rule) => (
                    <li key={rule.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check size={14} aria-hidden className={rule.valid ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
                      {t(rule.label)}
                      <span className="sr-only">{rule.valid ? tr(" (met)") : tr(" (not met yet)")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Field>

          <Field label={t("Confirm password")} htmlFor="reg-confirm" error={passwordsMismatch ? t("Passwords do not match") : undefined}>
            <div className="relative">
              <Input
                id="reg-confirm"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                invalid={passwordsMismatch}
                value={formData.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                placeholder={t("Type it again")}
                className="pr-12"
              />
              {eyeToggle(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword), "confirmation")}
            </div>
          </Field>

          <Button type="submit" size="lg" loading={isLoading} className="w-full">
            {isLoading ? (
              t("Creating account…")
            ) : (
              <>
                {t("Create account")} <ArrowRight size={18} aria-hidden />
              </>
            )}
          </Button>
          <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {/* One sentence with the links dropped in, so each language can put them where its grammar wants */}
            {t("By creating an account you agree to our {terms} and {privacy}.")
              .split(/\{(terms|privacy)\}/)
              .map((part, i) =>
                i % 2 === 0 ? (
                  part
                ) : (
                  <Link key={part} to={`/${part}`} className="font-semibold text-indigo-700 underline dark:text-indigo-300">
                    {part === "terms" ? t("Terms of use") : t("Privacy policy")}
                  </Link>
                ),
              )}
          </p>
        </form>

        {/* Google doesn't allow its sign-in inside apps' web views, so the phone app uses email only */}
        {!isNativeApp() && (
          <>
          <div className="my-6 flex items-center gap-4" role="separator" aria-label={t("or")}>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("or")}</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          </div>

          <div className="space-y-3">
            <Button type="button" variant="secondary" size="lg" onClick={handleGoogleLogin} className="w-full">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21.35 11.1h-9.18v2.98h5.28c-.23 1.52-1.76 4.45-5.28 4.45-3.18 0-5.78-2.63-5.78-5.87s2.6-5.87 5.78-5.87c1.81 0 3.02.77 3.72 1.43l2.54-2.47C16.8 4.22 14.75 3.3 12.17 3.3 7.47 3.3 3.65 7.12 3.65 11.83s3.82 8.53 8.52 8.53c4.91 0 8.17-3.45 8.17-8.31 0-.56-.06-.95-.13-1.36z" />
              </svg>
              {t("Continue with Google")}
            </Button>
          </div>
          </>
        )}

        <div className="mt-7 space-y-3 border-t border-line pt-6 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("Already have an account?")}
            <Link
              to="/login"
              className="ml-1.5 inline-flex min-h-8 items-center rounded-md font-bold text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
            >
              {t("Sign in")}
            </Link>
          </p>

          <p className="flex items-center justify-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <ShieldCheck size={14} aria-hidden />
            {t("Your information is secure")}
          </p>
        </div>
      </Card>
    </AuthShell>
  );
};
