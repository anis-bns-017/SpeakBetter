import { useState } from 'react';
import { useSuggestions, useSendFriendRequest } from '../hooks/useFriends';
import { toast } from 'sonner';
import { UserPlus, Users, Languages, Check, Sparkles } from 'lucide-react';

export const SuggestionsPage = () => {
  const { data, isLoading } = useSuggestions();
  const sendRequestMutation = useSendFriendRequest();
  const [sentRequests, setSentRequests] = useState<Record<string, boolean>>({});

  const handleSendRequest = async (userId: string) => {
    try {
      await sendRequestMutation.mutateAsync(userId);
      setSentRequests((prev) => ({ ...prev, [userId]: true }));
      toast.success('Friend request sent!');
    } catch {
      toast.error('Failed to send request');
    }
  };

  if (isLoading) {
    return <SuggestionsSkeleton />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center space-y-4 max-w-md w-full">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">
              No Suggestions Right Now
            </h3>
            <p className="text-xs text-slate-500">
              We couldn't find any new matches. Connect with more people or check back later!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                People You May Know
              </h1>
              <p className="text-xs text-slate-500">
                Discover language partners and potential study companions tailored for you.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-600">
            <Users className="w-3.5 h-3.5" />
            {data.length} Suggestions
          </span>
        </div>

        {/* User Cards List */}
        <div className="space-y-3">
          {data.map((user) => {
            const isSent = sentRequests[user.id];
            const isPending = sendRequestMutation.isPending && sendRequestMutation.variables === user.id;

            return (
              <div
                key={user.id}
                className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-200"
              >
                {/* Profile Info */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-100"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 text-indigo-600 font-bold text-xl flex items-center justify-center border border-slate-100">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-bold text-slate-800 text-base">
                      {user.name}
                    </h3>

                    {user.profile && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {user.profile.nativeLanguage && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 font-medium">
                            <Languages className="w-3 h-3" />
                            Native: {user.profile.nativeLanguage}
                          </span>
                        )}

                        {user.profile.learningLanguages && user.profile.learningLanguages.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                            Learning: {user.profile.learningLanguages.join(', ')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-50 flex justify-end">
                  {isSent ? (
                    <button
                      disabled
                      className="w-full sm:w-auto px-5 py-2.5 bg-emerald-50 text-emerald-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-default"
                    >
                      <Check className="w-4 h-4" />
                      <span>Request Sent</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(user.id)}
                      disabled={isPending}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isPending ? 'Sending...' : 'Add Friend'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Skeleton Loading Component
const SuggestionsSkeleton = () => (
  <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Skeleton */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-slate-200 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3 w-72 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between gap-4 animate-pulse"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-slate-200 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-5 w-36 bg-slate-200 rounded" />
                <div className="h-4 w-52 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="w-28 h-10 bg-slate-200 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    </div>
  </div>
);