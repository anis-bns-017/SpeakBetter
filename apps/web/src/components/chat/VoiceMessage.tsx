import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Play,
  Pause,
  Mic,
  Volume2,
  VolumeX,
  Download,
  Trash2,
  Share2,
  Clock,
  Loader2,
  SkipForward,
  SkipBack,
  Repeat,
  Repeat1 as RepeatOnce,
  Maximize2,
  Minimize2,
  Info,
  MoreVertical,
  Heart,
  HeartOff,
  Bookmark,
  BookmarkCheck,
  Link2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Music,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";

interface VoiceMessageProps {
  audioUrl: string;
  duration?: number;
  isOwn?: boolean;
  timestamp?: string | Date;
  senderName?: string;
  senderAvatar?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  isDownloading?: boolean;
  isPlaying?: boolean;
  isPinned?: boolean;
  showWaveform?: boolean;
  waveformData?: number[];
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "minimal" | "expanded" | "elegant";
  isLiked?: boolean;
  isSaved?: boolean;
  replyCount?: number;
  onLike?: () => void;
  onSave?: () => void;
  onReply?: () => void;
  isTranscribing?: boolean;
  transcript?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Generate beautiful waveform data
const generateWaveform = (bars: number = 60) => {
  return Array.from({ length: bars }, () => {
    // Create varied heights for more natural look
    const base = Math.random() * 60 + 20;
    const variation = Math.sin(Math.random() * Math.PI * 2) * 15;
    return Math.min(95, Math.max(15, base + variation));
  });
};

const DEFAULT_WAVEFORM = generateWaveform(60);

export const VoiceMessage: React.FC<VoiceMessageProps> = ({
  audioUrl,
  duration = 0,
  isOwn = false,
  timestamp,
  senderName,
  senderAvatar,
  onPlay,
  onPause,
  onComplete,
  onDelete,
  onShare,
  onDownload,
  isDownloading = false,
  isPlaying: externalIsPlaying,
  isPinned = false,
  showWaveform = true,
  waveformData = DEFAULT_WAVEFORM,
  className = "",
  size = "md",
  variant = "default",
  isLiked = false,
  isSaved = false,
  replyCount = 0,
  onLike,
  onSave,
  onReply,
  isTranscribing = false,
  transcript,
}) => {
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(duration);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentWaveformIndex, setCurrentWaveformIndex] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();

  const isPlaying =
    externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;

  // Size configurations
  const sizeConfig = {
    sm: {
      button: "w-8 h-8",
      icon: "w-3.5 h-3.5",
      padding: "p-2.5",
      text: "text-xs",
      gap: "gap-1.5",
      avatar: "w-6 h-6",
      waveformHeight: 24,
    },
    md: {
      button: "w-10 h-10",
      icon: "w-4 h-4",
      padding: "p-3.5",
      text: "text-sm",
      gap: "gap-2.5",
      avatar: "w-8 h-8",
      waveformHeight: 32,
    },
    lg: {
      button: "w-12 h-12",
      icon: "w-5 h-5",
      padding: "p-4.5",
      text: "text-base",
      gap: "gap-3",
      avatar: "w-10 h-10",
      waveformHeight: 40,
    },
  };

  const config = sizeConfig[size];

