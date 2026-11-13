import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  useFriends,
  useFriendRequests,
  useRespondFriendRequest,
  useCancelFriendRequest,
  useBlockedUsers,
  useSearchUsers,
  useSendFriendRequest,
  useUnblockUser,
} from "../hooks/useFriends";
import { toast } from "sonner";
import { FollowButton } from "../components/social/FollowButton";
import {
  Users,
  UserPlus,
  Search,
  ShieldAlert,
  Check,
  X,
  UserCheck,
  UserX,
  Loader2,
  Globe,
  Clock,
  Send,
  Sparkles,
  Info,
} from "lucide-react";
import { tr, msg } from "../i18n/core";

type Tab = "friends" | "requests" | "search" | "blocked";

export const FriendsPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Queries
  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: requests, isLoading: requestsLoading } = useFriendRequests();
  const { data: blocked, isLoading: blockedLoading } = useBlockedUsers();
  const { data: searchResults, isLoading: searchLoading } = useSearchUsers(searchQuery);

  // Mutations
  const respondMutation = useRespondFriendRequest();
  const cancelMutation = useCancelFriendRequest();
  const sendRequestMutation = useSendFriendRequest();
  const unblockMutation = useUnblockUser();

  const handleRespond = async (requestId: string, action: "accepted" | "rejected") => {
    try {
      setLoadingActionId(requestId);
      await respondMutation.mutateAsync({ requestId, action });
      toast.success(action === "accepted" ? tr("Friend request accepted") : tr("Request declined"));
    } catch {
      toast.error(tr("Failed to respond to request"));
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      setLoadingActionId(requestId);
      await cancelMutation.mutateAsync(requestId);
      toast.success(tr("Friend request cancelled"));
    } catch {
      toast.error(tr("Failed to cancel request"));
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      setLoadingActionId(userId);
      await sendRequestMutation.mutateAsync(userId);
      toast.success(tr("Friend request sent"));
    } catch {
      toast.error(tr("Failed to send friend request"));
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleUnblock = async (userId: string, userName: string) => {
    try {
      setLoadingActionId(userId);
      await unblockMutation.mutateAsync(userId);
      toast.success(tr("{userName} unblocked", { userName }));
    } catch {
      toast.error(tr("Failed to unblock user"));
    } finally {
      setLoadingActionId(null);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "friends", label: msg("Friends"), icon: <Users className="w-4 h-4" /> },
    {
      id: "requests",
      label: msg("Requests"),
      icon: <UserPlus className="w-4 h-4" />,
      badge: requests?.length,
    },
    { id: "search", label: msg("Find People"), icon: <Search className="w-4 h-4" /> },
    { id: "blocked", label: msg("Blocked"), icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-page py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-surface p-6 rounded-2xl border border-line shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white">{tr("Community & Friends")}</h1>
              <p className="text-sm text-slate-500">
                {tr("Connect with language learners worldwide and practice together.")}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="bg-surface p-1.5 rounded-2xl border border-line shadow-sm flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-1 justify-center ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {tab.icon}
                <span>{tr(tab.label)}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isActive ? "bg-white text-indigo-600" : "bg-rose-500 text-white"
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Friends List */}
        {activeTab === "friends" && (
          <div>
            {friendsLoading ? (
              <ListSkeleton />
            ) : friends && friends.length > 0 ? (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-surface p-4 rounded-2xl border border-line shadow-sm hover:border-line transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 text-sm overflow-hidden shrink-0">
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt={friend.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          friend.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Details */}
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm"><Link to={`/u/${friend.id}`} className="hover:underline">{friend.name}</Link></h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3 text-slate-400" />
                          <span>
                            {friend.profile?.nativeLanguage || tr("Native Speaker")} {" "}{tr("• Learning:{value}", { value: " " })}{friend.profile?.learningLanguages?.join(", ") || tr("General")}
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-slate-300" />
                          {tr("Friends since")}{" "}{new Date(friend.friendSince).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{tr("Connected")}</span>
                      </span>
                      {/* Follow to hear when they go live or schedule a room */}
                      <FollowButton userId={friend.id} name={friend.name} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Users className="w-7 h-7" />}
                title={tr("No Friends Yet")}
                description={tr("Start building your language learning circle by finding other learners.")}
                actionLabel={tr("Find People")}
                onAction={() => setActiveTab("search")}
              />
            )}
          </div>
        )}

        {/* Tab 2: Friend Requests */}
        {activeTab === "requests" && (
          <div>
            {requestsLoading ? (
              <ListSkeleton />
            ) : requests && requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map((req) => {
                  const isLoadingAction = loadingActionId === req.id;

                  return (
                    <div
                      key={req.id}
                      className="bg-surface p-4 rounded-2xl border border-line shadow-sm hover:border-line transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-violet-50 border border-violet-100 flex items-center justify-center font-bold text-violet-700 text-sm overflow-hidden shrink-0">
                          {req.fromUser.avatarUrl ? (
                            <img
                              src={req.fromUser.avatarUrl}
                              alt={req.fromUser.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            req.fromUser.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">
                            {req.fromUser.name}
                          </h3>
                          <p className="text-xs text-slate-500">{req.fromUser.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleRespond(req.id, "accepted")}
                          disabled={isLoadingAction}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
                        >
                          {isLoadingAction ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{tr("Accept")}</span>
                        </button>

                        <button
                          onClick={() => handleRespond(req.id, "rejected")}
                          disabled={isLoadingAction}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-semibold rounded-xl text-xs transition-all border border-slate-200/80 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{tr("Reject")}</span>
                        </button>

                        <button
                          onClick={() => handleCancel(req.id)}
                          disabled={isLoadingAction}
                          className="px-3 py-2 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors"
                        >
                          {tr("Cancel")}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<UserPlus className="w-7 h-7" />}
                title={tr("No Pending Requests")}
                description={tr("You don't have any incoming friend requests at the moment.")}
              />
            )}
          </div>
        )}

        {/* Tab 3: Search People */}
        {activeTab === "search" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={tr("Search learners by name or email...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface border border-line rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
              />
            </div>

            {searchLoading ? (
              <ListSkeleton />
            ) : searchQuery.length < 2 ? (
              <div className="bg-surface p-8 rounded-2xl border border-line text-center space-y-2">
                <Sparkles className="w-6 h-6 text-indigo-400 mx-auto" />
                <p className="text-sm font-medium text-slate-600">
                  {tr("Type at least 2 characters to search for classmates and friends.")}</p>
              </div>
            ) : searchResults && searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((result) => {
                  const isLoadingAction = loadingActionId === result.id;

                  return (
                    <div
                      key={result.id}
                      className="bg-surface p-4 rounded-2xl border border-line shadow-sm hover:border-line transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm overflow-hidden shrink-0">
                          {result.avatarUrl ? (
                            <img
                              src={result.avatarUrl}
                              alt={result.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            result.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-800 text-sm"><Link to={`/u/${result.id}`} className="hover:underline">{result.name}</Link></h3>
                          <p className="text-xs text-slate-500">{result.email}</p>
                          {result.profile && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {result.profile.nativeLanguage || tr("Native")} {" "}{tr("• Learning:{value}", { value: " " })}{result.profile.learningLanguages?.join(", ") || tr("General")}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {result.isFriend ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                            <Check className="w-3.5 h-3.5" /> {" "}{tr("Friends")}</span>
                        ) : result.isBlocked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                            {tr("Blocked")}</span>
                        ) : result.isRequested ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                            {tr("Request Sent")}</span>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(result.id)}
                            disabled={isLoadingAction}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
                          >
                            {isLoadingAction ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>{tr("Add Friend")}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<UserX className="w-7 h-7" />}
                title={tr("No Users Found")}
                description={tr("No learners found matching \"{searchQuery}\". Try a different search.", { searchQuery })}
              />
            )}
          </div>
        )}

        {/* Tab 4: Blocked Users */}
        {activeTab === "blocked" && (
          <div>
            {blockedLoading ? (
              <ListSkeleton />
            ) : blocked && blocked.length > 0 ? (
              <div className="space-y-3">
                {blocked.map((userItem) => {
                  const isLoadingAction = loadingActionId === userItem.id;

                  return (
                    <div
                      key={userItem.id}
                      className="bg-surface p-4 rounded-2xl border border-line shadow-sm hover:border-line transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-500 text-sm overflow-hidden shrink-0">
                          {userItem.avatarUrl ? (
                            <img
                              src={userItem.avatarUrl}
                              alt={userItem.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            userItem.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div>
                          <h3 className="font-bold text-slate-800 text-sm">
                            {userItem.name}
                          </h3>
                          <p className="text-xs text-slate-500">{userItem.email}</p>
                          {userItem.reason && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Info className="w-3 h-3 text-slate-300" />
                              {tr("Reason:")}{" "}{userItem.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnblock(userItem.id, userItem.name)}
                        disabled={isLoadingAction}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 font-semibold rounded-xl text-xs transition-all border border-slate-200/80 disabled:opacity-50 shrink-0"
                      >
                        {isLoadingAction ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>{tr("Unblock")}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<ShieldAlert className="w-7 h-7" />}
                title={tr("No Blocked Users")}
                description={tr("Your blocked list is currently empty.")}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Supporting Skeleton Component
const ListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-surface p-4 rounded-2xl border border-line flex items-center justify-between animate-pulse"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-44 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="h-8 w-24 bg-slate-200 rounded-xl shrink-0" />
      </div>
    ))}
  </div>
);

// Supporting Empty State Component
const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className="bg-surface p-12 rounded-2xl border border-line text-center space-y-3 shadow-sm">
    <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
      {icon}
    </div>
    <div className="space-y-1">
      <h3 className="text-lg font-bold text-slate-800">{tr(title)}</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">{tr(description)}</p>
    </div>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-all shadow-sm mt-2"
      >
        {tr(actionLabel)}
      </button>
    )}
  </div>
);