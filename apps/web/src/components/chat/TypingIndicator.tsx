import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';

interface TypingIndicatorProps {
  users: string[];
  maxVisible?: number;
  showAvatars?: boolean;
  className?: string;
  variant?: 'light' | 'dark' | 'gradient';
  onUserClick?: (userName: string) => void;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ 
  users, 
  maxVisible = 3,
  showAvatars = false,
  className = '',
  variant = 'light',
  onUserClick,
}) => {
  const [, setVisibleUsers] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Animate users entering and leaving
  useEffect(() => {
    setVisibleUsers(users);
  }, [users]);

  if (users.length === 0) return null;

  // Format the text based on how many users are typing
  const formatText = (): string => {
    const visible = users.slice(0, maxVisible);
    const remaining = users.length - visible.length;

    if (users.length === 1) {
      return `${visible[0]} is typing`;
    }

    if (remaining === 0) {
      if (visible.length === 2) {
        return `${visible[0]} and ${visible[1]} are typing`;
      }
      // Oxford comma for 3+ visible users
      return `${visible.slice(0, -1).join(', ')}, and ${visible[visible.length - 1]} are typing`;
    }

    // If we exceed maxVisible
    const plural = remaining > 1 ? 'others' : 'other';
    return `${visible.join(', ')} and ${remaining} ${plural} are typing`;
  };

  // Get user initials for avatar
  const getUserInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Get random color for avatar
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  const text = formatText();

  // Variant styles
  const variantStyles = {
    light: {
      container: 'bg-white border-slate-200 text-slate-700 shadow-sm',
      dot: 'bg-indigo-500',
      text: 'text-slate-600',
      avatar: 'bg-indigo-100 text-indigo-600',
    },
    dark: {
      container: 'bg-slate-800 border-slate-700 text-slate-200 shadow-xl',
      dot: 'bg-indigo-400',
      text: 'text-slate-300',
      avatar: 'bg-indigo-900 text-indigo-300',
    },
    gradient: {
      container: 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200 text-indigo-700 shadow-sm',
      dot: 'bg-indigo-500',
      text: 'text-indigo-600',
      avatar: 'bg-indigo-200 text-indigo-700',
    },
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ 
          type: 'spring', 
          damping: 20, 
          stiffness: 300,
          duration: 0.3 
        }}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl rounded-bl-md border w-fit max-w-full ${styles.container} ${className}`}
        role="status"
        aria-live="polite"
        aria-label={text}
      >
        {/* Avatars */}
        {showAvatars && (
          <div className="flex -space-x-2">
            {users.slice(0, maxVisible).map((user, index) => (
              <motion.div
                key={user}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`w-6 h-6 rounded-full ${getAvatarColor(user)} text-white flex items-center justify-center text-[8px] font-bold border-2 ${styles.container.split(' ')[0]} border-opacity-50 cursor-pointer hover:scale-110 transition-transform`}
                onClick={() => onUserClick?.(user)}
                title={user}
              >
                {getUserInitials(user)}
              </motion.div>
            ))}
            {users.length > maxVisible && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: maxVisible * 0.1 }}
                className="w-6 h-6 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[8px] font-bold border-2 border-white cursor-pointer hover:bg-slate-400 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
                title={`${users.length - maxVisible} more users`}
              >
                +{users.length - maxVisible}
              </motion.div>
            )}
          </div>
        )}

        {/* Typing dots */}
        <div className="flex items-center gap-1">
          <style>{`
            @keyframes typing-bounce {
              0%, 60%, 100% { 
                transform: translateY(0); 
                opacity: 0.4; 
              }
              30% { 
                transform: translateY(-5px); 
                opacity: 1; 
              }
            }
            .typing-dot {
              animation: typing-bounce 1.2s infinite ease-in-out;
            }
          `}</style>
          
          <span 
            className={`w-2 h-2 rounded-full ${styles.dot} typing-dot`}
            style={{ animationDelay: '0ms' }}
          />
          <span 
            className={`w-2 h-2 rounded-full ${styles.dot} typing-dot`}
            style={{ animationDelay: '150ms' }}
          />
          <span 
            className={`w-2 h-2 rounded-full ${styles.dot} typing-dot`}
            style={{ animationDelay: '300ms' }}
          />
        </div>

        {/* Text */}
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${styles.text} truncate max-w-[200px]`}>
            {text}
          </span>
          
          {/* Expand/contract button for long lists */}
          {users.length > maxVisible + 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-0.5 rounded hover:bg-opacity-20 hover:bg-slate-500 transition-colors ${styles.text}`}
              title={isExpanded ? 'Show fewer' : 'Show all'}
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Expanded user list */}
        {isExpanded && users.length > maxVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -5 }}
            className="absolute bottom-full left-0 mb-2 p-2 bg-white rounded-xl shadow-xl border border-slate-100 min-w-[150px] max-w-[250px] z-50"
          >
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-semibold text-slate-500 px-1 pb-1 border-b border-slate-100">
                Currently typing ({users.length})
              </p>
              {users.map((user) => (
                <button
                  key={user}
                  onClick={() => {
                    onUserClick?.(user);
                    setIsExpanded(false);
                  }}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded-lg text-xs text-slate-700 transition-colors"
                >
                  <div className={`w-5 h-5 rounded-full ${getAvatarColor(user)} text-white flex items-center justify-center text-[8px] font-bold`}>
                    {getUserInitials(user)}
                  </div>
                  <span className="truncate">{user}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// Enhanced TypingIndicator with group support
interface GroupTypingIndicatorProps extends TypingIndicatorProps {
  groupName?: string;
  totalMembers?: number;
}

export const GroupTypingIndicator: React.FC<GroupTypingIndicatorProps> = ({
  users,
  groupName,
  totalMembers,
  ...props
}) => {
  if (users.length === 0) return null;

  return (
    <div className="relative">
      <TypingIndicator 
        users={users} 
        {...props}
        showAvatars={true}
        variant="gradient"
      />
      {groupName && (
        <div className="absolute -bottom-2 left-4 text-[8px] text-slate-400 bg-white px-1.5 py-0.5 rounded-full border border-slate-100">
          {groupName} {totalMembers && `· ${totalMembers} members`}
        </div>
      )}
    </div>
  );
};

// TypingIndicator with user status
interface TypingIndicatorWithStatusProps extends TypingIndicatorProps {
  status?: 'active' | 'idle' | 'away';
  lastActive?: Date;
}

export const TypingIndicatorWithStatus: React.FC<TypingIndicatorWithStatusProps> = ({
  users,
  status = 'active',
  lastActive,
  ...props
}) => {
  const statusColors = {
    active: 'bg-emerald-500',
    idle: 'bg-yellow-500',
    away: 'bg-slate-400',
  };

  const statusText = {
    active: 'Active now',
    idle: 'Idle',
    away: 'Away',
  };

  if (users.length === 0) return null;

  return (
    <div className="relative">
      <TypingIndicator users={users} {...props} />
      {users.length === 1 && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`} />
          <span className="text-[10px] text-slate-400">
            {statusText[status]}
            {lastActive && ` · ${new Date(lastActive).toLocaleTimeString()}`}
          </span>
        </div>
      )}
    </div>
  );
};

// Hook for managing typing users
export const useTypingUsers = (maxUsers: number = 10) => {
  const [typingUsers, setTypingUsers] = useState<Map<string, number>>(new Map());

  const addTypingUser = (userId: string) => {
    setTypingUsers(prev => {
      const newMap = new Map(prev);
      newMap.set(userId, Date.now());
      return newMap;
    });
  };

  const removeTypingUser = (userId: string) => {
    setTypingUsers(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  };

  // Auto-remove users who haven't typed for 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        let hasChanges = false;
        for (const [userId, timestamp] of newMap) {
          if (now - timestamp > 3000) {
            newMap.delete(userId);
            hasChanges = true;
          }
        }
        return hasChanges ? newMap : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getUserNames = (userMap: Map<string, string>) => {
    return Array.from(typingUsers.keys())
      .map(id => userMap.get(id) || id)
      .slice(0, maxUsers);
  };

  return {
    typingUsers,
    addTypingUser,
    removeTypingUser,
    getUserNames,
    isUserTyping: (userId: string) => typingUsers.has(userId),
    count: typingUsers.size,
  };
};