  // Variant styles with gradient themes
  const variantStyles = {
    default: {
      container: `${
        isOwn
          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/20"
          : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-800 shadow-sm"
      }`,
      button: isOwn
        ? "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30"
        : "bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30",
      played: isOwn ? "bg-white" : "bg-blue-600",
      unplayed: isOwn ? "bg-blue-400/40" : "bg-gray-300",
      text: isOwn ? "text-blue-100" : "text-gray-500",
      accent: isOwn ? "text-white" : "text-blue-600",
    },
    minimal: {
      container:
        "bg-transparent border-2 border-gray-200 text-gray-800 hover:border-gray-300 transition-colors",
      button:
        "bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30",
      played: "bg-blue-600",
      unplayed: "bg-gray-300",
      text: "text-gray-500",
      accent: "text-blue-600",
    },
    expanded: {
      container: `${
        isOwn
          ? "bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-2xl shadow-blue-500/30"
          : "bg-gradient-to-br from-gray-100 to-gray-300 text-gray-800 shadow-lg"
      }`,
      button: isOwn
        ? "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30"
        : "bg-gradient-to-br from-blue-600 to-blue-700 text-white hover:shadow-lg hover:shadow-blue-500/30",
      played: isOwn ? "bg-white" : "bg-blue-600",
      unplayed: isOwn ? "bg-blue-400/40" : "bg-gray-400",
      text: isOwn ? "text-blue-200" : "text-gray-500",
      accent: isOwn ? "text-white" : "text-blue-600",
    },
    elegant: {
      container: `${
        isOwn
          ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/20"
          : "bg-white/80 backdrop-blur-sm text-gray-800 border border-gray-200/50 shadow-xl"
      }`,
      button: isOwn
        ? "bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 border border-white/30"
        : "bg-gradient-to-br from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-purple-500/30",
      played: isOwn
        ? "bg-white"
        : "bg-gradient-to-r from-indigo-600 to-purple-600",
      unplayed: isOwn ? "bg-white/30" : "bg-gray-300",
      text: isOwn ? "text-indigo-100" : "text-gray-500",
      accent: isOwn ? "text-white" : "text-indigo-600",
    },
  };

  const styles = variantStyles[variant];

