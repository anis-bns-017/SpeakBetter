import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Globe,
  Sparkles,
  BookOpen,
  Zap,
} from "lucide-react";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl blur-lg opacity-75" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-xl flex items-center justify-center group">
              <Globe className="w-8 h-8 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-200 to-blue-200 bg-clip-text text-transparent tracking-tight">
              SpeakBetter
            </h1>
            <p className="text-sm text-slate-400 font-medium flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Master any language, any time
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 space-y-6 shadow-2xl">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
            <p className="text-sm text-slate-300">
              Continue your learning journey with us
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-200"
              >
                Email Address
              </label>
              <div className="relative group">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 hover:border-white/30 focus:border-purple-500/50 rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all backdrop-blur-sm"
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-200"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-purple-300 hover:text-purple-200 font-semibold transition-colors"
                >
                  Forgot?
                </Link>
              </div>

              <div className="relative group">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-400 transition-colors" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-white/10 border border-white/20 hover:border-white/30 focus:border-purple-500/50 rounded-xl text-sm font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all backdrop-blur-sm"
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="w-5 h-5 appearance-none bg-white/10 border border-white/20 rounded-lg checked:bg-gradient-to-r checked:from-purple-500 checked:to-blue-500 cursor-pointer transition-all"
                  />
                  <svg
                    className="w-3 h-3 absolute left-1 top-1 text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-300">
                  Remember me on this device
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-purple-500/25 hover:shadow-lg hover:shadow-purple-600/40 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-slate-400">
                or continue with
              </span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3">
            <button className="py-2.5 px-4 border border-white/20 hover:border-white/40 rounded-xl text-white font-medium text-sm transition-all hover:bg-white/5 flex items-center justify-center gap-2 group">
              <Globe className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Google
            </button>
            <button className="py-2.5 px-4 border border-white/20 hover:border-white/40 rounded-xl text-white font-medium text-sm transition-all hover:bg-white/5 flex items-center justify-center gap-2 group">
              <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
              Apple
            </button>
          </div>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-white/10 space-y-4 text-center">
            <p className="text-sm text-slate-300">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-bold text-transparent bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text hover:from-purple-200 hover:to-blue-200 transition-all"
              >
                Create one now
              </Link>
            </p>

            <p className="text-xs text-slate-500">
              By signing in, you agree to our{" "}
              <a href="#" className="text-slate-400 hover:text-slate-300 underline transition-colors">
                Terms
              </a>{" "}
              and{" "}
              <a href="#" className="text-slate-400 hover:text-slate-300 underline transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>

        {/* Benefits Info */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <Zap className="w-5 h-5 text-purple-400 mx-auto" />
            <p className="text-xs font-medium text-slate-300">Fast</p>
          </div>
          <div className="space-y-1">
            <BookOpen className="w-5 h-5 text-blue-400 mx-auto" />
            <p className="text-xs font-medium text-slate-300">Effective</p>
          </div>
          <div className="space-y-1">
            <Sparkles className="w-5 h-5 text-purple-400 mx-auto" />
            <p className="text-xs font-medium text-slate-300">Modern</p>
          </div>
        </div>
      </div>
    </div>
  );
};