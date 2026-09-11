import React, { useState, useMemo } from 'react';
import { Chat } from '@speakbetter/types';
import {
  Hash,
  Volume2,
  Megaphone,
  Folder,
  Lock,
  Plus,
  ChevronDown,
  ChevronRight,
  BellOff,
} from 'lucide-react';

// Extended Chat interface fallback in case parentId/isPrivate aren't on core type
interface ExtendedChat extends Chat {
  type: 'TEXT' | 'VOICE' | 'ANNOUNCEMENT' | 'CATEGORY' | 'PRIVATE';
  parentId?: string | null;
  isPrivate?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
}

interface ChannelListProps {
  channels: ExtendedChat[];
  communityId?: string;
  onSelectChannel: (channelId: string) => void;
  selectedChannelId?: string;
  isAdmin?: boolean;
  onCreateChannel?: (categoryId?: string) => void;
}

interface ChannelItemProps {
  channel: ExtendedChat;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const getChannelIcon = (type: string) => {
  switch (type) {
    case 'VOICE':
      return Volume2;
    case 'ANNOUNCEMENT':
      return Megaphone;
    case 'CATEGORY':
      return Folder;
    default:
      return Hash;
  }
};

const getChannelColor = (type: string, isSelected: boolean) => {
  if (isSelected) return 'text-slate-900 dark:text-white';
  switch (type) {
    case 'ANNOUNCEMENT':
      return 'text-amber-500';
    case 'VOICE':
      return 'text-emerald-500';
    default:
      return 'text-slate-400 group-hover:text-slate-600 dark:text-slate-400 dark:group-hover:text-slate-300';
  }
};

const ChannelItem: React.FC<ChannelItemProps> = ({ channel, isSelected, onSelect }) => {
  const Icon = getChannelIcon(channel.type);
  const iconColor = getChannelColor(channel.type, isSelected);

  return (
    <button
      onClick={() => onSelect(channel.id)}
      className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-all ${
        isSelected
          ? 'bg-slate-200/80 text-slate-900 font-semibold dark:bg-slate-800 dark:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`w-4 h-4 shrink-0 transition-colors ${iconColor}`} />
        <span className="truncate leading-none">{channel.name}</span>
      </div>

      <div className="flex items-center gap-1.5 ml-2 shrink-0">
        {channel.isMuted && <BellOff className="w-3 h-3 text-slate-400" />}
        {(channel.isPrivate || channel.type === 'PRIVATE') && (
          <Lock className="w-3 h-3 text-slate-400" />
        )}
        {Boolean(channel.unreadCount && channel.unreadCount > 0) && (
          <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 text-[10px] font-bold bg-blue-600 text-white rounded-full">
            {channel.unreadCount! > 99 ? '99+' : channel.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
};

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  onSelectChannel,
  selectedChannelId,
  isAdmin = false,
  onCreateChannel,
}) => {
  // Categorization & Grouping Logic
  const { categories, uncategorized } = useMemo(() => {
    const categoryMap = new Map<string, { category: ExtendedChat; channels: ExtendedChat[] }>();
    const uncategorizedList: ExtendedChat[] = [];

    // First pass: locate categories
    channels.forEach((channel) => {
      if (channel.type === 'CATEGORY') {
        categoryMap.set(channel.id, { category: channel, channels: [] });
      }
    });

    // Second pass: assign channels to parent categories or root
    channels.forEach((channel) => {
      if (channel.type === 'CATEGORY') return;

      if (channel.parentId && categoryMap.has(channel.parentId)) {
        categoryMap.get(channel.parentId)!.channels.push(channel);
      } else {
        uncategorizedList.push(channel);
      }
    });

    return {
      categories: Array.from(categoryMap.values()),
      uncategorized: uncategorizedList,
    };
  }, [channels]);

  // Set default expanded state for all category IDs
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  return (
    <div className="w-full space-y-3 px-2 py-2 select-none">
      {/* Uncategorized Channels */}
      {uncategorized.length > 0 && (
        <div className="space-y-0.5">
          {uncategorized.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isSelected={selectedChannelId === channel.id}
              onSelect={onSelectChannel}
            />
          ))}
        </div>
      )}

      {/* Categorized Channels */}
      {categories.map(({ category, channels: categoryChannels }) => {
        const isCollapsed = collapsedCategories.has(category.id);

        return (
          <div key={category.id} className="space-y-0.5">
            {/* Category Header */}
            <div className="group/cat flex items-center justify-between px-1 py-1 rounded hover:bg-slate-100/50 dark:hover:bg-slate-800/30">
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex items-center gap-1 text-xs font-bold tracking-wider text-slate-500 uppercase hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                <span className="truncate">{category.name}</span>
              </button>

              {isAdmin && onCreateChannel && (
                <button
                  onClick={() => onCreateChannel(category.id)}
                  title="Create Channel in Category"
                  className="opacity-0 group-hover/cat:opacity-100 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Child Channels */}
            {!isCollapsed && (
              <div className="pl-2 space-y-0.5 border-l border-slate-200/60 dark:border-slate-800 ml-2">
                {categoryChannels.map((channel) => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isSelected={selectedChannelId === channel.id}
                    onSelect={onSelectChannel}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Root Add Channel Action */}
      {isAdmin && onCreateChannel && (
        <button
          onClick={() => onCreateChannel()}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Channel</span>
        </button>
      )}
    </div>
  );
};