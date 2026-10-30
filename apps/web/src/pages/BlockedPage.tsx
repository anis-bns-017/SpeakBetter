import { useState } from "react";
import { useBlockedUsers, useUnblockUser } from "../hooks/useFriends";
import { toast } from "sonner";
import {
  ShieldAlert,
  UserCheck,
  Search,
  AlertCircle,
  Loader2,
  Info,
  UserX,
} from "lucide-react";

export const BlockedPage = () => {
  const { data, isLoading, isError } = useBlockedUsers();
  const unblockMutation = useUnblockUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const handleUnblock = async (userId: string, userName: string) => {
    try {
      setUnblockingId(userId);
      await unblockMutation.mutateAsync(userId);
      toast.success(`${userName} has been unblocked`);
    } catch {
      toast.error(`Failed to unblock ${userName}`);
    } finally {
      setUnblockingId(null);
    }
  };

  // Filter blocked users by search term
  const filteredUsers =
    data?.filter((block) =>
      block.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Blocked Accounts
              </h1>
              <p className="text-sm text-slate-500">
                Manage accounts you've blocked from contacting or viewing your profile.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          {data && data.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search blocked users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
          )}
        </div>

        {/* Content Area */}
        {isLoading ? (
          /* Loading Skeletons */
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-slate-200 rounded" />
                    <div className="h-3 w-48 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-8 w-24 bg-slate-200 rounded-lg" />
              </div>
            ))}
          </div>
        ) : isError ? (
          /* Error State */
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              Failed to load blocked users
            </h3>
            <p className="text-sm text-slate-500">
              Something went wrong while fetching your blocked list. Please try again later.
            </p>
          </div>
        ) : !data || data.length === 0 ? (
          /* Empty State */
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
              <UserX className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              No Blocked Users
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              You haven't blocked anyone yet. Users you block will appear here.
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Search No Results */
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center space-y-2">
            <p className="text-slate-600 font-medium">
              No blocked users match "{searchQuery}"
            </p>
            <p className="text-xs text-slate-400">
              Try searching with a different term.
            </p>
          </div>
        ) : (
          /* List of Blocked Users */
          <div className="space-y-3">
            {filteredUsers.map((block) => {
              const isUnblocking = unblockingId === block.id;

              return (
                <div
                  key={block.id}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm shrink-0">
                      {block.name ? block.name[0].toUpperCase() : "U"}
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-800 text-sm">
                        {block.name}
                      </h3>
                      {block.reason ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Info className="w-3 h-3 shrink-0 text-slate-400" />
                          <span>Reason: {block.reason}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">No reason specified</p>
                      )}
                    </div>
                  </div>

                  {/* Unblock Action Button */}
                  <button
                    onClick={() =>
                      handleUnblock(block.id, block.name)
                    }
                    disabled={isUnblocking || unblockMutation.isPending}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 font-medium rounded-xl text-xs border border-slate-200/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-end sm:self-auto"
                  >
                    {isUnblocking ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                        <span>Unblocking...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Unblock User</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};