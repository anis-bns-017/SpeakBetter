import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/useAuth";
import { tr } from "../i18n/core";

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth(); // we'll add this to AuthContext below

  useEffect(() => {
    (async () => {
      try {
        await refreshUser(); // fetch /auth/me with cookies
        navigate("/", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto" />
        <p className="mt-4 text-slate-400">{tr("Signing you in…")}</p>
      </div>
    </div>
  );
};
