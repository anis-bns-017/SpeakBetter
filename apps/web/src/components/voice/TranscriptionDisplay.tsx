// apps/web/src/components/voice/TranscriptionDisplay.tsx

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  Languages,
  Copy,
  Check,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  X,
  Clock,
  User,
  Volume2,
  VolumeX,
  Settings,
  Sparkles,
  Zap,
  AlertCircle,
  RefreshCw,
  FileText,
  File,
  Share2,
  Link,
  Globe,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume,
  Activity,
  BarChart3,
  PieChart,
  LineChart,
  DownloadCloud,
  UploadCloud,
  Copy as CopyIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";

// ---- Types ----
interface Transcription {
  id: string;
  text: string;
  isFinal: boolean;
  speaker: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  confidence?: number;
  timestamp: Date;
  translated?: {
    text: string;
    language: string;
  };
  language?: string;
  duration?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

interface TranscriptionDisplayProps {
  transcriptions: Transcription[];
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTranslate: (
    transcriptionId: string,
    targetLanguage: string,
  ) => Promise<void>;
  onDelete?: (transcriptionId: string) => void;
  onEdit?: (transcriptionId: string, newText: string) => void;
  onExport?: (format: "txt" | "json" | "srt") => void;
  className?: string;
  maxHeight?: string;
  showControls?: boolean;
  showTimestamps?: boolean;
  showSpeakers?: boolean;
  autoTranslate?: boolean;
  targetLanguage?: string;
  onLanguageChange?: (language: string) => void;
}

interface TranscriptionStats {
  total: number;
  final: number;
  partial: number;
  averageConfidence: number;
  languages: string[];
  speakers: string[];
  duration: number;
}

// ---- SUPPORTED LANGUAGES ----
const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "es", label: "Spanish", flag: "🇪🇸" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "de", label: "German", flag: "🇩🇪" },
  { value: "ja", label: "Japanese", flag: "🇯🇵" },
  { value: "ko", label: "Korean", flag: "🇰🇷" },
  { value: "zh", label: "Chinese", flag: "🇨🇳" },
  { value: "ar", label: "Arabic", flag: "🇸🇦" },
  { value: "hi", label: "Hindi", flag: "🇮🇳" },
  { value: "pt", label: "Portuguese", flag: "🇵🇹" },
  { value: "ru", label: "Russian", flag: "🇷🇺" },
  { value: "it", label: "Italian", flag: "🇮🇹" },
];

// ---- Theme ----
const THEME = {
  void: "#0A0A12",
  surface: "#141425",
  surfaceRaised: "#1E1E38",
  surfaceHover: "#2A2A4A",
  border: "#2A2A4A",
  aurora: {
    primary: "#7C6AFF",
    secondary: "#A78BFA",
    tertiary: "#6EE7B7",
    quaternary: "#FCD34D",
    pink: "#F472B6",
    cyan: "#67E8F9",
    purple: "#8B5CF6",
  },
  text: {
    primary: "#F8F7FF",
    secondary: "#B8B0D8",
    muted: "#7A72A0",
    accent: "#A78BFA",
  },
  status: {
    live: "#6EE7B7",
    liveGlow: "rgba(110, 231, 183, 0.3)",
    waiting: "#FCD34D",
    danger: "#EF4444",
  },
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

// ---- Stats Bar ----
const StatsBar: React.FC<{ stats: TranscriptionStats }> = ({ stats }) => {
  return (
    <div
      className="flex items-center gap-4 px-3 py-1.5 rounded-lg"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <span style={{ color: THEME.text.muted }}>Total:</span>
        <span className="font-medium" style={{ color: THEME.text.primary }}>
          {stats.total}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span style={{ color: THEME.text.muted }}>Final:</span>
        <span className="font-medium" style={{ color: THEME.aurora.tertiary }}>
          {stats.final}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span style={{ color: THEME.text.muted }}>Confidence:</span>
        <span className="font-medium" style={{ color: THEME.aurora.primary }}>
          {(stats.averageConfidence * 100).toFixed(0)}%
        </span>
      </div>
      {stats.speakers.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <span style={{ color: THEME.text.muted }}>Speakers:</span>
          <span className="font-medium" style={{ color: THEME.text.primary }}>
            {stats.speakers.length}
          </span>
        </div>
      )}
      {stats.languages.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          <span style={{ color: THEME.text.muted }}>Languages:</span>
          <span className="font-medium" style={{ color: THEME.text.primary }}>
            {stats.languages.length}
          </span>
        </div>
      )}
    </div>
  );
};

