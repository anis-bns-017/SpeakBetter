// apps/web/src/components/voice/SpeakerQueue.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ChevronUp,
  ChevronDown,
  UserPlus,
  UserMinus,
  Mic,
  Crown,
  Star,
  Clock,
  Users,
  X,
  Check,
  Volume2,
  VolumeX,
  Gavel,
  Shield,
  Timer,
  Award,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  User,
  UserCheck,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

interface QueueItem {
  id: string;
  userId: string;
  position: number;
  status: 'PENDING' | 'INVITED' | 'SPEAKING' | 'COMPLETED' | 'SKIPPED';
  invitedBy?: string;
  requestedAt: string;
  speakingTime?: number;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
    isVerified?: boolean;
    isPremium?: boolean;
  };
}

interface SpeakerQueueProps {
  roomId: string;
  isModerator: boolean;
  currentSpeakerId?: string;
  onPromote?: (userId: string) => void;
  onRemove?: (userId: string) => void;
  onInvite?: (userId: string) => void;
  onDemote?: (userId: string) => void;
  onSkip?: (userId: string) => void;
  className?: string;
  maxVisible?: number;
  autoExpand?: boolean;
}

interface QueueStats {
  total: number;
  pending: number;
  speaking: number;
  completed: number;
  averageWaitTime: number;
}

