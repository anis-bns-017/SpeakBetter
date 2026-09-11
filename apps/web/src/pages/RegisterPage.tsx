import React, { useState } from "react";
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
  CheckCircle2,
  Zap,
  TrendingUp,
  Users,
  Brain,
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
    title: "AI-Powered Learning",
    description: "Personalized lessons adapted to your pace",
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "Visualize your growth with detailed analytics",
  },
  {
    icon: Users,
    title: "Community Support",
    description: "Connect with learners worldwide",
  },
  {
    icon: Zap,
    title: "Daily Challenges",
    description: "Build habits with engaging exercises",
  },
];

export const RegisterPage = () => {
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
  const { register } = useAuth();
  const navigate = useNavigate();

  const getPasswordStrength = (pass: string) => {
    if (pass.length === 0) return { score: 0, label: "", color: "bg-slate-200" };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^a-zA-Z0-9]/.test(pass)) score++;

    const labels = ["", "Weak", "Fair", "Good", "Strong"];
    const colors = [
      "bg-slate-200",
      "bg-rose-500",
      "bg-amber-500",
      "bg-indigo-500",
      "bg-emerald-500",
    ];
    return { score, label: labels[score], color: colors[score] };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
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
      toast.success("Account created! Welcome to SpeakBetter 🚀");
      navigate("/");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-500/30 to-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-500/20 to-indigo-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Benefits & Features */}
            <div className="hidden lg:block space-y-8">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  Join thousands of learners
                </div>
                <h1 className="text-5xl font-black text-white tracking-tight leading-tight">
                  Master Any<br />Language
                </h1>
                <p className="text-lg text-slate-300">
                  Start your language learning journey today with personalized AI-powered lessons
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="space-y-4">
                {BENEFITS.map((benefit, idx) => {
                  const Icon = benefit.icon;
                  return (
                    <div
                      key={idx}
                      className="group flex gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/50 transition-all cursor-default"
                    >
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 group-hover:from-indigo-500/50 group-hover:to-purple-500/50 transition-all">
                        <Icon className="w-6 h-6 text-indigo-300" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{benefit.title}</h3>
                        <p className="text-sm text-slate-400">{benefit.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Social Proof */}
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-slate-400 mb-4">Trusted by language learners</p>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-3xl font-bold text-white">50K+</p>
                    <p className="text-xs text-slate-400">Active Users</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">94%</p>
                    <p className="text-xs text-slate-400">Success Rate</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">25+</p>
                    <p className="text-xs text-slate-400">Languages</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Registration Form */}
            <div className="w-full max-w-md mx-auto lg:mx-0">
              {/* Form Card with Glassmorphism */}
              <div className="relative group">
                {/* Gradient Border */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-blue-500/50 opacity-75 group-hover:opacity-100 blur transition-opacity" />

                <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 p-8 rounded-2xl space-y-6">
                  {/* Header */}
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/50">
                      <Globe2 className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Create Account
                    </h2>
                    <p className="text-sm text-slate-400">
                      Join SpeakBetter and start learning today
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Full Name */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Full Name
                      </label>
                      <div className="relative group/input">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                          required
                          placeholder="Your name"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Email Address
                      </label>
                      <div className="relative group/input">
                        <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                          required
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>

                    {/* Native Language */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Native Language
                      </label>
                      <div className="relative group/input">
                        <Globe2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors pointer-events-none" />
                        <select
                          value={formData.nativeLanguage}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              nativeLanguage: e.target.value,
                            })
                          }
                          className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-lg text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all appearance-none"
                        >
                          {LANGUAGES.map((lang) => (
                            <option key={lang.code} value={lang.code} className="bg-slate-900">
                              {lang.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Password
                      </label>
                      <div className="relative group/input">
                        <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({ ...formData, password: e.target.value })
                          }
                          className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                          required
                          minLength={6}
                          placeholder="Min 6 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Password Strength */}
                      {formData.password && (
                        <div className="pt-2 space-y-1.5">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                  step <= passwordStrength.score
                                    ? passwordStrength.color
                                    : "bg-slate-700"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Strength</span>
                            <span className="font-semibold text-slate-300">
                              {passwordStrength.label}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Confirm Password
                      </label>
                      <div className="relative group/input">
                        <ShieldCheck className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={formData.confirmPassword}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              confirmPassword: e.target.value,
                            })
                          }
                          className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-lg text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                          required
                          placeholder="Re-enter password"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {formData.confirmPassword &&
                        formData.password !== formData.confirmPassword && (
                          <p className="text-xs font-medium text-rose-400 flex items-center gap-1.5 mt-1">
                            <CheckCircle2 className="w-3 h-3 rotate-45" />
                            Passwords do not match
                          </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 active:from-indigo-700 active:to-purple-700 text-white font-bold rounded-lg text-sm transition-all duration-200 shadow-lg shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-indigo-500/75 group"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Account</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-2 bg-slate-900/80 text-slate-400">or</span>
                    </div>
                  </div>

                  {/* Social Login */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      className="py-2.5 px-4 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </button>
                    <button
                      type="button"
                      className="py-2.5 px-4 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.08 2.29.74 3.08.8.905-.08 1.795-.68 3.07-.78 2.03.09 3.71 1.23 4.58 3.72-.88.5-1.75 1.23-2.37 2.12-.98 1.33-.57 2.46.3 3.38-.46.72-1.15 1.45-2.01 1.87z"/>
                      </svg>
                      Apple
                    </button>
                  </div>

                  {/* Footer Links */}
                  <div className="pt-4 border-t border-white/10 space-y-3 text-center">
                    <p className="text-sm text-slate-400">
                      Already have an account?{" "}
                      <Link
                        to="/login"
                        className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Sign In
                      </Link>
                    </p>
                    <p className="text-xs text-slate-500">
                      By registering, you agree to our{" "}
                      <a href="#" className="underline hover:text-slate-400 transition-colors">
                        Terms
                      </a>{" "}
                      and{" "}
                      <a href="#" className="underline hover:text-slate-400 transition-colors">
                        Privacy Policy
                      </a>
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