  // Sync state with audio element events
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && !isSeeking) {
      setCurrentTime(audioRef.current.currentTime);

      const progress =
        (audioRef.current.currentTime / (audioRef.current.duration || 1)) *
        waveformData.length;
      setCurrentWaveformIndex(Math.floor(progress));
    }
  }, [isSeeking, waveformData.length]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const duration = audioRef.current.duration;
      if (!isNaN(duration) && duration > 0) {
        setMediaDuration(duration);
        setIsLoading(false);
        setError(null);
      }
    }
  }, []);

  const handleEnded = useCallback(() => {
    if (isLooping) {
      audioRef.current?.play();
      return;
    }
    setInternalIsPlaying(false);
    setCurrentTime(0);
    setCurrentWaveformIndex(0);
    onPause?.();
    onComplete?.();
  }, [isLooping, onPause, onComplete]);

  const handleError = useCallback(() => {
    setError("Failed to load audio");
    setIsLoading(false);
    setInternalIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    if (error) {
      setError(null);
      audioRef.current.load();
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setInternalIsPlaying(false);
      onPause?.();
    } else {
      try {
        await audioRef.current.play();
        setInternalIsPlaying(true);
        onPlay?.();
        setError(null);
      } catch (err) {
        setError("Unable to play audio");
        setInternalIsPlaying(false);
      }
    }
  }, [isPlaying, onPlay, onPause, error]);

  const cyclePlaybackSpeed = useCallback(() => {
    const nextIndex = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = PLAYBACK_SPEEDS[nextIndex];
    }
  }, [speedIndex]);

  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value);
      setVolume(newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume;
        if (newVolume === 0) {
          audioRef.current.muted = true;
          setIsMuted(true);
        } else if (isMuted) {
          audioRef.current.muted = false;
          setIsMuted(false);
        }
      }
    },
    [isMuted],
  );

  const toggleLoop = useCallback(() => {
    setIsLooping(!isLooping);
    if (audioRef.current) {
      audioRef.current.loop = !isLooping;
    }
  }, [isLooping]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!trackRef.current || !audioRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const effectiveDuration =
        mediaDuration || duration || audioRef.current.duration || 0;

      if (effectiveDuration > 0) {
        const newTime = Math.min(
          Math.max((clickX / width) * effectiveDuration, 0),
          effectiveDuration,
        );
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);

        const progress = (newTime / effectiveDuration) * waveformData.length;
        setCurrentWaveformIndex(Math.floor(progress));
      }
    },
    [mediaDuration, duration, waveformData.length],
  );

  const handleKeySeek = useCallback((direction: "forward" | "backward") => {
    if (!audioRef.current) return;
    const skipTime = 5;
    const newTime =
      direction === "forward"
        ? Math.min(
            audioRef.current.currentTime + skipTime,
            audioRef.current.duration || 0,
          )
        : Math.max(audioRef.current.currentTime - skipTime, 0);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  const remainingTime = useMemo(() => {
    const total = mediaDuration || duration || 0;
    return Math.max(total - currentTime, 0);
  }, [mediaDuration, duration, currentTime]);

  // Draw waveform on canvas with glow effects
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !showWaveform) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / waveformData.length;
    const progress = currentWaveformIndex / waveformData.length;

    ctx.clearRect(0, 0, width, height);

    waveformData.forEach((heightPercent, index) => {
      const x = index * barWidth;
      const barHeight = (heightPercent / 100) * height;
      const y = (height - barHeight) / 2;
      const isPlayed = index <= currentWaveformIndex;

      // Gradient for played portion
      if (isPlayed) {
        const gradient = ctx.createLinearGradient(0, y, 0, height);
        if (isOwn) {
          gradient.addColorStop(0, "#93C5FD");
          gradient.addColorStop(1, "#60A5FA");
        } else if (variant === "elegant") {
          gradient.addColorStop(0, "#8B5CF6");
          gradient.addColorStop(1, "#6366F1");
        } else {
          gradient.addColorStop(0, "#818CF8");
          gradient.addColorStop(1, "#6366F1");
        }
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = isOwn
          ? "rgba(255,255,255,0.25)"
          : "rgba(156,163,175,0.25)";
      }

      // Rounded bars with shadow
      ctx.shadowColor =
        isPlayed && isOwn ? "rgba(255,255,255,0.1)" : "rgba(99,102,241,0.1)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth - 1, barHeight, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Glow on current position
      if (index === currentWaveformIndex && isPlaying) {
        ctx.shadowColor = isOwn
          ? "rgba(255,255,255,0.6)"
          : "rgba(99,102,241,0.6)";
        ctx.shadowBlur = 15;
        ctx.fillStyle = isOwn
          ? "rgba(255,255,255,0.9)"
          : "rgba(99,102,241,0.9)";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth - 1, barHeight, 3);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });
  }, [
    waveformData,
    currentWaveformIndex,
    isOwn,
    showWaveform,
    variant,
    isPlaying,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Load audio on URL change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
      setIsLoading(true);
      setCurrentTime(0);
      setCurrentWaveformIndex(0);
    }
  }, [audioUrl]);

  const effectiveDuration = mediaDuration || duration || 0;
  const progressPercent =
    effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <LayoutGroup>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={`relative rounded-2xl ${config.padding} ${styles.container} w-full max-w-[420px] ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Pinned Badge */}
        {isPinned && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] px-2 py-0.5 rounded-full shadow-lg shadow-amber-500/30 flex items-center gap-1"
          >
            📌 Pinned
          </motion.div>
        )}

        {/* Background Decoration */}
        {variant === "elegant" && !isOwn && (
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-indigo-400/10 to-purple-400/10 rounded-full blur-2xl pointer-events-none" />
        )}

        <div className="flex items-start gap-3 relative z-10">
          {/* Avatar & Sender Info */}
          {senderName && !isOwn && variant !== "minimal" && (
            <div className="flex-shrink-0">
              <motion.div whileHover={{ scale: 1.05 }} className="relative">
                {senderAvatar ? (
                  <img
                    src={senderAvatar}
                    alt={senderName}
                    className={`${config.avatar} rounded-full object-cover border-2 border-white/20 shadow-lg`}
                  />
                ) : (
                  <div
                    className={`${config.avatar} rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-indigo-500/20`}
                  >
                    {senderName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
              </motion.div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Sender Name & Time */}
            {senderName && !isOwn && variant !== "minimal" && (
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold truncate flex items-center gap-1.5">
                  {senderName}
                  {isOwn && (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/80 font-normal">
                      You
                    </span>
                  )}
                </span>
                {timestamp && (
                  <span
                    className={`text-[9px] ${styles.text} opacity-60 flex items-center gap-1`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {formatDistanceToNow(new Date(timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            )}

            {/* Audio Player */}
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onError={handleError}
              preload="metadata"
              className="hidden"
            />

            {/* Waveform Track */}
            <div className="flex items-center gap-2.5">
              {/* Play Button */}
              <motion.button
                type="button"
                onClick={togglePlay}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                disabled={isLoading}
                className={`${config.button} rounded-full flex items-center justify-center flex-shrink-0 transition-all ${styles.button} ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                } shadow-lg`}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <Loader2 className={`${config.icon} animate-spin`} />
                ) : isPlaying ? (
                  <Pause className={`${config.icon} fill-current`} />
                ) : (
                  <Play className={`${config.icon} fill-current ml-0.5`} />
                )}
              </motion.button>

              {/* Waveform */}
              {showWaveform ? (
                <div
                  ref={trackRef}
                  onClick={handleSeek}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="relative flex-1 cursor-pointer group py-1"
                >
                  <canvas
                    ref={waveformCanvasRef}
                    className="w-full rounded-lg"
                    style={{ height: config.waveformHeight }}
                  />

                  {/* Progress Tooltip */}
                  <AnimatePresence>
                    {showTooltip && isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.9 }}
                        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-[10px] px-2.5 py-1 rounded-lg shadow-xl"
                      >
                        {formatTime(currentTime)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Simple Progress Bar */
                <div
                  ref={trackRef}
                  onClick={handleSeek}
                  className="relative flex-1 h-2 bg-gray-300/50 rounded-full cursor-pointer group"
                >
                  <div
                    ref={progressRef}
                    className={`h-full rounded-full transition-all duration-75 ${
                      isOwn
                        ? "bg-white"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg ${
                      isOwn
                        ? "bg-white"
                        : "bg-gradient-to-r from-indigo-600 to-purple-600"
                    }`}
                    style={{ left: `calc(${progressPercent}% - 8px)` }}
                  />
                </div>
              )}
            </div>

            {/* Controls Bar */}
            <div
              className={`flex items-center justify-between mt-2 ${config.text} font-mono leading-none`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`font-medium ${styles.text}`}>
                  {isPlaying
                    ? formatTime(currentTime)
                    : formatTime(effectiveDuration)}
                </span>
                {isPlaying && (
                  <span className={`text-[10px] ${styles.text} opacity-60`}>
                    -{formatTime(remainingTime)}
                  </span>
                )}
                {timestamp && variant === "minimal" && (
                  <span
                    className={`text-[9px] ${styles.text} opacity-50 hidden sm:inline`}
                  >
                    ·{" "}
                    {formatDistanceToNow(new Date(timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Speed Control */}
                <div className="relative">
                  <motion.button
                    type="button"
                    onClick={cyclePlaybackSpeed}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`px-1.5 py-0.5 rounded-lg text-[9px] font-bold transition-all ${
                      isOwn
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-gray-200/70 text-gray-700 hover:bg-gray-300/70"
                    }`}
                    title="Playback speed"
                  >
                    {PLAYBACK_SPEEDS[speedIndex]}×
                  </motion.button>
                </div>

                {/* Loop */}
                <motion.button
                  type="button"
                  onClick={toggleLoop}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className={`p-0.5 rounded transition-all ${isLooping ? "text-indigo-400" : styles.text} opacity-60 hover:opacity-100`}
                  title={isLooping ? "Loop off" : "Loop on"}
                >
                  {isLooping ? (
                    <RepeatOnce className="w-3 h-3" />
                  ) : (
                    <Repeat className="w-3 h-3" />
                  )}
                </motion.button>

                {/* Skip Buttons */}
                {(variant === "expanded" || isPlaying) && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => handleKeySeek("backward")}
                      className={`p-0.5 rounded transition-all ${styles.text} opacity-60 hover:opacity-100`}
                      title="Skip backward 5s"
                    >
                      <SkipBack className="w-3 h-3" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => handleKeySeek("forward")}
                      className={`p-0.5 rounded transition-all ${styles.text} opacity-60 hover:opacity-100`}
                      title="Skip forward 5s"
                    >
                      <SkipForward className="w-3 h-3" />
                    </motion.button>
                  </>
                )}

                {/* Volume (expanded only) */}
                {variant === "expanded" && (
                  <div className="flex items-center gap-1 ml-1">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={toggleMute}
                      className={`p-0.5 rounded transition-all ${styles.text} opacity-60 hover:opacity-100`}
                    >
                      {isMuted ? (
                        <VolumeX className="w-3 h-3" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                    </motion.button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-10 h-1 bg-gray-300/50 rounded-full appearance-none cursor-pointer accent-current"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Transcript (elegant variant) */}
            {transcript && variant === "elegant" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-2 pt-2 border-t border-white/10"
              >
                <p
                  className={`text-[11px] ${styles.text} opacity-80 line-clamp-2 flex items-start gap-1.5`}
                >
                  <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {transcript}
                </p>
              </motion.div>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-1.5 flex items-center gap-1.5"
              >
                <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                <span className={`text-[9px] ${styles.text} opacity-60`}>
                  Transcribing...
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        {(variant === "expanded" || variant === "elegant") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/10"
          >
            <div className="flex items-center gap-1">
              {/* Like */}
              {onLike && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onLike}
                  className={`p-1.5 rounded-lg transition-all ${
                    isLiked ? "text-red-500 bg-red-500/10" : styles.text
                  } opacity-70 hover:opacity-100`}
                >
                  {isLiked ? (
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <HeartOff className="w-3.5 h-3.5" />
                  )}
                </motion.button>
              )}

              {/* Save */}
              {onSave && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onSave}
                  className={`p-1.5 rounded-lg transition-all ${
                    isSaved ? "text-indigo-400 bg-indigo-500/10" : styles.text
                  } opacity-70 hover:opacity-100`}
                >
                  {isSaved ? (
                    <BookmarkCheck className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Bookmark className="w-3.5 h-3.5" />
                  )}
                </motion.button>
              )}

              {/* Reply */}
              {onReply && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onReply}
                  className={`p-1.5 rounded-lg transition-all ${styles.text} opacity-70 hover:opacity-100`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {replyCount > 0 && (
                    <span className="ml-0.5 text-[9px] font-medium">
                      {replyCount}
                    </span>
                  )}
                </motion.button>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              {onDownload && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onDownload}
                  disabled={isDownloading}
                  className={`p-1.5 rounded-lg transition-all ${styles.text} opacity-60 hover:opacity-100 disabled:opacity-30`}
                  title="Download"
                >
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                </motion.button>
              )}
              {onShare && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onShare}
                  className={`p-1.5 rounded-lg transition-all ${styles.text} opacity-60 hover:opacity-100`}
                  title="Share"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </motion.button>
              )}
              {onDelete && isOwn && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onDelete}
                  className="p-1.5 rounded-lg transition-all text-red-400 hover:bg-red-500/10 opacity-60 hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              )}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-1.5 rounded-lg transition-all ${styles.text} opacity-50 hover:opacity-100`}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? (
                  <Minimize2 className="w-3 h-3" />
                ) : (
                  <Maximize2 className="w-3 h-3" />
                )}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5"
          >
            <Info className="w-3 h-3" />
            {error}
            <button
              onClick={() => {
                setError(null);
                audioRef.current?.load();
              }}
              className="text-indigo-400 hover:underline font-medium"
            >
              Retry
            </button>
          </motion.div>
        )}
      </motion.div>
    </LayoutGroup>
  );
};

// Canvas roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    return this;
  };
}
