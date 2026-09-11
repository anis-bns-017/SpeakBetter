import React, { useState, useMemo } from 'react';
import { ReadReceipt } from '@speakbetter/types';
import { Check, CheckCheck, Eye, Users } from 'lucide-react';

interface ReadReceiptsProps {
  receipts?: ReadReceipt[];
  totalParticipants?: number;
  messageId: string;
  isOwn: boolean;
}

export const ReadReceipts: React.FC<ReadReceiptsProps> = ({
  receipts = [],
  totalParticipants = 2,
  messageId,
  isOwn,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Read receipts only matter for sent messages
  if (!isOwn) return null;

  // Senders are excluded from expected read receipts count
  const expectedReadersCount = Math.max(1, totalParticipants - 1);
  const readCount = receipts.length;
  const deliveredCount = Math.max(0, expectedReadersCount - readCount);
  const isAllRead = readCount >= expectedReadersCount;

  const formatReadTime = (timestamp?: string | Date) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative inline-flex items-center select-none">
      {/* Interactive Read Receipt Trigger */}
      <button
        type="button"
        onClick={() => setShowTooltip((prev) => !prev)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-label={`Read receipt status: ${readCount} of ${expectedReadersCount} read`}
        className="inline-flex items-center gap-1 focus:outline-none transition-opacity hover:opacity-80"
      >
        {isAllRead ? (
          <div className="flex items-center gap-1 text-blue-400">
            <CheckCheck className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold tracking-tight">Read</span>
          </div>
        ) : readCount > 0 ? (
          <div className="flex items-center gap-1 text-white/80">
            <CheckCheck className="w-3.5 h-3.5 opacity-80" />
            <span className="text-[10px] font-medium">
              {readCount}/{expectedReadersCount}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-white/60">
            <Check className="w-3.5 h-3.5" />
            <span className="text-[10px]">Delivered</span>
          </div>
        )}
      </button>

      {/* Detailed Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-56 rounded-xl bg-slate-900/95 text-white p-3 shadow-xl backdrop-blur-md border border-slate-800 text-xs animation-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-medium text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              {isAllRead ? (
                <Eye className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <Users className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isAllRead ? 'Read by everyone' : 'Message Status'}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {readCount}/{expectedReadersCount}
            </span>
          </div>

          {/* Detailed Reader List */}
          {readCount > 0 ? (
            <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {receipts.map((receipt) => (
                <div
                  key={receipt.user.id || receipt.user.name}
                  className="flex items-center justify-between text-[11px] py-0.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {receipt.user.avatar ? (
                      <img
                        src={receipt.user.avatar}
                        alt={receipt.user.name}
                        className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-semibold text-white uppercase flex-shrink-0">
                        {receipt.user.name?.charAt(0) || 'U'}
                      </div>
                    )}
                    <span className="truncate text-slate-200">{receipt.user.name}</span>
                  </div>

                  {receipt.readAt && (
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                      {formatReadTime(receipt.readAt)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-center text-[11px] text-slate-400 py-1">
              Delivered to all participants
            </div>
          )}
        </div>
      )}
    </div>
  );
};