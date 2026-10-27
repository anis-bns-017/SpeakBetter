// apps/web/src/components/chat/MessageBubble.tsx
import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { Message } from "../../hooks/useChat";
import { useAuth } from "../../contexts/AuthContext";
import {
  Reply,
  Smile,
  Check,
  CornerDownRight,
  Play,
  Pause,
  Languages,
  Pencil,
  Pin,
  PinOff,
  CheckCheck,
  Music,
  FileText,
  X,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Download,
  Clock,
  Bookmark,
  BookmarkCheck,
  Link2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Info,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  isPinned?: boolean;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: (pinned: boolean) => void;
  onReact?: (emoji: string) => void;
}

const COMMON_EMOJIS = [
  { emoji: "❤️", label: "Love" },
  { emoji: "👍", label: "Like" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Wow" },
  { emoji: "😢", label: "Sad" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🎉", label: "Celebrate" },
  { emoji: "🙏", label: "Pray" },
  { emoji: "💯", label: "100" },
];

const WAVEFORM_BARS = 40;

function buildWaveform(seed: number): number[] {
  return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
    const t = (i + seed) / WAVEFORM_BARS;
    return 0.2 + 0.6 * Math.abs(Math.sin(t * Math.PI * 4.2 + seed * 0.5));
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  isPinned = false,
  isSelected = false,
  isSelectionMode = false,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReact,
}) => {
  const { user } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Lightbox states
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  const waveform = useMemo(
    () => buildWaveform(message.id?.charCodeAt?.(0) || 1),
    [message.id],
  );

  const aggregatedReactions = useMemo(() => {
    return (message.reactions || []).reduce(
      (acc, r) => {
        if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
        acc[r.emoji].count += 1;
        if (r.userId === user?.id) acc[r.emoji].mine = true;
        return acc;
      },
      {} as Record<string, { count: number; mine: boolean }>,
    );
  }, [message.reactions, user?.id]);

  // ── Message type detection ──────────────────────────────────
  const isVoiceNote = message.type === "VOICE_NOTE";
  const isAudio = message.type === "AUDIO";
  const isImage = message.type === "IMAGE";
  const isVideo = message.type === "VIDEO";
  const isGif = message.type === "GIF";
  const isSticker = message.type === "STICKER";
  const isFile = message.type === "FILE";

  const mediaSrc =
    message.mediaUrl || message.fileUrl || message.attachments?.[0]?.url || "";

  const isVoiceOrAudio = isVoiceNote || isAudio;

  const isActuallyVideo =
    !isVoiceOrAudio &&
    (isVideo ||
      Boolean(mediaSrc?.match(/\.(mp4|webm|mov|avi|mkv)/i)) ||
      Boolean(mediaSrc?.includes("video")));

  const isActuallyImage =
    !isVoiceOrAudio &&
    !isActuallyVideo &&
    (isImage ||
      Boolean(mediaSrc?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)/i)) ||
      Boolean(mediaSrc?.includes("image")) ||
      (Boolean(mediaSrc?.includes("cloudinary")) &&
        !mediaSrc?.includes("video") &&
        !mediaSrc?.includes("audio")));

  const typedMessage = message as Message & {
    audioUrl?: string;
    duration?: number;
  };

  const showVoicePlayer = isVoiceOrAudio && Boolean(mediaSrc);
  const messageDuration = duration || typedMessage.duration || 0;

  const isPureVoiceMessage =
    showVoicePlayer &&
    (!message.content?.trim() ||
      message.content.trim().toLowerCase() === "voice message" ||
      message.content.trim().toLowerCase() === "🎤 voice message");

  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
    setLoadError(false);
    setDuration(
      typeof typedMessage.duration === "number" ? typedMessage.duration : 0,
    );
    setIsLoading(false);
  }, [mediaSrc, typedMessage.duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !showVoicePlayer || !mediaSrc) return;

    const onTimeUpdate = () => {
      if (isDraggingRef.current) return;
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
      }
    };

    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        setLoadError(false);
        setIsLoading(false);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setLoadError(true);
      setIsPlaying(false);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => {
      setIsLoading(false);
      setLoadError(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("waiting", onWaiting);

    if (audio.src !== mediaSrc) {
      audio.src = mediaSrc;
      audio.load();
    }
    audio.playbackRate = playbackRate;

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("waiting", onWaiting);
    };
  }, [mediaSrc, showVoicePlayer, playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !mediaSrc) {
      setLoadError(true);
      return;
    }

    if (loadError) {
      setLoadError(false);
      setIsLoading(true);
      audio.src = mediaSrc;
      audio.load();
      audio.play().catch(() => {
        setLoadError(true);
        setIsLoading(false);
      });
      return;
    }

    if (audio.paused) {
      audio.play().catch(() => setLoadError(true));
    } else {
      audio.pause();
    }
  }, [mediaSrc, loadError]);

  const cycleSpeed = useCallback(() => {
    setPlaybackRate((prev) => {
      if (prev === 1) return 1.5;
      if (prev === 1.5) return 2;
      return 1;
    });
  }, []);

  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = waveformRef.current;
      const audio = audioRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const ratio = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width),
      );
      setProgress(ratio);

      const d =
        audio && isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : messageDuration;
      if (audio && d > 0) audio.currentTime = ratio * d;
    },
    [messageDuration],
  );

  const onWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) return;
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );

  const onWaveformPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );

  const onWaveformPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );

  const onWaveformPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );

  const formatTime = (sec: number) => {
    if (!sec || !isFinite(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const playedBars = Math.floor(progress * WAVEFORM_BARS);

  const MessageStatus = () => {
    if (!isOwn) return null;
    if (message.readReceipts && message.readReceipts.length > 0) {
      return (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-0.5"
        >
          <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
          <span className="text-[8px] font-medium text-sky-400/70">Read</span>
        </motion.div>
      );
    }
    if (message.delivered) {
      return <CheckCheck className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />;
    }
    return <Check className="w-3.5 h-3.5 text-slate-400 stroke-[2.5]" />;
  };

  const messageTime = message.createdAt
    ? new Date(message.createdAt)
    : new Date();
  const timeStr = format(messageTime, "HH:mm");
  const relativeTime = formatDistanceToNow(messageTime, { addSuffix: true });

  const translation = message.translations?.[0] || null;
  const hasUrl = message.content?.match(/(https?:\/\/[^\s]+)/g);

  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImageZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);
  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImageZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);
  const handleRotate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImageRotation((prev) => (prev + 90) % 360);
  }, []);
  const handleResetImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setImageZoom(1);
    setImageRotation(0);
  }, []);

  const renderContent = () => {
    // VOICE / AUDIO
    if (showVoicePlayer) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex items-center gap-3 min-w-[250px] max-w-[340px] p-3 rounded-2xl transition-all ${
            isOwn
              ? "bg-indigo-700/30 border border-indigo-400/20"
              : "bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60"
          }`}
        >
          <audio ref={audioRef} preload="metadata" playsInline />

          <motion.button
            type="button"
            onClick={togglePlay}
            disabled={loadError || !mediaSrc}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg transition-all active:scale-95 disabled:opacity-40 ${
              isOwn
                ? "bg-white text-indigo-600 hover:bg-slate-50"
                : "bg-gradient-to-br from-indigo-600 to-violet-600 text-white hover:shadow-xl hover:shadow-indigo-500/20"
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 ml-0.5 fill-current" />
            )}
          </motion.button>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div
              ref={waveformRef}
              className="flex items-center gap-[2px] h-8 cursor-pointer select-none touch-none"
              onClick={onWaveformClick}
              onPointerDown={onWaveformPointerDown}
              onPointerMove={onWaveformPointerMove}
              onPointerUp={onWaveformPointerUp}
              onPointerCancel={onWaveformPointerUp}
            >
              {waveform.map((level, i) => (
                <motion.div
                  key={i}
                  className={`flex-1 min-w-[2px] max-w-[4px] rounded-full transition-all duration-150 ${
                    i < playedBars
                      ? isOwn
                        ? "bg-white"
                        : "bg-gradient-to-b from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400"
                      : isOwn
                        ? "bg-indigo-300/40"
                        : "bg-slate-300 dark:bg-slate-600"
                  }`}
                  style={{
                    height: `${Math.max(15, Math.round(level * 100))}%`,
                  }}
                  animate={{
                    height: isPlaying
                      ? `${Math.max(20, Math.round(level * 120))}%`
                      : `${Math.max(15, Math.round(level * 100))}%`,
                  }}
                  transition={{ duration: 0.1 }}
                />
              ))}
            </div>

            <div
              className={`flex justify-between text-[10px] font-semibold tabular-nums ${
                isOwn
                  ? "text-indigo-100/80"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span>{formatTime(progress * messageDuration)}</span>
              <span>{formatTime(messageDuration)}</span>
            </div>

            {loadError && (
              <div className="flex items-center gap-1.5 text-[10px] text-red-300 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Audio failed to load</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoadError(false);
                    setIsLoading(true);
                    audioRef.current?.load();
                  }}
                  className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 rounded-full transition-colors"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Retry
                </button>
              </div>
            )}
          </div>

          <motion.button
            type="button"
            onClick={cycleSpeed}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className={`shrink-0 min-w-[38px] h-7 px-2 rounded-lg text-[10px] font-bold tabular-nums transition-all ${
              isOwn
                ? "bg-indigo-900/40 hover:bg-indigo-900/60 text-white"
                : "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 border border-slate-200 dark:border-slate-600 hover:shadow-md"
            }`}
          >
            {playbackRate === 1.5 ? "1.5×" : `${playbackRate}×`}
          </motion.button>
        </motion.div>
      );
    }

    if (isVoiceOrAudio && !mediaSrc) {
      return (
        <div
          className={`flex items-center gap-2 text-[11px] font-medium italic ${isOwn ? "text-indigo-200" : "text-slate-500 dark:text-slate-400"}`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Voice message unavailable</span>
        </div>
      );
    }

    // IMAGE
    if (isActuallyImage && mediaSrc) {
      return (
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="relative group/media overflow-hidden rounded-xl border border-black/5 dark:border-white/10 my-1"
        >
          {imageError ? (
            <div className="flex items-center gap-2 p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl">
              <ImageIcon className="w-4 h-4" />
              <span className="text-xs font-medium">Failed to load image</span>
            </div>
          ) : (
            <>
              <img
                src={mediaSrc}
                alt="Attachment"
                className="w-full max-h-80 object-cover rounded-xl cursor-zoom-in transition-all duration-300 hover:scale-[1.02]"
                onClick={() => {
                  setImageZoom(1);
                  setImageRotation(0);
                  setShowFullImage(true);
                }}
                loading="lazy"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-all duration-300 flex items-end justify-between p-3 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setImageZoom(1);
                      setImageRotation(0);
                      setShowFullImage(true);
                    }}
                    className="text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 hover:bg-black/60 transition-all"
                  >
                    <Maximize2 className="w-3 h-3" /> Expand
                  </button>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement("a");
                    link.href = mediaSrc;
                    link.download = `image-${Date.now()}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="p-1.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors pointer-events-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      );
    }

    // VIDEO
    if (isActuallyVideo && mediaSrc) {
      return (
        <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/10 my-1">
          <video
            src={mediaSrc}
            controls
            className="w-full max-h-80 rounded-xl"
            poster={(message as { thumbnailUrl?: string }).thumbnailUrl}
            playsInline
          />
        </div>
      );
    }

    // FILE
    if (isFile && message.fileUrl) {
      return (
        <motion.a
          href={message.fileUrl}
          target="_blank"
          rel="noreferrer"
          whileHover={{ scale: 1.01 }}
          className={`p-3.5 rounded-xl flex items-center gap-3 border text-xs font-semibold transition-all ${
            isOwn
              ? "bg-indigo-700/40 border-indigo-400/30 text-white hover:bg-indigo-700/60"
              : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-400">
            <FileText className="w-4 h-4" />
          </div>
          <span className="truncate flex-1">
            {(message as { fileName?: string }).fileName ||
              "Download attachment"}
          </span>
          <Download className="w-3.5 h-3.5 opacity-70 shrink-0" />
        </motion.a>
      );
    }

    // TEXT CONTENT
    if (message.content && !isPureVoiceMessage) {
      return (
        <div className="leading-relaxed font-normal whitespace-pre-wrap break-words tracking-normal">
          {hasUrl ? (
            <div className="space-y-1">
              <span>{message.content.replace(hasUrl[0], "")}</span>
              <a
                href={hasUrl[0]}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all ${
                  isOwn
                    ? "bg-indigo-700/40 text-indigo-100 hover:bg-indigo-700/60"
                    : "bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Link2 className="w-3 h-3" />
                {hasUrl[0].length > 30
                  ? hasUrl[0].slice(0, 30) + "..."
                  : hasUrl[0]}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          ) : (
            message.content
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, type: "spring", damping: 25 }}
      className={`group relative flex items-end gap-3 my-2 transition-all ${
        isOwn ? "flex-row-reverse" : "flex-row"
      } ${isSelected ? "bg-gradient-to-r from-indigo-50/80 to-violet-50/80 dark:from-indigo-950/20 dark:to-violet-950/20 p-2 rounded-3xl" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sender Avatar */}
      {!isSelectionMode && !isOwn && (
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="relative w-9 h-9 rounded-full shrink-0"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
              {message.sender?.avatarUrl ? (
                <img
                  src={message.sender.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  {message.sender?.name?.charAt(0).toUpperCase() || "U"}
                </span>
              )}
            </div>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 shadow-sm" />
        </motion.div>
      )}

      <div className="relative max-w-[85%] sm:max-w-[72%] lg:max-w-[65%]">
        {/* Pinned Badge */}
        {isPinned && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-1.5 mb-1 text-[10px] font-semibold ${isOwn ? "justify-end" : "justify-start"}`}
          >
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Pin className="w-2.5 h-2.5 fill-current" /> Pinned
            </span>
          </motion.div>
        )}

        {/* Quick Action Toolbar — Cleaned up & Repositioned */}
        <AnimatePresence>
          {!isSelectionMode && isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 400 }}
              className={`absolute top-0 -translate-y-1/2 z-20 flex items-center gap-0.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-700/80 shadow-xl rounded-full p-1 ${
                isOwn ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
              }`}
            >
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={onReply}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
              {isOwn && (
                <>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                  <button
                    type="button"
                    onClick={onEdit}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onPin?.(!isPinned)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
                  >
                    {isPinned ? (
                      <PinOff className="w-3.5 h-3.5" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                  <button
                    type="button"
                    onClick={onDelete}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full text-slate-500 dark:text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
              <button
                type="button"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
              >
                {isBookmarked ? (
                  <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{ type: "spring", damping: 20, stiffness: 400 }}
              className={`absolute z-30 bottom-full mb-2.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xl min-w-[220px] ${isOwn ? "right-0" : "left-0"}`}
            >
              <div className="grid grid-cols-5 gap-1.5">
                {COMMON_EMOJIS.map(({ emoji, label }) => (
                  <motion.button
                    key={emoji}
                    type="button"
                    whileHover={{ scale: 1.3, rotate: -5 }}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => {
                      onReact?.(emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-xl transition-all relative group/emoji"
                  >
                    {emoji}
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] bg-slate-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover/emoji:opacity-100 transition-opacity whitespace-nowrap">
                      {label}
                    </span>
                  </motion.button>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stickers & GIFs */}
        {isSticker && mediaSrc ? (
          <motion.img
            whileHover={{ scale: 1.05, rotate: -2 }}
            transition={{ type: "spring", damping: 20 }}
            src={mediaSrc}
            alt="sticker"
            className="w-36 h-36 object-contain drop-shadow-xl"
          />
        ) : isGif && mediaSrc ? (
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="relative overflow-hidden rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-lg"
          >
            <img
              src={mediaSrc}
              alt="gif"
              className="w-full max-h-64 object-cover"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md text-white text-[9px] font-semibold rounded-full">
              GIF
            </div>
          </motion.div>
        ) : (
          /* Main Chat Bubble */
          <motion.div
            layout
            className={`relative p-4 sm:p-4.5 rounded-2xl text-xs sm:text-[13px] space-y-2.5 shadow-lg transition-all ${
              isOwn
                ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-tr-sm shadow-indigo-500/20 dark:shadow-indigo-500/30"
                : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-tl-sm shadow-slate-200/50 dark:shadow-slate-800/30"
            } ${isSelected ? "ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900" : ""}`}
          >
            {!isOwn && message.sender?.name && !isPureVoiceMessage && (
              <div className="flex items-center gap-2 font-bold text-[11px] text-indigo-600 dark:text-indigo-400 tracking-wide">
                <span>{message.sender.name}</span>
                <span className="w-1 h-1 rounded-full bg-indigo-300 dark:bg-indigo-700" />
                <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                  {relativeTime}
                </span>
              </div>
            )}

            {message.replyTo && (
              <motion.div
                initial={{ opacity: 0, x: isOwn ? 10 : -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-2.5 rounded-xl border-l-3 text-[11px] flex items-start gap-2.5 ${isOwn ? "bg-indigo-700/40 border-indigo-300/60 text-indigo-100" : "bg-slate-100/80 dark:bg-slate-800/80 border-indigo-400 text-slate-600 dark:text-slate-300"}`}
              >
                <CornerDownRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold block text-[10px] opacity-85">
                    {message.replyTo.sender?.name}
                  </span>
                  <p className="truncate font-normal opacity-90">
                    {message.replyTo.content || "📎 Media attachment"}
                  </p>
                </div>
              </motion.div>
            )}

            {renderContent()}

            {translation && !isPureVoiceMessage && (
              <motion.button
                type="button"
                onClick={() => setShowTranslation((v) => !v)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                className={`flex items-center gap-1.5 text-[10px] font-semibold transition-all ${isOwn ? "text-indigo-200 hover:text-white" : "text-indigo-600 dark:text-indigo-400 hover:underline"}`}
              >
                <Languages className="w-3 h-3" />
                {showTranslation ? "Hide translation" : "See translation"}
              </motion.button>
            )}

            {showTranslation && translation && !isPureVoiceMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`text-[11px] italic pt-1.5 border-t ${isOwn ? "border-indigo-400/30 text-indigo-100" : "border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400"}`}
              >
                {translation.translatedContent}
              </motion.div>
            )}

            <div
              className={`flex items-center justify-end gap-2 text-[10px] font-medium pt-1 select-none ${isOwn ? "text-indigo-100/70" : "text-slate-400 dark:text-slate-500"}`}
            >
              {message.isEdited && (
                <span className="flex items-center gap-0.5 opacity-80 italic text-[9px]">
                  <Pencil className="w-2.5 h-2.5" /> edited
                </span>
              )}
              <span
                className="flex items-center gap-1"
                title={format(messageTime, "PPpp")}
              >
                <Clock className="w-2.5 h-2.5 opacity-50" /> {timeStr}
              </span>
              <span className="text-[8px] opacity-50">•</span>
              <span className="text-[9px] opacity-70">{relativeTime}</span>
              {isOwn && (
                <>
                  <span className="text-[8px] opacity-50">•</span>
                  <MessageStatus />
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Reactions Bar */}
        {Object.keys(aggregatedReactions).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-1 mt-1.5 flex-wrap ${isOwn ? "justify-end" : "justify-start"}`}
          >
            {Object.entries(aggregatedReactions).map(
              ([emoji, { count, mine }]) => (
                <motion.button
                  key={emoji}
                  type="button"
                  whileHover={{ scale: 1.1, y: -1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => onReact?.(emoji)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-sm text-[11px] font-semibold transition-all ${mine ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-indigo-500/10" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"}`}
                >
                  <span className="text-sm">{emoji}</span>
                  {count > 1 && (
                    <span className="text-[10px] font-bold opacity-80">
                      {count}
                    </span>
                  )}
                  {mine && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500" />
                  )}
                </motion.button>
              ),
            )}
          </motion.div>
        )}
      </div>

      {/* Lightbox - Image Viewer with Zoom & Rotation */}
      <AnimatePresence>
        {showFullImage && mediaSrc && isActuallyImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
            onClick={() => {
              setShowFullImage(false);
              setImageZoom(1);
              setImageRotation(0);
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative w-full h-full flex items-center justify-center"
                style={{ minHeight: "50vh", maxHeight: "85vh" }}
              >
                <motion.img
                  src={mediaSrc}
                  alt="Full preview"
                  className="object-contain rounded-2xl select-none"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "85vh",
                    transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                    transition: "transform 0.3s ease-out",
                    cursor: imageZoom > 1 ? "grab" : "default",
                  }}
                  drag={imageZoom > 1}
                  dragConstraints={{
                    left: -200 * imageZoom,
                    right: 200 * imageZoom,
                    top: -200 * imageZoom,
                    bottom: 200 * imageZoom,
                  }}
                  dragTransition={{ bounceStiffness: 200, bounceDamping: 20 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="text-white/60 text-xs bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                    {message.sender?.name || "Unknown"}
                  </span>
                  <span className="text-white/40 text-xs bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                    {format(messageTime, "PPpp")}
                  </span>
                </div>
                <div className="flex items-center gap-2 pointer-events-auto">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={handleZoomOut}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={handleZoomIn}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={handleRotate}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                    title="Rotate"
                  >
                    <RotateCw className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={handleResetImage}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                    title="Reset"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </motion.button>
                  <motion.a
                    href={mediaSrc}
                    target="_blank"
                    rel="noreferrer"
                    download
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                    title="Download Image"
                  >
                    <Download className="w-4 h-4" />
                  </motion.a>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.9 }}
                    type="button"
                    onClick={() => {
                      setShowFullImage(false);
                      setImageZoom(1);
                      setImageRotation(0);
                    }}
                    className="p-2 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-md transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {imageZoom !== 1 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 text-xs bg-black/40 backdrop-blur-md px-3 py-1 rounded-full pointer-events-none">
                  {Math.round(imageZoom * 100)}%
                </div>
              )}

              <div className="absolute bottom-4 left-4 text-white/40 text-xs bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full pointer-events-none">
                {imageZoom > 1 ? "Drag to pan" : "Click to zoom in"}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
