import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCommunity, useCreateChannel, useJoinCommunity, useLeaveCommunity } from '../hooks/useCommunities';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Hash, Volume2, Megaphone, Plus, Settings, Users, LogOut, Trash2, Shield, MessageSquare } from 'lucide-react';

export const CommunityPage = () => {
  const { communityId } = useParams<{ communityId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: community, isLoading, refetch } = useCommunity(communityId || '');
  const joinCommunity = useJoinCommunity();
  const leaveCommunity = useLeaveCommunity();
  const createChannel = useCreateChannel();

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelData, setChannelData] = useState({
    name: '',
    description: '',
    type: 'TEXT',
  });
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const isMember = community?.members.some((m) => m.userId === user?.id);
  const isOwner = community?.ownerId === user?.id;
  const isAdmin = community?.members.some((m) => m.userId === user?.id && (m.role === 'admin' || m.role === 'owner'));

  const handleJoin = async () => {
    if (!communityId) return;
    try {
      await joinCommunity.mutateAsync(communityId);
      toast.success(community ? `Joined ${community.name}!` : 'Joined!');
      refetch();
    } catch (error) {
      toast.error('Failed to join community.');
    }
  };

  const handleLeave = async () => {
    if (communityId && window.confirm('Are you sure you want to leave this community?')) {
      try {
        await leaveCommunity.mutateAsync(communityId);
        toast.success(community ? `Left ${community.name}` : 'Left the community');
        navigate('/communities');
      } catch (error) {
        toast.error('Failed to leave community.');
      }
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityId) return;

    // Basic Validation
    const cleanName = channelData.name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!cleanName) {
      toast.error('Channel name cannot be empty');
      return;
    }

    try {
      await createChannel.mutateAsync({
        communityId,
        data: { ...channelData, name: cleanName },
      });
      toast.success('Channel created successfully!');
      setShowCreateChannel(false);
      setChannelData({ name: '', description: '', type: 'TEXT' });
      refetch();
    } catch (error) {
      toast.error('Failed to create channel.');
    }
  };

  const handleDeleteChannel = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the channel when deleting
    if (window.confirm('Delete this channel permanently?')) {
      try {
        // TODO: Replace with your actual useDeleteChannel hook mutation
        toast.success('Channel deleted');
        if (selectedChannel === channelId) setSelectedChannel(null);
        refetch();
      } catch (error) {
        toast.error('Failed to delete channel');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-gray-900 text-gray-400">
        <div className="animate-pulse flex space-x-2 items-center">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" />
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
          <span>Loading community...</span>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center bg-gray-900 text-center p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Community Not Found</h2>
        <p className="text-gray-400 max-w-sm mb-4">The community you are looking for doesn't exist or may have been deleted.</p>
        <button onClick={() => navigate('/communities')} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition">
          Back to Communities
        </button>
      </div>
    );
  }

  // Handle Unauthenticated Gatekeeping
  if (!isMember && community.type !== 'PUBLIC') {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-gray-900 p-6">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center shadow-xl">
          <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{community.name}</h2>
          <p className="text-gray-400 mb-6">{community.description || "No description provided."}</p>
          <div className="bg-gray-900/50 rounded-lg p-3 mb-6 text-xs text-amber-400 font-medium tracking-wide uppercase">
            Private Community Group
          </div>
          <button
            onClick={handleJoin}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-md transition-colors"
          >
            Request to Join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-900 text-gray-100 overflow-hidden">
      {/* Sidebar Layout */}
      <div className="w-64 bg-gray-950 flex flex-col border-r border-gray-800">
        {/* Header Block */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 shadow-sm">
          <h2 className="font-bold text-white tracking-wide truncate pr-2" title={community.name}>
            {community.name}
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowCreateChannel(true)}
              className="p-1.5 bg-gray-900 hover:bg-gray-800 text-blue-400 rounded-md transition border border-gray-800"
              title="Create channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Channels Section Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="flex items-center justify-between px-2 mb-2 text-xs font-semibold text-gray-500 tracking-wider uppercase">
              <span>Channels</span>
            </div>
            <div className="space-y-0.5">
              {community.channels
                .filter((c) => c.type !== 'CATEGORY')
                .map((channel) => {
                  const isActive = selectedChannel === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel.id)}
                      className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition-all text-left ${
                        isActive
                          ? 'bg-gray-800 text-white font-medium shadow-inner'
                          : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {channel.type === 'TEXT' && <Hash className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />}
                        {channel.type === 'VOICE' && <Volume2 className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />}
                        {channel.type === 'ANNOUNCEMENT' && <Megaphone className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />}
                        <span className="truncate">{channel.name}</span>
                      </div>
                      {isAdmin && (
                        <span
                          onClick={(e) => handleDeleteChannel(channel.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 text-gray-500 hover:text-red-400 rounded transition"
                          title="Delete Channel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer Block */}
        <div className="bg-gray-950/80 p-3 border-t border-gray-850 space-y-2">
          <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-400 bg-gray-900 rounded-md border border-gray-850">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Members</span>
            </div>
            <span className="font-bold text-gray-300">{community.members.length}</span>
          </div>

          <div className="flex gap-1">
            {isOwner && (
              <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium bg-gray-900 hover:bg-gray-850 rounded border border-gray-800 transition text-gray-300">
                <Settings className="w-3.5 h-3.5" /> Settings
              </button>
            )}
            {isMember && !isOwner && (
              <button
                onClick={handleLeave}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium bg-red-950/30 hover:bg-red-950/60 text-red-400 rounded border border-red-900/50 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Panel Viewport */}
      <div className="flex-1 bg-gray-900 flex flex-col">
        {selectedChannel ? (
          <ChannelView
            communityId={community.id}
            channelId={selectedChannel}
            isAdmin={isAdmin || false}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none">
            <div className="w-16 h-16 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center mb-4 text-blue-400 shadow-md">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Welcome to {community.name}</h3>
            <p className="text-gray-400 max-w-sm text-sm mt-1">
              Select an available panel or channel from the workspace hierarchy to start connecting.
            </p>
          </div>
        )}
      </div>

      {/* Modern Interactive Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full shadow-2xl mx-4">
            <h3 className="text-xl font-bold text-white mb-1">Create Channel</h3>
            <p className="text-xs text-gray-400 mb-4">Channels serve as segmentations for targeted subjects.</p>
            <form onSubmit={handleCreateChannel}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Channel Name</label>
                  <input
                    type="text"
                    value={channelData.name}
                    placeholder="e.g. general-chat"
                    onChange={(e) => setChannelData({ ...channelData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Media Type</label>
                  <select
                    value={channelData.type}
                    onChange={(e) => setChannelData({ ...channelData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="TEXT">Text Feed</option>
                    <option value="VOICE">Voice Suite</option>
                    <option value="ANNOUNCEMENT">Announcements</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Description</label>
                  <textarea
                    value={channelData.description}
                    placeholder="Optional meta details about this channel..."
                    onChange={(e) => setChannelData({ ...channelData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={() => setShowCreateChannel(false)} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white rounded-lg transition text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-md transition text-sm">
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Channel View Component ----------
const ChannelView: React.FC<{ communityId: string; channelId: string; isAdmin: boolean }> = ({
  channelId,
  isAdmin,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Channel Header Bar */}
      <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 shadow-sm bg-gray-900/50">
        <div className="flex items-center gap-2">
          <Hash className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-bold text-white tracking-wide">Channel {channelId}</h3>
        </div>
        {isAdmin && (
          <button className="px-3 py-1.5 text-xs font-medium border border-gray-700 hover:border-gray-600 bg-gray-800 hover:bg-gray-750 text-gray-200 rounded-md transition shadow-sm">
            Manage Channel
          </button>
        )}
      </div>

      {/* Main Messaging Canvas Viewport */}
      <div className="flex-1 p-6 overflow-y-auto bg-gray-900/20">
        <div className="h-full border border-dashed border-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">
          Messages & thread timelines will appear inside this feed module context.
        </div>
      </div>
    </div>
  );
};