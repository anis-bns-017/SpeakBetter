import React, { useState, useMemo } from 'react';
import { useCommunities, useCreateCommunity, useJoinCommunity, useLeaveCommunity } from '../hooks/useCommunities';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Plus,
  Users,
  Globe,
  Lock,
  Hash,
  ShieldCheck,
  Search,
  ArrowRight,
  Crown,
  MessageSquare,
  X,
  KeyRound,
  Sparkles,
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PUBLIC: { label: 'Public', icon: Globe, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PRIVATE: { label: 'Private', icon: Lock, color: 'bg-amber-50 text-amber-700 border-amber-200' },
  RESTRICTED: { label: 'Restricted', icon: ShieldCheck, color: 'bg-sky-50 text-sky-700 border-sky-200' },
};

function initials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('') || '?'
  );
}

function hueFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export const CommunitiesPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useCommunities();
  const createCommunity = useCreateCommunity();
  const joinCommunity = useJoinCommunity();
  const leaveCommunity = useLeaveCommunity();

  const [showCreate, setShowCreate] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PUBLIC',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const community = await createCommunity.mutateAsync(formData);
      setShowCreate(false);
      setFormData({ name: '', description: '', type: 'PUBLIC' });
      toast.success('Community created');
      navigate(`/communities/${community.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create community');
    }
  };

  const handleJoin = async (communityId: string) => {
    try {
      await joinCommunity.mutateAsync(communityId);
      toast.success('Joined community');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to join');
    }
  };

  const handleLeave = async (communityId: string) => {
    if (window.confirm('Leave this community?')) {
      await leaveCommunity.mutateAsync(communityId);
      toast.success('Left community');
    }
  };

  const handleJoinWithCode = () => {
    const code = inviteCode.trim();
    if (!code) {
      toast.error('Enter an invite code first');
      return;
    }
    // SPA navigation instead of a full page reload — assumes a
    // /communities/join/:code route handles redemption + redirect.
    navigate(`/communities/join/${code}`);
  };

  const filterList = (list: any[] | undefined) => {
    if (!list) return [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((c) => c.name.toLowerCase().includes(q));
  };

  const owned = useMemo(() => filterList(data?.owned), [data?.owned, search]);
  const joined = useMemo(() => filterList(data?.joined), [data?.joined, search]);
  const recommended = useMemo(() => filterList(data?.recommended), [data?.recommended, search]);

  const isEmpty =
    !isLoading &&
    !owned.length &&
    !joined.length &&
    !recommended.length &&
    !search.trim();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
              Communities
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Find your people, by language and interest
            </p>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-sm shadow-indigo-200 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Community
          </button>
        </div>

        {/* Search + invite code */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search communities"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
            />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:flex-none">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinWithCode()}
                className="w-full sm:w-40 pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
              />
            </div>
            <button
              onClick={handleJoinWithCode}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shrink-0"
            >
              Join
            </button>
          </div>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setShowCreate(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-slate-800">Create a community</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Spanish Learners Hub"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What's this community about?"
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm resize-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['PUBLIC', 'PRIVATE', 'RESTRICTED'] as const).map((type) => {
                      const cfg = TYPE_CONFIG[type];
                      const Icon = cfg.icon;
                      const selected = formData.type === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, type })}
                          className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                            selected
                              ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createCommunity.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {createCommunity.isPending ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
                <div className="h-5 bg-slate-100 rounded-lg w-1/2 mb-3" />
                <div className="h-4 bg-slate-100 rounded-lg w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded-lg w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto mb-5">
              <Hash className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No communities yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              Create your first community, or join one with an invite code.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Create your first community
            </button>
          </div>
        )}

        {!isLoading && !isEmpty && (
          <div className="space-y-8">
            {owned.length > 0 && (
              <CommunitySection
                title="Owned by You"
                icon={Crown}
                communities={owned}
                isOwnerSection
                onJoin={handleJoin}
                onLeave={handleLeave}
                onOpen={(id) => navigate(`/communities/${id}`)}
              />
            )}

            {joined.length > 0 && (
              <CommunitySection
                title="Joined"
                icon={Hash}
                communities={joined}
                isJoinedSection
                onJoin={handleJoin}
                onLeave={handleLeave}
                onOpen={(id) => navigate(`/communities/${id}`)}
              />
            )}

            {recommended.length > 0 && (
              <CommunitySection
                title="Recommended"
                icon={Globe}
                communities={recommended}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onOpen={(id) => navigate(`/communities/${id}`)}
              />
            )}

            {!owned.length && !joined.length && !recommended.length && search.trim() && (
              <div className="text-center py-12 text-slate-400 text-sm">
                No communities match "{search}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Section ----------
const CommunitySection: React.FC<{
  title: string;
  icon: React.ElementType;
  communities: any[];
  isOwnerSection?: boolean;
  isJoinedSection?: boolean;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}> = ({ title, icon: SectionIcon, communities, isOwnerSection, isJoinedSection, onJoin, onLeave, onOpen }) => (
  <div>
    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
      <SectionIcon className="w-4 h-4" />
      {title}
      <span className="text-slate-300 font-normal normal-case">({communities.length})</span>
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {communities.map((community) => (
        <CommunityCard
          key={community.id}
          community={community}
          isOwner={isOwnerSection}
          isJoined={isJoinedSection}
          onJoin={onJoin}
          onLeave={onLeave}
          onOpen={onOpen}
        />
      ))}
    </div>
  </div>
);

// ---------- Card ----------
const CommunityCard: React.FC<{
  community: any;
  isOwner?: boolean;
  isJoined?: boolean;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}> = ({ community, isOwner, isJoined, onJoin, onLeave, onOpen }) => {
  const typeCfg = TYPE_CONFIG[community.type] || TYPE_CONFIG.PUBLIC;
  const TypeIcon = typeCfg.icon;
  const hue = hueFromString(community.name);
  const canJoinDirectly = community.type === 'PUBLIC';

  return (
    <div
      onClick={() => onOpen(community.id)}
      className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer p-5"
    >
      <div className="flex items-start gap-3.5">
        {/* Avatar */}
        {community.avatarUrl ? (
          <img
            src={community.avatarUrl}
            alt={community.name}
            className="w-12 h-12 rounded-2xl object-cover border border-slate-100 shrink-0"
          />
        ) : (
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shrink-0"
            style={{ background: `hsl(${hue}, 55%, 50%)` }}
          >
            {initials(community.name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-slate-800 truncate">{community.name}</h3>
            {isOwner && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                <Crown className="w-2.5 h-2.5" /> Owner
              </span>
            )}
            {isJoined && !isOwner && (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                Joined
              </span>
            )}
          </div>

          {community.description && (
            <p className="text-sm text-slate-500 line-clamp-2 mb-2">{community.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium ${typeCfg.color}`}
            >
              <TypeIcon className="w-3 h-3" />
              {typeCfg.label}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <Users className="w-3 h-3" />
              {community._count?.members || 0}
            </span>
            <span className="inline-flex items-center gap-1 text-slate-400">
              <MessageSquare className="w-3 h-3" />
              {community._count?.channels || 0}
            </span>
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-end gap-2 mt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {!isOwner && !isJoined && canJoinDirectly && (
          <button
            onClick={() => onJoin(community.id)}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Join
          </button>
        )}
        {!isOwner && !isJoined && !canJoinDirectly && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Invite only
          </span>
        )}
        {isJoined && !isOwner && (
          <button
            onClick={() => onLeave(community.id)}
            className="px-4 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
          >
            Leave
          </button>
        )}
        <button
          onClick={() => onOpen(community.id)}
          className="p-1.5 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};