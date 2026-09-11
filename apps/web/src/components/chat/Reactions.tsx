import React, { useState, useMemo } from 'react';
import { Reaction } from '@speakbetter/types';
import { Smile, ChevronDown, ChevronUp } from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';

interface ReactionsProps {
  reactions: Reaction[];
  onAdd: (emoji: string) => void;
  onRemove: (emoji: string) => void;
  onReactionClick?: (reaction: Reaction) => void;
  currentUserId: string;
}

const DEFAULT_PRESETS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export const Reactions: React.FC<ReactionsProps> = ({
  reactions = [],
  onAdd,
  onRemove,
  onReactionClick,
  currentUserId,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);

  // Group reactions by emoji key
  const grouped = useMemo(() => {
    return reactions.reduce((acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = [];
      acc[r.emoji].push(r);
      return acc;
    }, {} as Record<string, Reaction[]>);
  }, [reactions]);

  // Set of emojis current user reacted with
  const userReactedSet = useMemo(() => {
    const set = new Set<string>();
    reactions.forEach((r) => {
      if (r.userId === currentUserId) set.add(r.emoji);
    });
    return set;
  }, [reactions, currentUserId]);

  const handleToggleReaction = (emoji: string) => {
    if (userReactedSet.has(emoji)) {
      onRemove(emoji);
    } else {
      onAdd(emoji);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    handleToggleReaction(emoji);
    setShowPicker(false);
  };

  // Sort emojis by reaction count descending
  const sortedEmojis = useMemo(() => {
    return Object.keys(grouped).sort((a, b) => {
      const countA = grouped[a].length;
      const countB = grouped[b].length;
      if (countA !== countB) return countB - countA;
      return a.localeCompare(b);
    });
  }, [grouped]);

  const displayEmojis = expanded ? sortedEmojis : sortedEmojis.slice(0, 6);

  // Helper to format user names for hover tooltips
  const getTooltipText = (emoji: string) => {
    const userList = grouped[emoji] || [];
    if (userList.length === 0) return '';

    const names = userList.map((r) =>
      r.userId === currentUserId ? 'You' : r.userName || 'Someone'
    );

    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  };

  return (
    <div className="flex items-center gap-1 flex-wrap select-none text-xs">
      {/* Existing reactions list */}
      {displayEmojis.map((emoji) => {
        const count = grouped[emoji].length;
        const isUserReacted = userReactedSet.has(emoji);

        return (
          <div key={emoji} className="relative group">
            <button
              type="button"
              onClick={() => {
                handleToggleReaction(emoji);
                if (onReactionClick && grouped[emoji]?.[0]) {
                  onReactionClick(grouped[emoji][0]);
                }
              }}
              onMouseEnter={() => setHoveredEmoji(emoji)}
              onMouseLeave={() => setHoveredEmoji(null)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all active:scale-95 ${
                isUserReacted
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium shadow-sm'
                  : 'bg-gray-100/80 border-gray-200 text-gray-700 hover:bg-gray-200/80'
              }`}
            >
              <span className="text-sm leading-none">{emoji}</span>
              <span className="text-[11px]">{count}</span>
            </button>

            {/* User Names Tooltip */}
            {hoveredEmoji === emoji && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-900 text-white text-[10px] rounded shadow-md whitespace-nowrap z-40 pointer-events-none">
                {getTooltipText(emoji)}
              </div>
            )}
          </div>
        );
      })}

      {/* Show More / Show Less Toggle Button */}
      {sortedEmojis.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
        >
          {expanded ? (
            <>
              <span>Less</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>+{sortedEmojis.length - 6}</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}

      {/* Add Reaction Button & Popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((prev) => !prev)}
          aria-label="Add reaction"
          className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-gray-300 hover:border-gray-400 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all active:scale-95"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>

        {/* Emoji Picker Modal / Dropdown */}
        {showPicker && (
          <>
            {/* Backdrop for click-outside dismissal */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPicker(false)}
            />

            <div className="absolute bottom-full left-0 mb-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="relative bg-white rounded-xl shadow-xl border border-gray-200 p-1">
                {/* Quick Presets Toolbar */}
                <div className="flex items-center gap-1 p-1 border-b border-gray-100 mb-1">
                  {DEFAULT_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiSelect(emoji)}
                      className={`p-1.5 text-base rounded hover:bg-gray-100 transition-transform active:scale-125 ${
                        userReactedSet.has(emoji) ? 'bg-blue-50' : ''
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowPicker(false)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};