// ---- Transcription Message ----
const TranscriptionMessage: React.FC<{
  transcription: Transcription;
  onCopy: (text: string, id: string) => void;
  onTranslate: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newText: string) => void;
  isTranslating: boolean;
  copiedId: string | null;
  targetLanguage: string;
  isCompact?: boolean;
}> = ({
  transcription,
  onCopy,
  onTranslate,
  onDelete,
  onEdit,
  isTranslating,
  copiedId,
  targetLanguage,
  isCompact = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(transcription.text);
  const [showActions, setShowActions] = useState(false);

  const handleEdit = () => {
    if (isEditing) {
      onEdit?.(transcription.id, editText);
      setIsEditing(false);
    } else {
      setEditText(transcription.text);
      setIsEditing(true);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return THEME.aurora.tertiary;
    if (confidence >= 0.7) return THEME.aurora.quaternary;
    return THEME.aurora.pink;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative p-3 rounded-lg transition-all",
        transcription.isFinal
          ? "border border-white/5 hover:border-white/10"
          : "border border-amber-500/20 bg-amber-500/5",
        isCompact ? "py-2" : "py-3",
      )}
      style={{
        background: transcription.isFinal
          ? "rgba(255,255,255,0.02)"
          : "rgba(252, 211, 77, 0.05)",
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-3">
        {/* Speaker Avatar */}
        {!isCompact && (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{
              background: transcription.user?.avatarUrl
                ? `url(${transcription.user.avatarUrl}) center/cover`
                : `hsl(${hashCode(transcription.speaker) % 360}, 50%, 25%)`,
              color: transcription.user?.avatarUrl
                ? "transparent"
                : THEME.text.primary,
            }}
          >
            {!transcription.user?.avatarUrl && initials(transcription.speaker)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className="text-sm font-medium"
              style={{ color: THEME.text.primary }}
            >
              {transcription.user?.name || `Speaker ${transcription.speaker}`}
            </span>
            <span className="text-[10px]" style={{ color: THEME.text.muted }}>
              {format(new Date(transcription.timestamp), "h:mm:ss a")}
            </span>
            {!transcription.isFinal && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                style={{
                  background: "rgba(252, 211, 77, 0.15)",
                  color: THEME.aurora.quaternary,
                }}
              >
                <span
                  className="w-1 h-1 rounded-full animate-pulse"
                  style={{ background: THEME.aurora.quaternary }}
                />
                partial
              </span>
            )}
            {transcription.confidence !== undefined && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: `rgba(107, 114, 128, 0.2)`,
                  color: getConfidenceColor(transcription.confidence),
                }}
              >
                {(transcription.confidence * 100).toFixed(0)}%
              </span>
            )}
            {transcription.language && (
              <span
                className="text-[8px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "rgba(167, 139, 250, 0.1)",
                  color: THEME.aurora.secondary,
                }}
              >
                {transcription.language.toUpperCase()}
              </span>
            )}
          </div>

          {/* Text */}
          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="flex-1 px-2 py-1 rounded text-sm outline-none border"
                style={{
                  background: THEME.surface,
                  color: THEME.text.primary,
                  borderColor: THEME.border,
                }}
                autoFocus
              />
              <button
                onClick={handleEdit}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ background: THEME.aurora.primary, color: "#fff" }}
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-2 py-1 rounded text-xs"
                style={{ color: THEME.text.muted }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <p
              className={cn(
                "text-sm leading-relaxed break-words",
                !transcription.isFinal ? "opacity-70" : "",
                isCompact ? "text-xs" : "text-sm",
              )}
              style={{ color: THEME.text.primary }}
            >
              {transcription.text}
            </p>
          )}

          {/* Translation */}
          {transcription.translated && (
            <div
              className="mt-1.5 p-2 rounded-lg text-xs"
              style={{
                background: "rgba(167, 139, 250, 0.05)",
                border: `1px solid ${THEME.aurora.primary}20`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Globe
                  className="w-3 h-3"
                  style={{ color: THEME.aurora.secondary }}
                />
                <span
                  className="text-[9px] font-medium"
                  style={{ color: THEME.aurora.secondary }}
                >
                  {SUPPORTED_LANGUAGES.find((l) => l.value === targetLanguage)
                    ?.label || targetLanguage.toUpperCase()}
                </span>
              </div>
              <p style={{ color: THEME.text.secondary }}>
                {transcription.translated.text}
              </p>
            </div>
          )}

          {/* Word-level timestamps */}
          {transcription.words && transcription.words.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {transcription.words.map((word, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1 py-0.5 rounded"
                  style={{
                    background: `rgba(167, 139, 250, ${word.confidence * 0.15})`,
                    color:
                      word.confidence > 0.8
                        ? THEME.text.primary
                        : THEME.text.muted,
                  }}
                >
                  {word.word}
                  <span
                    className="text-[7px] ml-0.5"
                    style={{ color: THEME.text.muted }}
                  >
                    {word.start.toFixed(1)}s
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <AnimatePresence>
          {(showActions || isCompact) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-0.5 shrink-0"
            >
              <button
                onClick={() => onCopy(transcription.text, transcription.id)}
                className="p-1.5 rounded hover:bg-white/5 transition-colors"
                style={{
                  color:
                    copiedId === transcription.id
                      ? THEME.aurora.tertiary
                      : THEME.text.muted,
                }}
                title="Copy text"
              >
                {copiedId === transcription.id ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                onClick={() => onTranslate(transcription.id)}
                disabled={isTranslating}
                className="p-1.5 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
                style={{ color: THEME.text.muted }}
                title="Translate"
              >
                {isTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
              </button>

              {onEdit && (
                <button
                  onClick={handleEdit}
                  className="p-1.5 rounded hover:bg-white/5 transition-colors"
                  style={{ color: THEME.text.muted }}
                  title="Edit"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={() => onDelete(transcription.id)}
                  className="p-1.5 rounded hover:bg-red-500/20 transition-colors"
                  style={{ color: THEME.text.muted }}
                  title="Delete"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ---- Recording Indicator ----
const RecordingIndicator: React.FC<{ isRecording: boolean }> = ({
  isRecording,
}) => {
  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: THEME.status.danger }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span
            className="text-xs font-medium"
            style={{ color: THEME.status.danger }}
          >
            ● Recording
          </span>
        </>
      ) : (
        <>
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: THEME.text.muted }}
          />
          <span className="text-xs" style={{ color: THEME.text.muted }}>
            Paused
          </span>
        </>
      )}
    </div>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({
  transcriptions,
  isRecording,
  onStartRecording,
  onStopRecording,
  onTranslate,
  onDelete,
  onEdit,
  onExport,
  className = "",
  maxHeight = "h-80",
  showControls = true,
  showTimestamps = true,
  showSpeakers = true,
  autoTranslate = false,
  targetLanguage = "en",
  onLanguageChange,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(
    targetLanguage || "en",
  );
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpeaker, setFilterSpeaker] = useState<string>("all");
  const [filterFinal, setFilterFinal] = useState<"all" | "final" | "partial">(
    "all",
  );
  const [isExpanded, setIsExpanded] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    onLanguageChange?.(lang);
  };

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions, autoScroll]);

  const handleTranslate = async (transcriptionId: string) => {
    setTranslatingId(transcriptionId);
    try {
      await onTranslate(transcriptionId, selectedLanguage);
    } catch (error) {
      console.error("Translation failed:", error);
      toast.error("Translation failed");
    } finally {
      setTranslatingId(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = (format: "txt" | "json" | "srt") => {
    if (onExport) {
      onExport(format);
      return;
    }

    let content = "";
    let filename = `transcription-${new Date().toISOString()}`;

    if (format === "txt") {
      content = transcriptions
        .filter((t) => t.isFinal)
        .map(
          (t) =>
            `[${format(new Date(t.timestamp), "h:mm:ss a")}] ${t.speaker}: ${t.text}`,
        )
        .join("\n");
      filename += ".txt";
    } else if (format === "json") {
      content = JSON.stringify(transcriptions, null, 2);
      filename += ".json";
    } else if (format === "srt") {
      content = transcriptions
        .filter((t) => t.isFinal)
        .map((t, i) => {
          const start = new Date(t.timestamp);
          const end = new Date(start.getTime() + 5000);
          return `${i + 1}\n${format(start, "HH:mm:ss,SSS")} --> ${format(end, "HH:mm:ss,SSS")}\n${t.text}\n`;
        })
        .join("\n");
      filename += ".srt";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const filteredTranscriptions = useMemo(() => {
    let filtered = transcriptions;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.text.toLowerCase().includes(q) ||
          t.speaker.toLowerCase().includes(q),
      );
    }

    if (filterSpeaker !== "all") {
      filtered = filtered.filter((t) => t.speaker === filterSpeaker);
    }

    if (filterFinal === "final") {
      filtered = filtered.filter((t) => t.isFinal);
    } else if (filterFinal === "partial") {
      filtered = filtered.filter((t) => !t.isFinal);
    }

    return filtered;
  }, [transcriptions, searchQuery, filterSpeaker, filterFinal]);

  const stats = useMemo<TranscriptionStats>(() => {
    const speakers = new Set<string>();
    const languages = new Set<string>();
    let totalConfidence = 0;
    let confidenceCount = 0;

    transcriptions.forEach((t) => {
      if (t.speaker) speakers.add(t.speaker);
      if (t.language) languages.add(t.language);
      if (t.confidence !== undefined) {
        totalConfidence += t.confidence;
        confidenceCount++;
      }
    });

    return {
      total: transcriptions.length,
      final: transcriptions.filter((t) => t.isFinal).length,
      partial: transcriptions.filter((t) => !t.isFinal).length,
      averageConfidence:
        confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      languages: Array.from(languages),
      speakers: Array.from(speakers),
      duration: 0,
    };
  }, [transcriptions]);

  const uniqueSpeakers = useMemo(() => {
    const speakers = new Set<string>();
    transcriptions.forEach((t) => speakers.add(t.speaker));
    return Array.from(speakers);
  }, [transcriptions]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden",
        "bg-gray-900/50 backdrop-blur-sm",
        "border-gray-700/50",
        className,
      )}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2"
        style={{ borderColor: THEME.border }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText
              className="w-4 h-4"
              style={{ color: THEME.aurora.primary }}
            />
            <h3
              className="text-sm font-semibold"
              style={{ color: THEME.text.primary }}
            >
              Live Transcription
            </h3>
          </div>
          <RecordingIndicator isRecording={isRecording} />
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              background: "rgba(167, 139, 250, 0.1)",
              color: THEME.aurora.secondary,
            }}
          >
            {stats.total}
          </span>
        </div>

        {showControls && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Language Select */}
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-2 py-1 rounded-lg text-xs outline-none border"
              style={{
                background: THEME.surface,
                color: THEME.text.primary,
                borderColor: THEME.border,
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>

            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors hover:bg-white/5"
                style={{
                  color: THEME.text.muted,
                  border: `1px solid ${THEME.border}`,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
              <div
                className="absolute right-0 top-full mt-1 w-32 rounded-lg border shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10"
                style={{
                  background: THEME.surfaceRaised,
                  borderColor: THEME.border,
                }}
              >
                {["txt", "json", "srt"].map((format) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format as any)}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    style={{ color: THEME.text.secondary }}
                  >
                    .{format}
                  </button>
                ))}
              </div>
            </div>

            {/* Record Button */}
            <button
              onClick={isRecording ? onStopRecording : onStartRecording}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                isRecording
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30",
              )}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  Record
                </>
              )}
            </button>

            {/* Toggle Stats */}
            <button
              onClick={() => setShowStats(!showStats)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{
                color: showStats ? THEME.aurora.primary : THEME.text.muted,
              }}
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            {/* Toggle Expand */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: THEME.text.muted }}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 py-2 border-b"
              style={{ borderColor: THEME.border }}
            >
              <StatsBar stats={stats} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div
        className="px-4 py-2 border-b flex items-center gap-2 flex-wrap"
        style={{ borderColor: THEME.border }}
      >
        <div className="relative flex-1 min-w-[120px]">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
            style={{ color: THEME.text.muted }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcriptions..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border"
            style={{
              background: THEME.surface,
              color: THEME.text.primary,
              borderColor: THEME.border,
            }}
          />
        </div>

        <select
          value={filterSpeaker}
          onChange={(e) => setFilterSpeaker(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs outline-none border"
          style={{
            background: THEME.surface,
            color: THEME.text.primary,
            borderColor: THEME.border,
          }}
        >
          <option value="all">All Speakers</option>
          {uniqueSpeakers.map((speaker) => (
            <option key={speaker} value={speaker}>
              {speaker}
            </option>
          ))}
        </select>

        <select
          value={filterFinal}
          onChange={(e) => setFilterFinal(e.target.value as any)}
          className="px-2 py-1.5 rounded-lg text-xs outline-none border"
          style={{
            background: THEME.surface,
            color: THEME.text.primary,
            borderColor: THEME.border,
          }}
        >
          <option value="all">All</option>
          <option value="final">Final</option>
          <option value="partial">Partial</option>
        </select>

        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            autoScroll ? "bg-purple-500/20" : "hover:bg-white/5",
          )}
          style={{
            color: autoScroll ? THEME.aurora.primary : THEME.text.muted,
          }}
          title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className={`${maxHeight} overflow-y-auto px-4 py-3 space-y-2`}
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: `${THEME.border} transparent`,
              }}
            >
              {filteredTranscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                    style={{ background: "rgba(167, 139, 250, 0.1)" }}
                  >
                    {isRecording ? (
                      <Mic
                        className="w-8 h-8"
                        style={{ color: THEME.aurora.primary }}
                      />
                    ) : (
                      <MicOff
                        className="w-8 h-8"
                        style={{ color: THEME.text.muted }}
                      />
                    )}
                  </div>
                  <p
                    className="text-sm"
                    style={{ color: THEME.text.secondary }}
                  >
                    {isRecording
                      ? "Listening for speech..."
                      : "No transcriptions yet"}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: THEME.text.muted }}
                  >
                    {isRecording
                      ? "Transcriptions will appear here as people speak"
                      : "Start recording to see live transcriptions"}
                  </p>
                </div>
              ) : (
                filteredTranscriptions.map((transcription) => (
                  <TranscriptionMessage
                    key={transcription.id}
                    transcription={transcription}
                    onCopy={handleCopy}
                    onTranslate={handleTranslate}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    isTranslating={translatingId === transcription.id}
                    copiedId={copiedId}
                    targetLanguage={selectedLanguage}
                    isCompact={false}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ---- Helper Functions ----
function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "?"
  );
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export default TranscriptionDisplay;
