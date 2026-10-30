import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJoinByInvite } from '../hooks/useCommunities';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';

export const JoinCommunityPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const joinByInvite = useJoinByInvite();
  
  // StrictMode protection: Tracks whether the mutation has already been fired
  const joinAttempted = useRef(false);

  useEffect(() => {
    if (!code || joinAttempted.current) return;

    // Set lock to true immediately to intercept subsequent render passes
    joinAttempted.current = true;

    const processInvitation = async () => {
      try {
        const data = await joinByInvite.mutateAsync(code);
        toast.success('Successfully joined the community!');
        navigate(`/communities/${data.id}`, { replace: true });
      } catch (error: any) {
        // Fallback message depending on API error body details if present
        const errorMsg = error?.response?.data?.message || 'Invalid or expired invitation link.';
        toast.error(errorMsg);
        navigate('/communities', { replace: true });
      }
    };

    processInvitation();
  }, [code, navigate, joinByInvite]);

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center bg-gray-900 text-gray-100 p-6">
      <div className="max-w-sm w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center shadow-xl flex flex-col items-center">
        {joinByInvite.isError ? (
          <>
            <ShieldAlert className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
            <h2 className="text-xl font-bold text-white mb-2">Processing Failed</h2>
            <p className="text-sm text-gray-400">
              We could not validate your invite link. Redirecting you back...
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-blue-500 mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">Validating Invite</h2>
            <p className="text-sm text-gray-400">
              Checking records and processing workspace credentials...
            </p>
          </>
        )}
      </div>
    </div>
  );
};