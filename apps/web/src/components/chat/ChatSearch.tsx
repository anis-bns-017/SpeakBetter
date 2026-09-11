import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message } from '@speakbetter/types';
import { Search, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';

interface ChatSearchProps {
  chatId: string;
  onSearch: (query: string) => Promise<Message[]>;
  onMessageClick?: (messageId: string) => void;
  onClose?: () => void;
}

export const ChatSearch: React.FC<ChatSearchProps> = ({
  chatId,
  onSearch,
  onMessageClick,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  
  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Prevent stale async state updates (race conditions)
  useEffect(() => {
    let isSubscribed = true;

    const performSearch = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        if (isSubscribed) {
          setResults([]);
          setShowResults(false);
          setSelectedIndex(-1);
        }
        return;
      }

      setIsLoading(true);
      try {
        const res = await onSearch(debouncedQuery.trim());
        if (isSubscribed) {
          setResults(res || []);
          setShowResults(true);
          setSelectedIndex(res && res.length > 0 ? 0 : -1);
        }
      } catch {
        if (isSubscribed) {
          setResults([]);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      isSubscribed = false;
    };
  }, [debouncedQuery, chatId, onSearch]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ensure keyboard-selected option scrolls into view inside scroll container
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedEl = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) {
      if (e.key === 'Escape') {
        setShowResults(false);
        onClose?.();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowResults(true);
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setShowResults(true);
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const message = results[selectedIndex];
      if (message) {
        handleMessageClick(message);
      }
    } else if (e.key === 'Escape') {
      setShowResults(false);
      onClose?.();
    }
  };

  const handleMessageClick = (message: Message) => {
    if (onMessageClick) {
      onMessageClick(message.id);
      setShowResults(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSelectedIndex(-1);
  };

  const highlightMatch = useCallback((text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-900 px-0.5 rounded font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input Bar */}
      <div className="flex items-center gap-2 bg-gray-100/80 hover:bg-gray-100 border border-transparent focus-within:border-blue-500 focus-within:bg-white rounded-lg px-3 py-1.5 transition-all shadow-sm">
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length > 0) setShowResults(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 2 && setShowResults(true)}
          placeholder="Search in chat..."
          className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
          autoFocus
        />

        {/* Loading Indicator */}
        {isLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}

        {/* Quick Keyboard Stepper Controls */}
        {results.length > 0 && !isLoading && (
          <div className="flex items-center text-xs text-gray-400 gap-0.5 border-r border-gray-200 pr-1.5">
            <span className="text-[11px] font-mono mr-1">
              {selectedIndex + 1}/{results.length}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)}
              className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
              title="Previous match"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev + 1) % results.length)}
              className="p-0.5 hover:bg-gray-200 rounded text-gray-500"
              title="Next match"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Clear/Close Buttons */}
        {query && (
          <button
            type="button"
            onClick={clearSearch}
            className="p-0.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-0.5 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
            title="Close search bar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && query.trim().length >= 2 && (
        <div
          ref={resultsRef}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-80 overflow-y-auto z-50 divide-y divide-gray-100"
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>Searching messages...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              No messages matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map((message, index) => {
              const isSelected = index === selectedIndex;
              const senderName = message.sender?.name || 'Unknown User';
              const senderAvatar = message.sender?.avatarUrl;

              return (
                <button
                  key={message.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleMessageClick(message)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-2.5 ${
                    isSelected ? 'bg-blue-50/80 hover:bg-blue-50' : ''
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {senderAvatar ? (
                      <img
                        src={senderAvatar}
                        alt={senderName}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                        {senderName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {senderName}
                      </span>
                      {message.createdAt && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">
                      {highlightMatch(message.content, query)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};