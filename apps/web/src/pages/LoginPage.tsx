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
  ShieldCheck,
  Brain,
  MessageCircle,
  Languages,
  Star,
} from "lucide-react";

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

  return (
    <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center p-4 overflow-hidden relative">

      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[140px]" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[140px]" />
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-blue-500/10 blur-[120px]" />

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-10 items-center relative z-10">

        <div className="hidden lg:block space-y-8">

          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
              <Globe className="w-10 h-10"/>
            </div>

            <div>
              <h1 className="text-5xl font-black">SpeakBetter</h1>
              <p className="text-slate-400">
                AI powered language learning platform
              </p>
            </div>
          </div>

          <h2 className="text-5xl font-bold leading-tight">
            Speak any language.
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              Build confidence.
            </span>
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {[
              [Brain,"AI Practice"],
              [Languages,"Multiple Languages"],
              [MessageCircle,"Real Conversations"],
              [Zap,"Fast Learning"],
            ].map(([Icon,text]:any)=>(
              <div key={text} className="p-5 rounded-3xl bg-white/10 border border-white/10 backdrop-blur-xl">
                <Icon className="text-cyan-400 mb-3"/>
                <p className="font-semibold">{text}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-8 text-sm text-slate-400">
            <span>50K+ Learners</span>
            <span>24/7 Access</span>
            <span>AI Powered</span>
          </div>

        </div>


        <div className="w-full max-w-md mx-auto">

          <div className="rounded-[36px] bg-white/10 border border-white/10 backdrop-blur-2xl p-8 shadow-2xl">

            <div className="text-center mb-8 lg:hidden">
              <Globe className="mx-auto w-14 h-14 text-cyan-400"/>
              <h1 className="text-4xl font-black mt-3">SpeakBetter</h1>
            </div>

            <h2 className="text-3xl font-bold">
              Welcome Back
            </h2>

            <p className="text-slate-400 mt-2 mb-8">
              Continue your language journey
            </p>


            <form onSubmit={handleSubmit} className="space-y-5">

              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-400"/>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full py-4 pl-12 pr-4 rounded-2xl bg-black/20 border border-white/10 outline-none focus:border-cyan-400 transition"
                />
              </div>


              <div className="relative">
                <Lock className="absolute left-4 top-4 text-slate-400"/>
                <input
                  type={showPassword ? "text":"password"}
                  required
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full py-4 pl-12 pr-12 rounded-2xl bg-black/20 border border-white/10 outline-none focus:border-cyan-400 transition"
                />

                <button
                  type="button"
                  onClick={()=>setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-slate-400"
                >
                  {showPassword ? <EyeOff/>:<Eye/>}
                </button>
              </div>


              <div className="flex justify-between text-sm text-slate-400">
                <label className="flex gap-2">
                  <input type="checkbox"/>
                  Remember me
                </label>

                <Link to="/forgot-password" className="text-cyan-400">
                  Forgot?
                </Link>
              </div>


              <button
                disabled={isLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-600 font-bold flex justify-center items-center gap-2 hover:scale-[1.02] transition"
              >
                {isLoading ? <Loader2 className="animate-spin"/> :
                <>Sign In <ArrowRight/></>}
              </button>

            </form>


            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-slate-400">
                Don't have an account?
                <Link to="/register" className="text-cyan-400 font-bold ml-2">
                  Create one
                </Link>
              </p>
            </div>

          </div>


          <div className="grid grid-cols-3 text-center mt-6 text-xs text-slate-400">
            <div><ShieldCheck className="mx-auto text-green-400"/>Secure</div>
            <div><BookOpen className="mx-auto text-cyan-400"/>Learn</div>
            <div><Star className="mx-auto text-yellow-400"/>Premium</div>
          </div>

        </div>

      </div>
    </div>
  );
};
