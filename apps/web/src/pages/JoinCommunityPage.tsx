import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useJoinByInvite } from "../hooks/useCommunities";
import { tr } from "../i18n/core";

/** Opens an invite link: joins, then goes to the community. The join itself shows the success or error message. */
export const JoinCommunityPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { mutateAsync } = useJoinByInvite();
  // StrictMode runs effects twice: an invite must only be used once
  const joinAttempted = useRef(false);

  useEffect(() => {
    if (!code || joinAttempted.current) return;
    joinAttempted.current = true;
    mutateAsync(code)
      .then((community) => navigate(`/communities/${community.id}`, { replace: true }))
      .catch(() => navigate("/communities", { replace: true }));
  }, [code, navigate, mutateAsync]);

  return (
    <div className="flex justify-center px-4 py-24">
      <div className="max-w-sm w-full rounded-3xl border border-line bg-surface shadow-sm p-8 text-center" role="status">
        <Loader2 className="w-10 h-10 mx-auto text-indigo-600 animate-spin" aria-hidden />
        <h1 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{tr("Opening your invite")}</h1>
      </div>
    </div>
  );
};
