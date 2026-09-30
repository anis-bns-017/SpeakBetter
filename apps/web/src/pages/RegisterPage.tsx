import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Globe2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Zap,
  TrendingUp,
  Users,
  Brain,
  Languages,
  Check,
} from "lucide-react";

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

const inputClass =
  "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition";

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
      color: "bg-slate-700",
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
      color: "bg-blue-500",
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
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-purple-500/20 blur-[120px] animate-pulse" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* LEFT SIDE */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                AI Powered Language Learning
              </div>

              <div>
                <h1 className="text-5xl xl:text-6xl font-black text-white leading-tight tracking-tight">
                  Master Any
                  <br />
                  <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                    Language
                  </span>
                  <br />
                  Faster
                </h1>

                <p className="mt-5 text-lg text-slate-300 max-w-lg leading-relaxed">
                  Learn speaking, vocabulary, and pronunciation with
                  personalized AI lessons designed around your learning style.
                </p>
              </div>

              {/* AI Coach Card */}
              <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 overflow-hidden">
                <div className="absolute right-0 top-0 w-40 h-40 bg-indigo-500/20 blur-3xl" />

                <div className="flex items-center gap-5 relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/40">
                    <Globe2 className="w-10 h-10 text-white" />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white">
                      Your AI Language Coach
                    </h3>

                    <p className="text-sm text-slate-400 mt-1">
                      Practice anytime. Improve every day.
                    </p>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <div className="grid sm:grid-cols-2 gap-4">
                {BENEFITS.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
                    >
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-3">
                        <Icon className="w-5 h-5 text-indigo-300" />
                      </div>

                      <h3 className="text-white font-semibold">{item.title}</h3>

                      <p className="text-xs text-slate-400 mt-1">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Stats */}
              <div className="flex gap-10 pt-5 border-t border-white/10">
                {STATS.map((item, index) => (
                  <div key={index}>
                    <p className="text-3xl font-black text-white">
                      {item.value}
                    </p>

                    <p className="text-xs text-slate-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="w-full max-w-md mx-auto">
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 blur opacity-30" />

                <div className="relative rounded-3xl border border-white/20 bg-white/[0.07] backdrop-blur-2xl p-8 shadow-2xl">
                  {/* Header */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 text-indigo-300 text-sm font-medium mb-4">
                      <Languages className="w-4 h-4" />
                      Create your account
                    </div>

                    <h2 className="text-3xl font-black text-white">
                      Join SpeakBetter
                    </h2>

                    <p className="text-slate-400 text-sm mt-2">
                      Start your AI learning journey today
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-slate-300">
                        Full Name
                      </label>

                      <div className="relative mt-2">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          placeholder="Your name"
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                    {/* Email */}
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-slate-300">
                        Email Address
                      </label>

                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          placeholder="you@example.com"
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                    {/* Language */}
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-slate-300">
                        Native Language
                      </label>

                      <div className="relative mt-2">
                        <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />

                        <select
                          value={formData.nativeLanguage}
                          onChange={(e) =>
                            updateField("nativeLanguage", e.target.value)
                          }
                          className={`${inputClass} pl-10`}
                        >
                          {LANGUAGES.map((lang) => (
                            <option
                              key={lang.code}
                              value={lang.code}
                              className="bg-slate-900"
                            >
                              {lang.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>{" "}
                    {/* Password */}
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-slate-300">
                        Password
                      </label>

                      <div className="relative mt-2">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={formData.password}
                          onChange={(e) =>
                            updateField("password", e.target.value)
                          }
                          placeholder="Create password"
                          className={`${inputClass} pl-10 pr-12`}
                        />

                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      {formData.password && (
                        <div className="mt-3 space-y-3">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map((item) => (
                              <div
                                key={item}
                                className={`h-1.5 flex-1 rounded-full ${
                                  item <= passwordScore
                                    ? passwordStrength.color
                                    : "bg-slate-700"
                                }`}
                              />
                            ))}
                          </div>

                          <p className="text-xs text-slate-400">
                            Strength:
                            <span className="ml-1 text-white font-semibold">
                              {passwordStrength.label}
                            </span>
                          </p>

                          <div className="grid grid-cols-2 gap-2">
                            {passwordRules.map((rule, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1 text-xs"
                              >
                                <Check
                                  size={13}
                                  className={
                                    rule.valid
                                      ? "text-emerald-400"
                                      : "text-slate-600"
                                  }
                                />

                                <span className="text-slate-400">
                                  {rule.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Confirm Password */}
                    <div>
                      <label className="text-xs uppercase tracking-wider font-bold text-slate-300">
                        Confirm Password
                      </label>

                      <div className="relative mt-2">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={formData.confirmPassword}
                          onChange={(e) =>
                            updateField("confirmPassword", e.target.value)
                          }
                          placeholder="Confirm password"
                          className={`${inputClass} pl-10 pr-12`}
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showConfirmPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>

                      {formData.confirmPassword &&
                        formData.password !== formData.confirmPassword && (
                          <p className="text-xs text-red-400 mt-2">
                            Passwords do not match
                          </p>
                        )}
                    </div>
                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-white/10" />

                    <span className="text-xs text-slate-500">OR</span>

                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  {/* Social Login */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M21.35 11.1h-9.18v2.98h5.28c-.23 1.52-1.76 4.45-5.28 4.45-3.18 0-5.78-2.63-5.78-5.87s2.6-5.87 5.78-5.87c1.81 0 3.02.77 3.72 1.43l2.54-2.47C16.8 4.22 14.75 3.3 12.17 3.3 7.47 3.3 3.65 7.12 3.65 11.83s3.82 8.53 8.52 8.53c4.91 0 8.17-3.45 8.17-8.31 0-.56-.06-.95-.13-1.36z" />
                      </svg>
                      Continue with Google
                    </button>

                    <button
                      type="button"
                      className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition"
                    >
                      Continue with Apple
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-5 border-t border-white/10 text-center space-y-3">
                    <p className="text-sm text-slate-400">
                      Already have an account?
                      <Link
                        to="/login"
                        className="ml-1 text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        Sign In
                      </Link>
                    </p>

                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                      <ShieldCheck size={14} />
                      Your information is secure
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
