import React, { useState } from 'react';
import { ChatSettings as ChatSettingsType } from '@speakbetter/types';
import {
  Bell,
  BellOff,
  Pin,
  PinOff,
  UserMinus,
  UserPlus,
  Trash2,
  LogOut,
  X,
  Loader2,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface Participant {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  user: User;
}

interface ChatSettingsProps {
  chatId: string;
  chatName: string;
  chatType: 'PRIVATE' | 'GROUP';
  settings: ChatSettingsType;
  participants: Participant[];
  currentUserId: string;
  isOwner: boolean;
  availableUsers?: User[]; // List of candidate users to add
  onUpdate: (data: Partial<ChatSettingsType>) => Promise<void>;
  onAddParticipants?: (userIds: string[]) => Promise<void>;
  onRemoveParticipant?: (userId: string) => Promise<void>;
  onLeaveChat?: () => Promise<void>;
  onDeleteChat?: () => Promise<void>;
  onClose: () => void;
}

export const ChatSettings: React.FC<ChatSettingsProps> = ({
  chatId,
  chatName,
  chatType,
  settings,
  participants = [],
  currentUserId,
  isOwner,
  availableUsers = [],
  onUpdate,
  onAddParticipants,
  onRemoveParticipant,
  onLeaveChat,
  onDeleteChat,
  onClose,
}) => {
  const [isMuted, setIsMuted] = useState(settings.isMuted || false);
  const [isPinned, setIsPinned] = useState(settings.isPinned || false);
  const [showAddUsersModal, setShowAddUsersModal] = useState(false);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');

  // Loading states
  const [isMuteLoading, setIsMuteLoading] = useState(false);
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const toggleMute = async () => {
    const previousState = isMuted;
    const nextState = !previousState;
    setIsMuted(nextState);
    setIsMuteLoading(true);

    try {
      await onUpdate({ isMuted: nextState });
      toast.success(nextState ? 'Chat muted' : 'Chat unmuted');
    } catch {
      setIsMuted(previousState);
      toast.error('Failed to update notification settings');
    } finally {
      setIsMuteLoading(false);
    }
  };

  const togglePin = async () => {
    const previousState = isPinned;
    const nextState = !previousState;
    setIsPinned(nextState);
    setIsPinLoading(true);

    try {
      await onUpdate({ isPinned: nextState });
      toast.success(nextState ? 'Chat pinned' : 'Chat unpinned');
    } catch {
      setIsPinned(previousState);
      toast.error('Failed to update pin settings');
    } finally {
      setIsPinLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!onRemoveParticipant) return;
    if (!window.confirm(`Remove ${userName} from this chat?`)) return;

    setActionLoadingId(userId);
    try {
      await onRemoveParticipant(userId);
      toast.success(`${userName} removed`);
    } catch {
      toast.error(`Failed to remove ${userName}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLeave = async () => {
    if (!onLeaveChat) return;
    if (!window.confirm('Are you sure you want to leave this chat?')) return;

    setActionLoadingId('leave');
    try {
      await onLeaveChat();
      toast.success('Left chat successfully');
      onClose();
    } catch {
      toast.error('Failed to leave chat');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteChat) return;
    if (!window.confirm('Are you sure you want to delete this chat? This cannot be undone.')) return;

    setActionLoadingId('delete');
    try {
      await onDeleteChat();
      toast.success('Chat deleted successfully');
      onClose();
    } catch {
      toast.error('Failed to delete chat');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmAddUsers = async () => {
    if (!onAddParticipants || selectedUsersToAdd.length === 0) return;

    setActionLoadingId('add-users');
    try {
      await onAddParticipants(selectedUsersToAdd);
      toast.success('Participants added successfully');
      setShowAddUsersModal(false);
      setSelectedUsersToAdd([]);
    } catch {
      toast.error('Failed to add participants');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredCandidates = availableUsers.filter(
    (u) =>
      !participants.some((p) => p.userId === u.id) &&
      u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="w-80 bg-white border-l border-gray-200 h-full flex flex-col shadow-sm relative">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
        <h3 className="font-semibold text-gray-900 text-base">Chat Settings</h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close settings"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Settings Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Chat info header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-lg flex items-center justify-center shrink-0">
              {chatName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate">{chatName}</div>
              <div className="text-xs text-gray-500 capitalize">
                {chatType === 'PRIVATE' ? 'Private Direct Message' : 'Group Chat'} • {participants.length} member{participants.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Toggles */}
        <div className="p-3 border-b border-gray-100 space-y-1">
          <button
            onClick={toggleMute}
            disabled={isMuteLoading}
            className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-700"
          >
            <div className="flex items-center gap-3 text-sm">
              {isMuted ? (
                <BellOff className="w-4 h-4 text-amber-500" />
              ) : (
                <Bell className="w-4 h-4 text-gray-500" />
              )}
              <span>{isMuted ? 'Unmute' : 'Mute'} Notifications</span>
            </div>
            {isMuteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </button>

          <button
            onClick={togglePin}
            disabled={isPinLoading}
            className="flex items-center justify-between w-full px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-700"
          >
            <div className="flex items-center gap-3 text-sm">
              {isPinned ? (
                <PinOff className="w-4 h-4 text-blue-500" />
              ) : (
                <Pin className="w-4 h-4 text-gray-500" />
              )}
              <span>{isPinned ? 'Unpin' : 'Pin'} Chat</span>
            </div>
            {isPinLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </button>
        </div>

        {/* Members List */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Members ({participants.length})
            </span>
            {isOwner && chatType === 'GROUP' && onAddParticipants && (
              <button
                onClick={() => setShowAddUsersModal(true)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Member
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {participants.map((p) => {
              const isSelf = p.userId === currentUserId;
              const isRemovingThisUser = actionLoadingId === p.userId;

              return (
                <div
                  key={p.userId}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg group transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.user?.avatarUrl ? (
                      <img
                        src={p.user.avatarUrl}
                        alt={p.user.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-semibold shrink-0">
                        {p.user?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate flex items-center gap-1">
                        {p.user?.name || 'Unknown User'}
                        {isSelf && <span className="text-xs text-gray-400 font-normal">(You)</span>}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 capitalize">
                        {p.role === 'owner' && (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 font-medium">
                            <ShieldCheck className="w-3 h-3" /> Owner
                          </span>
                        )}
                        {p.role === 'admin' && (
                          <span className="text-blue-600 font-medium">Admin</span>
                        )}
                        {p.role === 'member' && <span>Member</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isOwner && !isSelf && chatType === 'GROUP' && onRemoveParticipant && (
                    <button
                      onClick={() => handleRemoveMember(p.userId, p.user?.name || 'user')}
                      disabled={isRemovingThisUser}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title={`Remove ${p.user?.name}`}
                    >
                      {isRemovingThisUser ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <UserMinus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-3 space-y-1">
          {chatType === 'GROUP' && onLeaveChat && (
            <button
              onClick={handleLeave}
              disabled={actionLoadingId === 'leave'}
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-red-50 rounded-lg transition-colors text-red-600 text-sm font-medium"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4" />
                <span>Leave Chat</span>
              </div>
              {actionLoadingId === 'leave' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </button>
          )}

          {isOwner && onDeleteChat && (
            <button
              onClick={handleDelete}
              disabled={actionLoadingId === 'delete'}
              className="flex items-center justify-between w-full px-3 py-2 hover:bg-red-50 rounded-lg transition-colors text-red-600 text-sm font-medium"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4" />
                <span>Delete Chat</span>
              </div>
              {actionLoadingId === 'delete' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </button>
          )}
        </div>
      </div>

      {/* Add Members Modal Overlay */}
      {showAddUsersModal && (
        <div className="absolute inset-0 bg-white z-20 flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <h4 className="font-semibold text-sm text-gray-900">Add Members</h4>
            <button
              onClick={() => {
                setShowAddUsersModal(false);
                setSelectedUsersToAdd([]);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* User selection list */}
          <div className="flex-1 overflow-y-auto space-y-1 mb-3">
            {filteredCandidates.length > 0 ? (
              filteredCandidates.map((u) => {
                const isSelected = selectedUsersToAdd.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUsersToAdd((prev) =>
                        isSelected ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                      );
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold text-[10px]">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{u.name}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded text-blue-600 pointer-events-none"
                    />
                  </button>
                );
              })
            ) : (
              <div className="text-center text-xs text-gray-400 py-6">No eligible users found</div>
            )}
          </div>

          {/* Submit action */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddUsersModal(false)}
              className="flex-1 py-1.5 border border-gray-200 rounded-md text-xs text-gray-600 hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAddUsers}
              disabled={selectedUsersToAdd.length === 0 || actionLoadingId === 'add-users'}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md text-xs font-medium flex items-center justify-center gap-1"
            >
              {actionLoadingId === 'add-users' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                `Add (${selectedUsersToAdd.length})`
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};