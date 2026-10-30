// apps/web/src/components/chat/MessageBubble.tsx
import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { format, formatDistanceToNow, isThisYear, isToday } from "date-fns";
import type { Message } from "../../hooks/useChat";
import { useAuth } from "../../contexts/AuthContext";
import { CorrectionCard } from "./CorrectionCard";
import { canSpeak, speak, stopSpeaking } from "../../lib/speech";
import {
  SpellCheck2,
  Volume2 as ListenIcon,
  Square as StopIcon,
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
  Forward,
  Timer,
  Eye,
  EyeOff,
  Loader2,
  Captions,
  AtSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { apiErrorMessage, chatApi } from "../../hooks/useChat";

const formatBytes = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Highlights @mentions in message text */
const withMentions = (text: string, isOwn: boolean) =>
  text.split(/(@[\p{L}\p{N}_.-]+)/u).map((part, i) =>
    part.startsWith("@") && part.length > 1 ? (
      <span
        key={i}
        className={`rounded px-0.5 font-semibold ${isOwn ? "bg-white/15 text-white" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"}`}
      >
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );

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
  /** Open the correction composer for this (someone else's) message */
  onCorrect?: () => void;
  /** Accept a CORRECTION message addressed to me */
  onAcceptCorrection?: () => void;
  onForward?: () => void;
  /** Save / unsave (bookmark) this message */
  onToggleSave?: () => void;
  /** Sent / delivered / read details (own messages) */
  onInfo?: () => void;
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
  onCorrect,
  onAcceptCorrection,
  onForward,
  onToggleSave,
  onInfo,
}) => {
  const { user } = useAuth();
  const [showEditHistory, setShowEditHistory] = useState(false);
  /** Clicked album item for the lightbox (defaults to the message's own media) */
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  /** View-once media URL while it's open (it's deleted after) */
  const [viewOnceMedia, setViewOnceMedia] = useState<{ url: string; type: string } | null>(null);
  const [openingViewOnce, setOpeningViewOnce] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(message.metadata?.transcript?.text ?? null);
  const [transcriptTranslation, setTranscriptTranslation] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState<"transcribe" | "translate" | null>(null);
  const mentionsMe = !isOwn && !!user?.id && !!message.metadata?.mentions?.includes(user.id);
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
  /** Reading this message aloud (pronunciation practice) */
  const [isSpeaking, setIsSpeaking] = useState(false);

  const toggleListen = useCallback(
    async (slow: boolean) => {
      if (isSpeaking) {
        stopSpeaking();
        setIsSpeaking(false);
        return;
      }
      const text = message.content;
      if (!text?.trim()) return;
      setIsSpeaking(true);
      await speak(text, { rate: slow ? 0.7 : 0.95 });
      setIsSpeaking(false);
    },
    [isSpeaking, message.content, message.type],
  );

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

  const rawMediaSrc =
    message.mediaUrl || message.fileUrl || message.attachments?.[0]?.url || "";
  // Older messages may hold a blob: preview link that only ever existed in the sender's
  // tab — it can never load, so treat it as unavailable instead of requesting it
  const isLostAttachment = rawMediaSrc.startsWith("blob:");
  const mediaSrc = isLostAttachment ? "" : rawMediaSrc;

  const isVoiceOrAudio = isVoiceNote || isAudio;

  // Document messages are never guessed to be media from their URL
  // (a raw Cloudinary PDF link would otherwise look like an image)
  const isActuallyVideo =
    !isVoiceOrAudio &&
    !isFile &&
    (isVideo ||
      Boolean(mediaSrc?.match(/\.(mp4|webm|mov|avi|mkv)/i)) ||
      Boolean(mediaSrc?.includes("video")));

  const isActuallyImage =
    !isVoiceOrAudio &&
    !isFile &&
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
  // Length saved by the sender when recording (browser-recorded WebM files often
  // carry no duration, so the <audio> element reports Infinity)
  const metaDuration = Number(message.metadata?.duration);
  const storedDuration =
    Number.isFinite(metaDuration) && metaDuration > 0
      ? metaDuration
      : typeof typedMessage.duration === "number"
        ? typedMessage.duration
        : 0;
  const messageDuration = duration || storedDuration || 0;
  /** True while seeking to the end to make Chrome compute a WebM file's length */
  const fixingDurationRef = useRef(false);

  const isPureVoiceMessage =
    showVoicePlayer &&
    (!message.content?.trim() ||
      message.content.trim().toLowerCase() === "voice message" ||
      message.content.trim().toLowerCase() === "🎤 voice message");

  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
    setLoadError(false);
    setDuration(storedDuration);
    setIsLoading(false);
  }, [mediaSrc, storedDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !showVoicePlayer || !mediaSrc) return;

    const knownLength = () =>
      isFinite(audio.duration) && audio.duration > 0 ? audio.duration : storedDuration;

    const onTimeUpdate = () => {
      if (isDraggingRef.current || fixingDurationRef.current) return;
      const length = knownLength();
      if (length > 0) setProgress(Math.min(1, audio.currentTime / length));
    };

    const onLoaded = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        setLoadError(false);
        setIsLoading(false);
        // Finished the WebM fix-up: jump back to the start
        if (fixingDurationRef.current) {
          fixingDurationRef.current = false;
          audio.currentTime = 0;
        }
        return;
      }
      // WebM recorded in the browser: duration is Infinity until we seek past the end
      if (audio.duration === Infinity && !fixingDurationRef.current) {
        fixingDurationRef.current = true;
        audio.currentTime = 1e101;
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
  }, [mediaSrc, showVoicePlayer, playbackRate, storedDuration]);

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
    // The server also stores the sender's own receipt, so only others count as "Seen"
    const seenBy = message.readReceipts?.find((r) => r.userId !== message.senderId);
    if (seenBy) {
      return (
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="flex items-center gap-0.5"
          title={seenBy.readAt ? `Seen ${formatDistanceToNow(new Date(seenBy.readAt), { addSuffix: true })}` : "Seen"}
        >
          <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
          <span className="text-[10px] font-medium text-sky-400/80">Seen</span>
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
  /** "14:05" today, "Oct 29, 14:05" this year, "Oct 29, 2025, 14:05" before that */
  const hoverTimeLabel = isToday(messageTime)
    ? format(messageTime, "HH:mm")
    : isThisYear(messageTime)
      ? format(messageTime, "MMM d, HH:mm")
      : format(messageTime, "MMM d, yyyy, HH:mm");

  const translation = message.translations?.[0] || null;
  const hasUrl = message.content?.match(/(https?:\/\/[^\s]+)/g);
  const linkPreview = message.metadata?.linkPreview;
  const editHistory = message.metadata?.editHistory ?? [];
  const albumItems = (message.attachments ?? []).filter((a) => a.type === "IMAGE" || a.type === "VIDEO");
  const viewedBy = message.metadata?.viewedBy ?? [];
  const iOpenedViewOnce = viewedBy.some((v) => v.userId === user?.id);

  /** Text sent with a photo, video or file (placeholders like the file name aren't captions) */
  const caption = useMemo(() => {
    const text = message.content?.trim();
    if (!text) return "";
    if (message.type === "IMAGE" || message.type === "VIDEO") return text === "Voice message" ? "" : text;
    if (message.type === "FILE") {
      return text === "File" || text === message.metadata?.fileName || text === "Voice message" ? "" : text;
    }
    return "";
  }, [message.content, message.type, message.metadata?.fileName]);

  const openViewOnce = useCallback(async () => {
    setOpeningViewOnce(true);
    try {
      const { data } = await chatApi.openViewOnce(message.id);
      setViewOnceMedia(data);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't open this"));
    } finally {
      setOpeningViewOnce(false);
    }
  }, [message.id]);

  const runTranscribe = useCallback(async () => {
    setTranscribing("transcribe");
    try {
      const { data } = await chatApi.transcribe(message.id);
      setTranscript(data.text);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't transcribe this voice message"));
    } finally {
      setTranscribing(null);
    }
  }, [message.id]);

  const runTranslateTranscript = useCallback(async () => {
    setTranscribing("translate");
    try {
      const { data } = await chatApi.translateTranscript(message.id);
      setTranscriptTranslation(data.text);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Couldn't translate the transcript"));
    } finally {
      setTranscribing(null);
    }
  }, [message.id]);

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
    // LANGUAGE CORRECTION (diff of the original vs corrected text)
    if (message.type === "CORRECTION") {
      return (
        <CorrectionCard
          message={message}
          isOwn={isOwn}
          isRecipient={!isOwn && message.replyTo?.senderId === user?.id}
          onAccept={onAcceptCorrection}
        />
      );
    }

    // VIEW-ONCE PHOTO / VIDEO: the file is fetched only when opened
    if (message.isViewOnce) {
      const label = message.type === "VIDEO" ? "video" : "photo";
      const opened = isOwn ? viewedBy.length > 0 : iOpenedViewOnce;
      return (
        <button
          type="button"
          disabled={isOwn || opened || openingViewOnce}
          onClick={openViewOnce}
          className={`flex min-w-[180px] items-center gap-3 rounded-xl px-3.5 py-3 text-left text-xs font-semibold transition ${
            isOwn
              ? "bg-white/10 text-white"
              : opened
                ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
          }`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-dashed ${
              isOwn ? "border-white/50" : "border-current"
            }`}
          >
            {openingViewOnce ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : opened ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <span className="text-[13px] font-bold">1</span>
            )}
          </span>
          <span>
            {isOwn
              ? `View-once ${label}`
              : opened
                ? "Opened"
                : `Tap to view ${label}`}
            <span className="block text-[10px] font-normal opacity-70">
              {isOwn ? (opened ? "Opened" : "Not opened yet") : opened ? `View-once ${label}` : "You can open it once"}
            </span>
          </span>
        </button>
      );
    }

    // ALBUM: several photos/videos sent together
    if (albumItems.length > 1) {
      const shown = albumItems.slice(0, 4);
      return (
        <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-xl">
          {shown.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.type === "VIDEO") {
                  window.open(item.url, "_blank", "noopener,noreferrer");
                  return;
                }
                setLightboxSrc(item.url);
                setImageZoom(1);
                setImageRotation(0);
                setShowFullImage(true);
              }}
              className={`relative overflow-hidden bg-black/10 ${shown.length === 3 && i === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}
            >
              {item.type === "VIDEO" ? (
                <>
                  <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                  <Play className="absolute inset-0 m-auto h-8 w-8 fill-white text-white drop-shadow-lg" />
                </>
              ) : (
                <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-[1.03]" />
              )}
              {i === 3 && albumItems.length > 4 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-bold text-white">
                  +{albumItems.length - 4}
                </span>
              )}
            </button>
          ))}
        </div>
      );
    }

    // ATTACHMENT THAT WAS NEVER UPLOADED (saved with a local blob: link)
    if (isLostAttachment) {
      return (
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium ${
            isOwn ? "bg-white/10 text-white/80" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          }`}
        >
          <ImageIcon className="w-4 h-4 shrink-0" />
          <span>
            {isVoiceNote || isAudio ? "Voice note" : isFile ? "File" : "Attachment"} unavailable — it didn't finish uploading
          </span>
        </div>
      );
    }

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
    if (isFile && mediaSrc) {
      const fileMeta = (message.metadata ?? {}) as {
        fileName?: string;
        fileSize?: number;
      };
      // Messages sent before the name was stored: take it from the URL ("report_ab12cd.pdf")
      const urlName = decodeURIComponent(mediaSrc.split("?")[0].split("/").pop() || "");
      const fileName = fileMeta.fileName || urlName || "Download attachment";
      const fileSizeLabel = fileMeta.fileSize ? formatBytes(fileMeta.fileSize) : "";

      return (
        <motion.a
          href={mediaSrc}
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
            {fileName}
            {fileSizeLabel && (
              <span className="block text-[10px] font-normal opacity-70">{fileSizeLabel}</span>
            )}
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
              <span>{withMentions(message.content.replace(hasUrl[0], ""), isOwn)}</span>
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
            withMentions(message.content, isOwn)
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
                title="Reply"
                aria-label="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
              {canSpeak() && (message.type === "TEXT" || message.type === "CORRECTION") && message.content?.trim() && (
                <button
                  type="button"
                  onClick={(e) => void toggleListen(e.shiftKey)}
                  className={`p-1.5 rounded-full transition-all ${isSpeaking ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15" : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-500"}`}
                  title={isSpeaking ? "Stop" : "Listen (Shift+click for slow)"}
                  aria-label={isSpeaking ? "Stop reading aloud" : "Read aloud"}
                >
                  {isSpeaking ? <StopIcon className="w-3.5 h-3.5" /> : <ListenIcon className="w-3.5 h-3.5" />}
                </button>
              )}
              {!isOwn && onCorrect && message.type === "TEXT" && message.content?.trim() && (
                <button
                  type="button"
                  onClick={onCorrect}
                  className="p-1.5 hover:bg-violet-50 dark:hover:bg-violet-500/15 rounded-full text-slate-500 dark:text-slate-400 hover:text-violet-600 transition-all"
                  title="Correct their English"
                  aria-label="Correct this message"
                >
                  <SpellCheck2 className="w-3.5 h-3.5" />
                </button>
              )}
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
              {onForward && !message.isViewOnce && (
                <button
                  type="button"
                  onClick={onForward}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
                  title="Forward"
                  aria-label="Forward"
                >
                  <Forward className="w-3.5 h-3.5" />
                </button>
              )}
              {isOwn && onInfo && (
                <button
                  type="button"
                  onClick={onInfo}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
                  title="Message info"
                  aria-label="Message info"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onToggleSave}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all"
                title={message.isSaved ? "Remove from saved" : "Save message"}
                aria-label={message.isSaved ? "Remove from saved" : "Save message"}
              >
                {message.isSaved ? (
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
            } ${isSelected ? "ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900" : mentionsMe ? "ring-2 ring-amber-300/70" : ""}`}
          >
            {(message.metadata?.forwarded || mentionsMe) && (
              <div className={`flex items-center gap-2 text-[10px] font-semibold italic ${isOwn ? "text-indigo-100/80" : "text-slate-400"}`}>
                {message.metadata?.forwarded && (
                  <span className="flex items-center gap-1">
                    <Forward className="w-3 h-3" /> Forwarded
                  </span>
                )}
                {mentionsMe && (
                  <span className="flex items-center gap-1 not-italic text-amber-600 dark:text-amber-400">
                    <AtSign className="w-3 h-3" /> Mentioned you
                  </span>
                )}
              </div>
            )}
            {!isOwn && message.sender?.name && !isPureVoiceMessage && (
              <div className="font-bold text-[11px] text-indigo-600 dark:text-indigo-400 tracking-wide">
                {message.sender.name}
              </div>
            )}

            {/* Corrections show the original inside the card, so skip the reply quote */}
            {message.replyTo && message.type !== "CORRECTION" && (
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

            {/* data-message-text lets the word-lookup popup save the full sentence as context */}
            <div data-message-text={message.content ?? ""}>{renderContent()}</div>

            {/* Caption sent with a photo, video or file */}
            {caption && !message.isViewOnce && (
              <p className="leading-relaxed whitespace-pre-wrap break-words" data-message-text={caption}>
                {withMentions(caption, isOwn)}
              </p>
            )}

            {/* Link preview card */}
            {linkPreview && message.type === "TEXT" && (
              <a
                href={linkPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block overflow-hidden rounded-xl border transition hover:opacity-95 ${
                  isOwn ? "border-white/20 bg-white/10" : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70"
                }`}
              >
                {linkPreview.image && (
                  <img
                    src={linkPreview.image}
                    alt=""
                    loading="lazy"
                    className="max-h-40 w-full object-cover"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                )}
                <div className="space-y-0.5 px-3 py-2">
                  {linkPreview.siteName && (
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${isOwn ? "text-indigo-100/70" : "text-slate-400"}`}>
                      {linkPreview.siteName}
                    </p>
                  )}
                  {linkPreview.title && <p className="line-clamp-2 text-[12px] font-semibold">{linkPreview.title}</p>}
                  {linkPreview.description && (
                    <p className={`line-clamp-2 text-[11px] ${isOwn ? "text-indigo-100/80" : "text-slate-500 dark:text-slate-400"}`}>
                      {linkPreview.description}
                    </p>
                  )}
                </div>
              </a>
            )}

            {/* Voice transcription (and translation of the transcript) */}
            {showVoicePlayer && (
              <div className="space-y-1.5">
                {transcript ? (
                  <div
                    className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
                      isOwn ? "bg-white/10 text-indigo-50" : "bg-slate-100/80 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                    data-message-text={transcript}
                  >
                    {transcript}
                    {transcriptTranslation && (
                      <p className={`mt-1.5 border-t pt-1.5 italic ${isOwn ? "border-white/20 text-indigo-100" : "border-slate-200 text-slate-500 dark:border-slate-700"}`}>
                        {transcriptTranslation}
                      </p>
                    )}
                  </div>
                ) : null}
                <div className={`flex items-center gap-3 text-[10px] font-semibold ${isOwn ? "text-indigo-100" : "text-indigo-600 dark:text-indigo-400"}`}>
                  {!transcript && (
                    <button type="button" onClick={runTranscribe} disabled={!!transcribing} className="flex items-center gap-1 hover:underline disabled:opacity-60">
                      {transcribing === "transcribe" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Captions className="h-3 w-3" />}
                      Transcribe
                    </button>
                  )}
                  {transcript && !transcriptTranslation && (
                    <button type="button" onClick={runTranslateTranscript} disabled={!!transcribing} className="flex items-center gap-1 hover:underline disabled:opacity-60">
                      {transcribing === "translate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                      Translate
                    </button>
                  )}
                </div>
              </div>
            )}

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

            {/* Only state markers live in the bubble; the send time shows on hover beside it */}
            {(isOwn || message.isEdited || message.expiresAt) && (
            <div
              className={`flex items-center justify-end gap-1.5 text-[10px] font-medium -mt-1 select-none ${isOwn ? "text-indigo-100/70" : "text-slate-400 dark:text-slate-500"}`}
            >
              {message.expiresAt && (
                <span
                  className="flex items-center opacity-80"
                  title={`Disappears ${formatDistanceToNow(new Date(message.expiresAt), { addSuffix: true })}`}
                >
                  <Timer className="w-3 h-3" />
                </span>
              )}
              {message.isEdited && (
                <span className="relative">
                  <button
                    type="button"
                    onClick={() => editHistory.length && setShowEditHistory((v) => !v)}
                    className={`flex items-center gap-0.5 opacity-80 italic text-[9px] ${editHistory.length ? "hover:underline cursor-pointer" : "cursor-default"}`}
                    title={editHistory.length ? "See edit history" : undefined}
                  >
                    <Pencil className="w-2.5 h-2.5" /> edited
                  </button>
                  <AnimatePresence>
                    {showEditHistory && editHistory.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className={`absolute bottom-full z-30 mb-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-left text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 ${isOwn ? "right-0" : "left-0"}`}
                      >
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Edit history</p>
                        <ol className="max-h-48 space-y-2 overflow-y-auto">
                          {[...editHistory].reverse().map((v, i) => (
                            <li key={i} className="border-l-2 border-slate-200 pl-2 dark:border-slate-700">
                              <p className="whitespace-pre-wrap break-words text-[12px] not-italic">{v.content || "—"}</p>
                              <p className="text-[9px] text-slate-400">{format(new Date(v.at), "MMM d, HH:mm")}</p>
                            </li>
                          ))}
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </span>
              )}
              {isOwn && <MessageStatus />}
            </div>
            )}
          </motion.div>
        )}

        {/* Send time: appears beside the bubble on hover (full date in the tooltip) */}
        <AnimatePresence>
          {isHovered && !isSelectionMode && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              title={format(messageTime, "PPpp")}
              className={`absolute bottom-2 whitespace-nowrap rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-white shadow-sm dark:bg-slate-700/90 ${
                isOwn ? "right-full mr-2" : "left-full ml-2"
              }`}
            >
              {hoverTimeLabel}
            </motion.span>
          )}
        </AnimatePresence>

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

      {/* View-once viewer: no download; the file is deleted after it's opened */}
      <AnimatePresence>
        {viewOnceMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-black/95 p-4 backdrop-blur-2xl"
            onClick={() => setViewOnceMedia(null)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80">
              <Eye className="h-3.5 w-3.5" /> View once — this closes for good
            </div>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] max-w-4xl select-none">
              {viewOnceMedia.type === "VIDEO" ? (
                <video src={viewOnceMedia.url} autoPlay controls controlsList="nodownload" className="max-h-[80vh] rounded-2xl" />
              ) : (
                <img src={viewOnceMedia.url} alt="" draggable={false} className="max-h-[80vh] rounded-2xl object-contain" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setViewOnceMedia(null)}
              className="rounded-full bg-white/15 px-5 py-2 text-sm font-semibold text-white hover:bg-white/25"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox - Image Viewer with Zoom & Rotation */}
      <AnimatePresence>
        {showFullImage && (lightboxSrc || (mediaSrc && isActuallyImage)) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
            onClick={() => {
              setShowFullImage(false);
              setLightboxSrc(null);
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
                  src={lightboxSrc || mediaSrc}
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
                    href={lightboxSrc || mediaSrc}
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
                      setLightboxSrc(null);
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