export const SpeakerQueue: React.FC<SpeakerQueueProps> = ({
  roomId,
  isModerator,
  currentSpeakerId,
  onPromote,
  onRemove,
  onInvite,
  onDemote,
  onSkip,
  className = '',
  maxVisible = 8,
  autoExpand = true,
}) => {
  const { user } = useAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    pending: 0,
    speaking: 0,
    completed: 0,
    averageWaitTime: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'speaking' | 'completed'>('all');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const socket = useRef<any>(null);
  const queueEndRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket
  useEffect(() => {
    if (!roomId) return;

    // Use your existing socket connection
    const initSocket = async () => {
      try {
        const response = await fetch(`/api/voice/socket/token`);
        const data = await response.json();
        // Connect to socket with token
        // This depends on your socket implementation
      } catch (error) {
        console.error('Failed to connect socket:', error);
      }
    };

    initSocket();

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [roomId]);

  // Load queue
  useEffect(() => {
    const loadQueue = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/voice/queue/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setQueue(data.items || []);
          setStats(data.stats || {
            total: 0,
            pending: 0,
            speaking: 0,
            completed: 0,
            averageWaitTime: 0,
          });
        }
      } catch (error) {
        console.error('Failed to load queue:', error);
        toast.error('Failed to load speaker queue');
      } finally {
        setIsLoading(false);
      }
    };
    loadQueue();
  }, [roomId]);

  // Subscribe to queue updates (via WebSocket)
  useEffect(() => {
    if (!window.__voiceSocket) return;

    const handleQueueUpdate = (data: any) => {
      setQueue(data.queue || []);
      setStats(data.stats || stats);
      
      // Scroll to bottom on new items
      if (data.queue?.length > queue.length) {
        setTimeout(() => {
          queueEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    };

    window.__voiceSocket.addEventListener('message', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.type === 'queue-updated') {
        handleQueueUpdate(data.payload);
      }
    });

    return () => {
      // Cleanup
    };
  }, [queue.length, stats]);

  // Filter and sort queue
  const filteredQueue = React.useMemo(() => {
    let filtered = [...queue];

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => 
        item.status.toLowerCase() === filterStatus
      );
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.user.name.toLowerCase().includes(query)
      );
    }

    // Sort: Speaking first, then by position
    filtered.sort((a, b) => {
      if (a.status === 'SPEAKING' && b.status !== 'SPEAKING') return -1;
      if (b.status === 'SPEAKING' && a.status !== 'SPEAKING') return 1;
      return a.position - b.position;
    });

    return filtered;
  }, [queue, filterStatus, searchQuery]);

  // Limited items for display
  const displayItems = filteredQueue.slice(0, maxVisible);
  const hasMore = filteredQueue.length > maxVisible;

  const handlePromote = useCallback(async (userId: string) => {
    if (!isModerator) {
      toast.error('Only moderators can promote speakers');
      return;
    }

    try {
      const response = await fetch(`/api/voice/queue/promote/${roomId}/${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        setQueue(prev => prev.map(item => 
          item.userId === userId 
            ? { ...item, status: 'SPEAKING' as const }
            : item
        ));
        toast.success('🎤 Promoted to speaker!');
        if (onPromote) onPromote(userId);
      }
    } catch (error) {
      console.error('Failed to promote:', error);
      toast.error('Failed to promote speaker');
    }
  }, [isModerator, roomId, onPromote]);

  const handleRemove = useCallback(async (userId: string) => {
    if (!isModerator) {
      toast.error('Only moderators can remove from queue');
      return;
    }

    try {
      const response = await fetch(`/api/voice/queue/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        setQueue(prev => prev.filter(item => item.userId !== userId));
        toast.success('Removed from queue');
        if (onRemove) onRemove(userId);
      }
    } catch (error) {
      console.error('Failed to remove:', error);
      toast.error('Failed to remove from queue');
    }
  }, [isModerator, roomId, onRemove]);

  const handleDemote = useCallback(async (userId: string) => {
    if (!isModerator) {
      toast.error('Only moderators can demote speakers');
      return;
    }

    try {
      const response = await fetch(`/api/voice/queue/demote/${roomId}/${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        setQueue(prev => prev.map(item => 
          item.userId === userId 
            ? { ...item, status: 'PENDING' as const }
            : item
        ));
        toast.info('Demoted from speaker');
        if (onDemote) onDemote(userId);
      }
    } catch (error) {
      console.error('Failed to demote:', error);
      toast.error('Failed to demote speaker');
    }
  }, [isModerator, roomId, onDemote]);

  const handleSkip = useCallback(async (userId: string) => {
    if (!isModerator) {
      toast.error('Only moderators can skip speakers');
      return;
    }

    try {
      const response = await fetch(`/api/voice/queue/skip/${roomId}/${userId}`, {
        method: 'POST',
      });
      if (response.ok) {
        setQueue(prev => prev.map(item => 
          item.userId === userId 
            ? { ...item, status: 'SKIPPED' as const }
            : item
        ));
        toast.info('⏭️ Speaker skipped');
        if (onSkip) onSkip(userId);
      }
    } catch (error) {
      console.error('Failed to skip:', error);
      toast.error('Failed to skip speaker');
    }
  }, [isModerator, roomId, onSkip]);

  const handleJoinQueue = useCallback(async () => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    // Check if already in queue
    if (queue.some(item => item.userId === user.id)) {
      toast.info('You are already in the queue');
      return;
    }

    try {
      const response = await fetch(`/api/voice/queue/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setQueue(prev => [...prev, data.item]);
        toast.success('🎤 Added to queue!');
        setIsExpanded(true);
      }
    } catch (error) {
      console.error('Failed to join queue:', error);
      toast.error('Failed to join queue');
    }
  }, [user, roomId, queue]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SPEAKING':
        return 'text-green-400 bg-green-400/10';
      case 'INVITED':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'COMPLETED':
        return 'text-blue-400 bg-blue-400/10';
      case 'SKIPPED':
        return 'text-gray-400 bg-gray-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SPEAKING':
        return <Mic className="w-3 h-3" />;
      case 'INVITED':
        return <Star className="w-3 h-3" />;
      case 'COMPLETED':
        return <Check className="w-3 h-3" />;
      case 'SKIPPED':
        return <X className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SPEAKING':
        return 'Speaking';
      case 'INVITED':
        return 'Invited';
      case 'COMPLETED':
        return 'Completed';
      case 'SKIPPED':
        return 'Skipped';
      default:
        return 'Waiting';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        'bg-gray-900/50 backdrop-blur-sm',
        'border-gray-700/50',
        className
      )}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-semibold text-sm">Speaker Queue</h3>
          </div>
          <div className="flex items-center gap-1.5">
            {stats.pending > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400">
                {stats.pending}
              </span>
            )}
            {stats.speaking > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/20 text-green-400">
                🎤 {stats.speaking}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleJoinQueue();
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1.5"
          >
            <UserPlus className="w-3 h-3" />
            Join Queue
          </button>
          <button className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Stats bar */}
            <div className="px-4 py-2 border-t border-gray-700/50 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Total:</span>
                <span className="text-white font-medium">{stats.total}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Wait time:</span>
                <span className="text-white font-medium">
                  {stats.averageWaitTime > 0 ? `${Math.round(stats.averageWaitTime)}s` : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Completed:</span>
                <span className="text-white font-medium">{stats.completed}</span>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="px-4 py-2 border-t border-gray-700/50">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search participants..."
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-gray-800/50 border border-gray-700 text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg text-xs bg-gray-800/50 border border-gray-700 text-white outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="all">All</option>
                  <option value="pending">Waiting</option>
                  <option value="speaking">Speaking</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Queue List */}
            <div className="max-h-72 overflow-y-auto px-2 py-2 space-y-1.5">
              {displayItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-gray-500" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">No one in the queue</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Be the first to request to speak!
                  </p>
                </div>
              ) : (
                displayItems.map((item, index) => {
                  const isCurrentSpeaker = item.userId === currentSpeakerId;
                  const isUser = item.userId === user?.id;
                  const isSpeaking = item.status === 'SPEAKING';

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        'flex items-center justify-between p-2.5 rounded-lg transition-all',
                        isSpeaking
                          ? 'bg-purple-500/10 border border-purple-500/20'
                          : 'bg-gray-800/30 border border-gray-700/30 hover:bg-gray-800/50',
                        isCurrentSpeaker && 'ring-2 ring-purple-500/50'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Position */}
                        <div
                          className={cn(
                            'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0',
                            isSpeaking
                              ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-gray-700/50 text-gray-400'
                          )}
                        >
                          {item.position}
                        </div>

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                            style={{
                              background: item.user.avatarUrl
                                ? `url(${item.user.avatarUrl}) center/cover`
                                : `hsl(${hashCode(item.user.name) % 360}, 50%, 30%)`,
                              color: item.user.avatarUrl ? 'transparent' : '#fff',
                            }}
                          >
                            {!item.user.avatarUrl && getInitials(item.user.name)}
                          </div>
                          {isSpeaking && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse ring-2 ring-gray-900" />
                          )}
                          {item.user.isVerified && (
                            <span className="absolute -top-0.5 -right-0.5 text-[8px]">✅</span>
                          )}
                        </div>

                        {/* User info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white font-medium text-sm truncate">
                              {item.user.name}
                            </p>
                            {isUser && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 flex-shrink-0">
                                You
                              </span>
                            )}
                            {isCurrentSpeaker && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-green-500/20 text-green-400 flex-shrink-0">
                                🎤
                              </span>
                            )}
                            {item.user.isPremium && (
                              <span className="text-[8px] flex-shrink-0">⭐</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5',
                                getStatusColor(item.status)
                              )}
                            >
                              {getStatusIcon(item.status)}
                              {getStatusLabel(item.status)}
                            </span>
                            {item.invitedBy && (
                              <span className="text-[10px] text-gray-500">
                                invited by moderator
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      {isModerator && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {item.status !== 'SPEAKING' && (
                            <button
                              onClick={() => handlePromote(item.userId)}
                              className="p-1.5 rounded-lg hover:bg-green-500/20 transition-colors text-green-400"
                              title="Promote to speaker"
                            >
                              <Mic className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item.status === 'SPEAKING' && (
                            <button
                              onClick={() => handleDemote(item.userId)}
                              className="p-1.5 rounded-lg hover:bg-yellow-500/20 transition-colors text-yellow-400"
                              title="Demote from speaker"
                            >
                              <VolumeX className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemove(item.userId)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors text-red-400"
                            title="Remove from queue"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                          {item.status === 'SPEAKING' && (
                            <button
                              onClick={() => handleSkip(item.userId)}
                              className="p-1.5 rounded-lg hover:bg-orange-500/20 transition-colors text-orange-400"
                              title="Skip speaker"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              )}

              {/* Show more indicator */}
              {hasMore && (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-500">
                    +{filteredQueue.length - maxVisible} more waiting
                  </p>
                </div>
              )}

              <div ref={queueEndRef} />
            </div>

            {/* Quick actions for moderators */}
            {isModerator && queue.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-700/50 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">
                  {stats.pending} waiting · {stats.speaking} speaking
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const pending = queue.filter(item => item.status === 'PENDING');
                      if (pending.length === 0) {
                        toast.info('No one waiting in queue');
                        return;
                      }
                      // Promote next in queue
                      const next = pending.sort((a, b) => a.position - b.position)[0];
                      handlePromote(next.userId);
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors"
                  >
                    Promote Next
                  </button>
                  <button
                    onClick={() => {
                      if (queue.some(item => item.status === 'SPEAKING')) {
                        toast.info('Someone is already speaking');
                        return;
                      }
                      // Clear queue
                      const pending = queue.filter(item => item.status === 'PENDING');
                      pending.forEach(item => handleRemove(item.userId));
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Clear Queue
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper functions
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0]?.toUpperCase())
    .join('') || '?';
}