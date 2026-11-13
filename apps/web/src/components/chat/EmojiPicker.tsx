import React, { useState, useMemo } from 'react';
import { tr } from "../../i18n/core";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// Optional: Map common keywords to emojis for actual search functionality
const EMOJI_KEYWORDS: Record<string, string[]> = {
  '😀': ['smile', 'happy', 'grin'],
  '😂': ['joy', 'laugh', 'tears', 'lol'],
  '😍': ['heart', 'love', 'eyes', 'adore'],
  '👍': ['thumbs', 'up', 'like', 'approve'],
  '❤️': ['heart', 'love', 'red'],
  '🐶': ['dog', 'puppy', 'pet', 'animal'],
  '🍎': ['apple', 'fruit', 'food', 'red'],
  '🚗': ['car', 'drive', 'travel', 'vehicle'],
};

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😊',
    emojis: ['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '🥰', '😘', '😗', '😙', '😚', '☺️', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪', '😫', '😴', '😌', '😛', '😜', '😝', '🤤', '😒', '😓', '😔', '😕', '🙃', '🤑', '😲', '☹️', '🙁', '😖', '😞', '😟', '😤', '😢', '😭', '😦', '😧', '😨', '😩', '🤯', '😬', '😰', '😱', '🥵', '🥶', '😳', '🤪', '😵', '😡', '😠', '🤬'],
  },
  {
    name: 'Gestures',
    icon: '👍',
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '🤌', '🤞', '🖕', '🖐️', '✋', '👋', '🤚', '🖖', '👆', '👇', '👉', '👈', '🙆', '🙅', '💁', '🙋', '🧏', '🙇', '🤦', '🤷'],
  },
  {
    name: 'Hearts',
    icon: '❤️',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  },
  {
    name: 'Animals',
    icon: '🐶',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🐺', '🦄', '🐝', '🦋', '🐢', '🐍', '🐙', '🐬', '🐳', '🦈'],
  },
  {
    name: 'Food',
    icon: '🍎',
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🥦', '🌽', '🥕', '🍞', '🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍪', '🎂', '☕', '🍺', '🍷'],
  },
  {
    name: 'Travel',
    icon: '🚗',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚲', '🛴', '🛵', '🏍️', '✈️', '🚀', '🛸', '🚁', '⛵', '🏠', '🗼', '🗽', '🎡', '🎢'],
  },
  {
    name: 'Flags',
    icon: '🏁',
    emojis: ['🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🇺🇳', '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇧🇷'],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');

  // Memoize filtered results for smooth rendering
  const filteredEmojis = useMemo(() => {
    if (!search.trim()) {
      return EMOJI_CATEGORIES[activeCategory]?.emojis || [];
    }

    const query = search.toLowerCase().trim();
    const allEmojis = EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);

    // Unique match check using exact match or mapped keywords
    return Array.from(new Set(allEmojis)).filter((emoji) => {
      const keywords = EMOJI_KEYWORDS[emoji] || [];
      return keywords.some((kw) => kw.includes(query)) || emoji.includes(query);
    });
  }, [search, activeCategory]);

  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 h-96 flex flex-col overflow-hidden text-gray-800 font-sans">
      {/* Header & Search Bar */}
      <div className="p-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50/50">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder={tr("Search emojis...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder-gray-400"
          />
          <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-xs rounded-full w-4 h-4 flex items-center justify-center bg-gray-100"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label={tr("Close emoji picker")}
        >
          ✕
        </button>
      </div>

      {/* Category Navigation (Hidden during search) */}
      {!search && (
        <div className="flex border-b border-gray-100 px-2 py-1 bg-gray-50/30 overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(i)}
              title={cat.name}
              className={`flex-1 min-w-[36px] py-1 text-base rounded-md transition-all flex justify-center items-center ${
                activeCategory === i
                  ? 'bg-white shadow-sm text-blue-600 font-semibold'
                  : 'text-gray-500 hover:bg-gray-100/80 hover:text-gray-800'
              }`}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emojis Grid Container */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {search && (
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {tr("Search Results ({length})", { length: filteredEmojis.length })}</div>
        )}

        {filteredEmojis.length > 0 ? (
          <div className="grid grid-cols-7 gap-1">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => {
                  onSelect(emoji);
                  onClose();
                }}
                className="w-9 h-9 flex items-center justify-center text-xl hover:bg-blue-50 rounded-lg transition-transform active:scale-95 hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400">
            <span className="text-3xl mb-1">🔍</span>
            <p className="text-sm">{tr("No emojis found")}</p>
          </div>
        )}
      </div>
    </div>
  );
};