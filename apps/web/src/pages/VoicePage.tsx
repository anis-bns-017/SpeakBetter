import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  useVoiceRooms,
  useCreateVoiceRoom,
  useEndVoiceRoom,
  useJoinVoiceRoom,
  useLeaveVoiceRoom,
  type VoiceRoom,
} from "../hooks/useVoice";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  Mic,
  Users,
  Lock,
  Radio,
  Calendar,
  X,
  LogIn,
  Square,
  Loader2,
  AudioLines,
  KeyRound,
  EyeOff,
  MessageCircle,
  Clock,
  Crown,
  Volume2,
  VolumeX,
  Headphones,
  Sparkles,
  Zap,
  Flame,
  Star,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Shield,
  UserPlus,
  UserMinus,
  MoreVertical,
  Share2,
  Copy,
  Link2,
  Phone,
  PhoneOff,
  MessageSquare,
  Gift,
  Heart,
  ThumbsUp,
  Send,
  Hash,
  Search,
  Filter,
  LayoutGrid,
  List,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  Coffee,
  Music,
  BookOpen,
  Gamepad2,
  Smile,
  Tag,
  Sparkle,
  Compass,
  Wand2,
  Stars,
  Rocket,
  PartyPopper,
  ArrowRight,
  Check,
  ChevronRight,
  Sun,
  Moon,
  Palette,
  Brush,
  Minimize2,
  Maximize2,
  Bell,
  BellOff,
  Pin as PinIcon,
  PinOff,
  Volume,
  VolumeOff as VolumeOffIcon,
  UserCheck,
  UserX as UserXIcon,
  Crown as CrownIcon,
  ShieldCheck,
  BadgeCheck,
  Verified,
  Award as AwardIcon,
  Trophy,
  Medal,
  Star as StarIcon,
  Sparkle as SparkleIcon,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { VoiceRoomView } from "../components/voice/VoiceRoomView";
import { useChatSocket } from "../hooks/useChat";
import { useQueryClient } from "@tanstack/react-query";

// ---- Theme Colors ----
const COLORS = {
  void: "#0B0714",
  surface: "#1C1430",
  surfaceRaised: "#251C3E",
  surfaceHover: "#2D1F4A",
  border: "#322754",
  borderLight: "#4A3A6E",
  spotlight: "#F5A623",
  spotlightDim: "rgba(245, 166, 35, 0.16)",
  live: "#2DD4BF",
  liveDim: "rgba(45, 212, 191, 0.14)",
  textPrimary: "#F4EFFF",
  textMuted: "#9C90B8",
  textSecondary: "#6B5F8A",
  danger: "#EF4444",
  success: "#34D399",
  info: "#60A5FA",
  purple: "#A78BFA",
  pink: "#F472B6",
  cyan: "#67E8F9",
};

const TYPE_ACCENTS: Record<string, string> = {
  OPEN: "#2DD4BF",
  PRIVATE: "#F5A623",
  STAGE: "#A78BFA",
  SCHEDULED: "#38BDF8",
};

const TYPE_LABELS: Record<string, string> = {
  OPEN: "Open",
  PRIVATE: "Private",
  STAGE: "Stage",
  SCHEDULED: "Scheduled",
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

function hueFromString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function timeSince(date: string | Date) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

// ---- Custom Confirmation Modal ----
const ConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "#EF4444",
}) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[60] px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="rounded-3xl w-full max-w-md p-6 border"
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${confirmColor}22` }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: confirmColor }} />
          </div>
          <h3
            className="font-serif text-xl mb-2"
            style={{ color: COLORS.textPrimary }}
          >
            {title}
          </h3>
          <p className="text-sm mb-6" style={{ color: COLORS.textMuted }}>
            {message}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: COLORS.textMuted }}
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
              style={{ background: confirmColor, color: "#fff" }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---- Floating Mini Room ----
const FloatingMiniRoom: React.FC<{
  room: VoiceRoom;
  onJoin: () => void;
  onClose: () => void;
  onMaximize: () => void;
}> = ({ room, onJoin, onClose, onMaximize }) => {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden"
      style={{
        background: "rgba(20, 20, 37, 0.95)",
        borderColor: COLORS.border,
        boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
      }}
      drag
      dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
      dragElastic={0.1}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span
            className="text-sm font-semibold truncate"
            style={{ color: COLORS.textPrimary }}
          >
            {room.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMaximize}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: COLORS.textMuted }}
            title="Maximize"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: COLORS.textMuted }}
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-2">
            {(room.participants || []).slice(0, 3).map((p: any, i: number) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold border-2"
                style={{
                  background: COLORS.surfaceRaised,
                  borderColor: COLORS.surface,
                  color: COLORS.textPrimary,
                }}
              >
                {initials(p.user?.name || "?")}
              </div>
            ))}
            {(room.participants?.length || 0) > 3 && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold border-2"
                style={{
                  background: COLORS.surfaceRaised,
                  borderColor: COLORS.surface,
                  color: COLORS.textMuted,
                }}
              >
                +{(room.participants?.length || 0) - 3}
              </div>
            )}
          </div>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {room.participants?.length || 0} listening
          </span>
        </div>

        <button
          onClick={onJoin}
          className="w-full py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${TYPE_ACCENTS[room.type] || COLORS.spotlight}, ${COLORS.purple})`,
            color: "#fff",
          }}
        >
          Open Room
        </button>
      </div>
    </motion.div>
  );
};

// ---- TOPICS Array ----
const TOPICS = [
  { name: "Conversation", icon: MessageCircle, color: "text-blue-400" },
  { name: "Language Learning", icon: BookOpen, color: "text-emerald-400" },
  { name: "Music", icon: Music, color: "text-pink-400" },
  { name: "Gaming", icon: Gamepad2, color: "text-purple-400" },
  { name: "Social", icon: Users, color: "text-cyan-400" },
  { name: "Casual", icon: Coffee, color: "text-amber-400" },
  { name: "Podcast", icon: Radio, color: "text-indigo-400" },
  { name: "Study", icon: BookOpen, color: "text-emerald-400" },
  { name: "Interview", icon: Mic, color: "text-red-400" },
  { name: "Panel", icon: Users, color: "text-violet-400" },
];

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Japanese",
  "Chinese",
  "Korean",
  "Portuguese",
  "Italian",
  "Russian",
];

// ---- Create Room Modal ----
const CreateRoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: any) => void;
  isPending: boolean;
  onMinimize?: () => void;
  isMinimized?: boolean;
}> = ({ isOpen, onClose, onCreate, isPending, onMinimize, isMinimized }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "OPEN",
    maxParticipants: 50,
    password: "",
    topics: [] as string[],
    language: "English",
    tags: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData({
        name: "",
        description: "",
        type: "OPEN",
        maxParticipants: 50,
        password: "",
        topics: [],
        language: "English",
        tags: [],
      });
      setSelectedTopics([]);
      setSelectedLanguage("English");
    }
  }, [isOpen]);

  const handleNext = () => {
    if (step === 1 && !formData.name.trim()) {
      toast.error("Please enter a room name");
      return;
    }
    if (
      step === 2 &&
      formData.type === "PRIVATE" &&
      formData.password.length < 4
    ) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topic)) {
        return prev.filter((t) => t !== topic);
      } else {
        return [...prev, topic];
      }
    });
    setFormData((prev) => ({
      ...prev,
      topics: selectedTopics.includes(topic)
        ? selectedTopics.filter((t) => t !== topic)
        : [...selectedTopics, topic],
    }));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border"
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b"
          style={{ background: COLORS.surface, borderColor: COLORS.border }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: COLORS.spotlightDim }}
              >
                <Mic className="w-5 h-5" style={{ color: COLORS.spotlight }} />
              </div>
              <div>
                <h2
                  className="font-serif text-lg"
                  style={{ color: COLORS.textPrimary }}
                >
                  Create a Voice Room
                </h2>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  Step {step} of 3
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onMinimize && (
                <button
                  onClick={onMinimize}
                  className="p-2 rounded-xl transition-colors hover:bg-white/5"
                  style={{ color: COLORS.textMuted }}
                  title="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-colors hover:bg-white/5"
                style={{ color: COLORS.textMuted }}
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 mt-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-all"
                style={{
                  background: i <= step ? COLORS.spotlight : COLORS.border,
                }}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: COLORS.textPrimary }}
                >
                  Room Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Spanish Conversation Practice"
                  className="w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all focus:border-[#F5A623]"
                  style={{
                    background: COLORS.surfaceRaised,
                    borderColor: COLORS.border,
                    color: COLORS.textPrimary,
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: COLORS.textPrimary }}
                >
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="What will this room be about?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border outline-none text-sm resize-none focus:border-[#F5A623]"
                  style={{
                    background: COLORS.surfaceRaised,
                    borderColor: COLORS.border,
                    color: COLORS.textPrimary,
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: COLORS.textPrimary }}
                >
                  Topics (select multiple)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    const isSelected = selectedTopics.includes(topic.name);
                    return (
                      <button
                        key={topic.name}
                        type="button"
                        onClick={() => toggleTopic(topic.name)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${isSelected ? "ring-2 ring-offset-2" : ""}`}
                        style={{
                          background: isSelected
                            ? COLORS.spotlightDim
                            : COLORS.surfaceRaised,
                          borderColor: isSelected
                            ? COLORS.spotlight
                            : COLORS.border,
                          color: isSelected
                            ? COLORS.spotlight
                            : COLORS.textMuted,
                          ringColor: COLORS.spotlight,
                        }}
                      >
                        <Icon
                          className={`w-4 h-4 ${isSelected ? topic.color : ""}`}
                        />
                        <span>{topic.name}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTopics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: COLORS.spotlightDim,
                          color: COLORS.spotlight,
                        }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Room Type
                  </label>
                  <div className="space-y-2">
                    {[
                      {
                        value: "OPEN",
                        label: "Open",
                        icon: Users,
                        desc: "Anyone can join",
                      },
                      {
                        value: "PRIVATE",
                        label: "Private",
                        icon: Lock,
                        desc: "Password protected",
                      },
                      {
                        value: "STAGE",
                        label: "Stage",
                        icon: Radio,
                        desc: "Speaker focused",
                      },
                      {
                        value: "SCHEDULED",
                        label: "Scheduled",
                        icon: Calendar,
                        desc: "Plan ahead",
                      },
                    ].map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              type: type.value as any,
                              password: "",
                            })
                          }
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${isSelected ? "ring-2 ring-offset-2" : ""}`}
                          style={{
                            background: isSelected
                              ? COLORS.spotlightDim
                              : COLORS.surfaceRaised,
                            borderColor: isSelected
                              ? COLORS.spotlight
                              : COLORS.border,
                            ringColor: COLORS.spotlight,
                          }}
                        >
                          <Icon
                            className={`w-4 h-4 ${isSelected ? `text-[${COLORS.spotlight}]` : ""}`}
                          />
                          <div className="flex-1 text-left">
                            <span
                              style={{
                                color: isSelected
                                  ? COLORS.spotlight
                                  : COLORS.textPrimary,
                              }}
                            >
                              {type.label}
                            </span>
                            <p
                              className="text-[10px]"
                              style={{ color: COLORS.textMuted }}
                            >
                              {type.desc}
                            </p>
                          </div>
                          {isSelected && (
                            <Check
                              className="w-4 h-4"
                              style={{ color: COLORS.spotlight }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Max Participants
                  </label>
                  <input
                    type="number"
                    value={formData.maxParticipants}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxParticipants: parseInt(e.target.value) || 50,
                      })
                    }
                    min={2}
                    max={100}
                    className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
                    style={{
                      background: COLORS.surfaceRaised,
                      borderColor: COLORS.border,
                      color: COLORS.textPrimary,
                    }}
                  />

                  <label
                    className="block text-sm font-medium mt-4 mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Language
                  </label>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => {
                      setSelectedLanguage(e.target.value);
                      setFormData({ ...formData, language: e.target.value });
                    }}
                    className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
                    style={{
                      background: COLORS.surfaceRaised,
                      borderColor: COLORS.border,
                      color: COLORS.textPrimary,
                    }}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.type === "PRIVATE" && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Room Password *
                  </label>
                  <div className="relative">
                    <KeyRound
                      className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{ color: COLORS.textMuted }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      placeholder="At least 4 characters"
                      minLength={4}
                      className="w-full pl-10 pr-10 py-3 rounded-xl border outline-none text-sm"
                      style={{
                        background: COLORS.surfaceRaised,
                        borderColor: COLORS.border,
                        color: COLORS.textPrimary,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: COLORS.textMuted }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p
                    className="text-xs mt-1.5"
                    style={{ color: COLORS.textMuted }}
                  >
                    Anyone joining will need this password.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div
                className="rounded-2xl p-5 border"
                style={{
                  background: COLORS.surfaceRaised,
                  borderColor: COLORS.border,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: COLORS.spotlightDim }}
                  >
                    <Mic
                      className="w-7 h-7"
                      style={{ color: COLORS.spotlight }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-lg font-semibold truncate"
                      style={{ color: COLORS.textPrimary }}
                    >
                      {formData.name || "Untitled Room"}
                    </h3>
                    {formData.description && (
                      <p
                        className="text-sm mt-1"
                        style={{ color: COLORS.textMuted }}
                      >
                        {formData.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: COLORS.border,
                          color: COLORS.textMuted,
                        }}
                      >
                        {TYPE_LABELS[formData.type] || formData.type}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: COLORS.border,
                          color: COLORS.textMuted,
                        }}
                      >
                        👥 {formData.maxParticipants} max
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: COLORS.border,
                          color: COLORS.textMuted,
                        }}
                      >
                        🌐 {formData.language}
                      </span>
                      {formData.topics.length > 0 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: COLORS.border,
                            color: COLORS.textMuted,
                          }}
                        >
                          📌 {formData.topics.length} topics
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: COLORS.textMuted }}
              >
                <Sparkles
                  className="w-4 h-4"
                  style={{ color: COLORS.spotlight }}
                />
                <span>
                  Your room will be live and ready for others to join!
                </span>
              </div>
            </motion.div>
          )}

          <div
            className="flex items-center justify-between pt-4 border-t"
            style={{ borderColor: COLORS.border }}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors hover:bg-white/5"
                style={{ color: COLORS.textMuted }}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
                style={{ background: COLORS.spotlight, color: COLORS.void }}
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105 disabled:opacity-60"
                style={{ background: COLORS.spotlight, color: COLORS.void }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <PartyPopper className="w-4 h-4" />
                    Create Room
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

const RoomCard: React.FC<{
  room: VoiceRoom;
  isCreator: boolean;
  isFull: boolean;
  isJoining: boolean;
  onJoin: () => void;
  onEnd: () => void;
  onCopyLink: () => void;
  accent: string;
  typeConfig: { label: string; icon: React.ElementType };
  status: { label: string; color: string; icon: React.ElementType };
  participantCount: number;
  previewParticipants: any[];
  hasMoreParticipants: boolean;
  isUserInRoom: boolean;
}> = ({
  room,
  isCreator,
  isFull,
  isJoining,
  onJoin,
  onEnd,
  onCopyLink,
  accent,
  typeConfig,
  status,
  participantCount,
  previewParticipants,
  hasMoreParticipants,
  isUserInRoom,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const TypeIcon = typeConfig.icon;
  const StatusIcon = status.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group rounded-2xl border overflow-hidden transition-all hover:border-opacity-70"
      style={{ background: COLORS.surface, borderColor: COLORS.border }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="h-1" style={{ background: accent }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-serif text-lg truncate"
                style={{ color: COLORS.textPrimary }}
              >
                {room.name}
              </h3>

              {/* HOST BADGE */}
              {isCreator && (
                <span
                  className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{
                    background: COLORS.spotlightDim,
                    color: COLORS.spotlight,
                  }}
                >
                  <Crown className="w-3 h-3" /> HOST
                </span>
              )}

              {/* INSIDE BADGE - Shows when user is in the room */}
              {isUserInRoom && !isCreator && (
                <span
                  className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
                  style={{
                    background: COLORS.liveDim,
                    color: COLORS.live,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  INSIDE
                </span>
              )}

              {room.isRecording && (
                <span
                  className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse"
                  style={{
                    background: "rgba(239, 68, 68, 0.2)",
                    color: "#EF4444",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Recording
                </span>
              )}
            </div>

            {room.description && (
              <p
                className="text-sm mt-1 line-clamp-2"
                style={{ color: COLORS.textMuted }}
              >
                {room.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded-full"
              style={{ background: `${accent}22`, color: accent }}
            >
              <TypeIcon className="w-3 h-3" />
              {typeConfig.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-2">
            {previewParticipants.length > 0 && (
              <div className="flex items-center -space-x-2">
                {previewParticipants.map((p: any) => {
                  const hue = hueFromString(p.user?.name || "?");
                  return (
                    <div
                      key={p.id}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold border-2 transition-all group-hover:border-opacity-100"
                      style={{
                        background: `hsl(${hue}, 35%, 24%)`,
                        borderColor: COLORS.surface,
                        color: COLORS.textPrimary,
                      }}
                      title={p.user?.name || "Unknown"}
                    >
                      {initials(p.user?.name || "?")}
                    </div>
                  );
                })}
                {hasMoreParticipants && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-semibold border-2"
                    style={{
                      background: COLORS.surfaceRaised,
                      borderColor: COLORS.surface,
                      color: COLORS.textMuted,
                    }}
                  >
                    +{participantCount - 4}
                  </div>
                )}
              </div>
            )}
            <span
              className="text-xs font-mono"
              style={{ color: COLORS.textMuted }}
            >
              {participantCount}/{room.maxParticipants || 50}
            </span>
          </div>

          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: `${status.color}22`,
              color: status.color,
            }}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>

          {room.scheduledFor && (
            <span
              className="text-xs font-mono"
              style={{ color: COLORS.textMuted }}
            >
              <Clock className="w-3 h-3 inline mr-1" />
              {new Date(room.scheduledFor).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* ✅ FIXED: Actions - Always show "Join Room" button */}
        <div
          className="flex items-center gap-2 mt-4 pt-3 border-t"
          style={{ borderColor: COLORS.border }}
        >
          {/* "Join Room" button - Always visible for everyone */}
          <button
            onClick={onJoin}
            disabled={isFull || isJoining}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isFull ? COLORS.textMuted : accent,
              color: isFull ? COLORS.void : COLORS.void,
            }}
          >
            {isJoining ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : room.type === "PRIVATE" ? (
              <Lock className="w-4 h-4" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {isJoining
              ? "Joining..."
              : isFull
                ? "Full"
                : isUserInRoom
                  ? "Rejoin Room"
                  : "Join Room"}
          </button>

          {/* "End Room" button - Only show for the creator/host */}
          {isCreator && (
            <button
              onClick={onEnd}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors hover:bg-white/5"
              style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
            >
              <Square className="w-3.5 h-3.5" />
              End Room
            </button>
          )}

          {/* Share button - Always visible */}
          <button
            onClick={onCopyLink}
            className="p-2 rounded-full transition-colors hover:bg-white/5"
            style={{ color: COLORS.textMuted }}
            title="Share room"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
// ---- Main VoicePage Component ----
export const VoicePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams<{ roomId?: string }>();
  const queryClient = useQueryClient();
  const { data: rooms, isLoading, refetch } = useVoiceRooms();
  const createRoom = useCreateVoiceRoom();
  const endRoom = useEndVoiceRoom();
  const joinRoom = useJoinVoiceRoom();
  const leaveRoom = useLeaveVoiceRoom();
  useChatSocket("", user?.id || "");

  // State
  const [showCreate, setShowCreate] = useState(false);
  const [isCreateMinimized, setIsCreateMinimized] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [joinTarget, setJoinTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // State for the current room ID
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    urlRoomId || null,
  );

  // Floating Mini Room state
  const [miniRoom, setMiniRoom] = useState<VoiceRoom | null>(null);
  const [showMiniRoom, setShowMiniRoom] = useState(false);

  // ✅ TRACK ROOMS THE USER HAS LEFT
  const [leftRoomIds, setLeftRoomIds] = useState<Set<string>>(new Set());

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmColor?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Sync activeRoomId with URL param
  useEffect(() => {
    if (urlRoomId) {
      setActiveRoomId(urlRoomId);
    } else {
      setActiveRoomId(null);
    }
  }, [urlRoomId]);

  // Auto-refresh rooms every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        refetch();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [refetch]);

  // ✅ Handle browser back button - leave the room when navigating away
  useEffect(() => {
    const handlePopState = () => {
      // If we have an active room and we're navigating back
      if (activeRoomId && !showMiniRoom) {
        console.log("🔙 Back button pressed, leaving room:", activeRoomId);
        // Mark the room as left
        setLeftRoomIds((prev) => new Set(prev).add(activeRoomId));
        // Clear active room
        setActiveRoomId(null);
        // Navigate to voice page
        navigate("/voice");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeRoomId, showMiniRoom, navigate]);

  const activeRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter((room) => room.status !== "ENDED");
  }, [rooms]);

  const endedRooms = useMemo(() => {
    if (!rooms) return [];
    return rooms.filter((room) => room.status === "ENDED");
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let result = activeRooms;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (room) =>
          room.name.toLowerCase().includes(q) ||
          room.description?.toLowerCase().includes(q),
      );
    }
    if (filterType) {
      result = result.filter((room) => room.type === filterType);
    }
    return result;
  }, [activeRooms, searchQuery, filterType]);

  // ✅ FIXED: isUserInRoom function with leftRoomIds
  const isUserInRoom = useCallback(
    (room: VoiceRoom) => {
      if (!user?.id) return false;

      // ✅ If we left this room, consider the user as NOT in the room
      if (leftRoomIds.has(room.id)) return false;

      // ✅ Check if user is in participants list
      const isInRoom =
        room.participants?.some((p: any) => p.userId === user.id) || false;

      // ✅ If the user is not in the room, remove from leftRoomIds
      if (!isInRoom && leftRoomIds.has(room.id)) {
        setLeftRoomIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(room.id);
          return newSet;
        });
      }

      return isInRoom;
    },
    [user?.id, leftRoomIds],
  );

  // ✅ FIXED: handleCreate - creates room and navigates properly
  const handleCreate = async (data: any) => {
    try {
      const payload: any = {
        name: data.name,
        description: data.description,
        type: data.type,
        maxParticipants: data.maxParticipants,
        language: data.language,
        topics: data.topics || [],
      };

      if (data.type === "PRIVATE") {
        payload.password = data.password;
      }

      const newRoom = await createRoom.mutateAsync(payload);

      if (!newRoom || !newRoom.id) {
        toast.error("Room creation failed. Please try again.");
        return;
      }

      toast.success("🎉 Room created! Invite others to join.");
      setShowCreate(false);
      setIsCreateMinimized(false);

      // ✅ Remove from left rooms if it was there
      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(newRoom.id);
        return newSet;
      });

      setActiveRoomId(newRoom.id);
      navigate(`/voice/${newRoom.id}`);
    } catch (error: any) {
      console.error("Create room error:", error);
      toast.error(error.response?.data?.message || "Failed to create room");
    }
  };

  // Handle joining/rejoining a room
  const handleJoinRoom = async (room: VoiceRoom) => {
    const isAlreadyInRoom = isUserInRoom(room);

    // If user is already in the room, just navigate directly
    if (isAlreadyInRoom) {
      // ✅ Remove from left rooms if it was there
      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(room.id);
        return newSet;
      });
      setActiveRoomId(room.id);
      navigate(`/voice/${room.id}`);
      return;
    }

    if (room.status === "ENDED") {
      toast.error("This room has ended");
      refetch();
      return;
    }

    const currentParticipants = room.participants?.length || 0;
    if (currentParticipants >= room.maxParticipants) {
      toast.error("This room is full");
      return;
    }

    if (room.type === "PRIVATE") {
      setJoinTarget({ id: room.id, name: room.name });
      setJoinPassword("");
      setJoinError("");
      return;
    }

    try {
      setJoiningRoomId(room.id);
      await joinRoom.mutateAsync(room.id);

      // ✅ Remove from left rooms
      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(room.id);
        return newSet;
      });

      await refetch();
      setActiveRoomId(room.id);
      navigate(`/voice/${room.id}`);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error?.message || "";
      if (
        errorMessage.includes("already in room") ||
        errorMessage.includes("already in the room")
      ) {
        await refetch();
        setLeftRoomIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(room.id);
          return newSet;
        });
        setActiveRoomId(room.id);
        navigate(`/voice/${room.id}`);
        return;
      }
      toast.error(error.response?.data?.message || "Failed to join room");
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleConfirmJoinWithPassword = async () => {
    if (!joinTarget) return;
    if (!joinPassword.trim()) {
      setJoinError("Password is required");
      return;
    }
    try {
      setJoiningRoomId(joinTarget.id);
      await joinRoom.mutateAsync(joinTarget.id);

      setLeftRoomIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(joinTarget.id);
        return newSet;
      });

      await refetch();
      setActiveRoomId(joinTarget.id);
      navigate(`/voice/${joinTarget.id}`, {
        state: { password: joinPassword },
      });
      setJoinTarget(null);
      setJoinPassword("");
      setJoinError("");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to join room");
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleEnd = async (roomId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "End Room?",
      message:
        "Are you sure you want to end this room? This action cannot be undone and all participants will be disconnected.",
      confirmText: "Yes, End Room",
      confirmColor: "#EF4444",
      onConfirm: async () => {
        try {
          await endRoom.mutateAsync(roomId);
          toast.success("Room ended");
          await refetch();

          // ✅ Add to left rooms
          setLeftRoomIds((prev) => new Set(prev).add(roomId));

          if (miniRoom?.id === roomId) {
            setShowMiniRoom(false);
            setMiniRoom(null);
          }
          if (activeRoomId === roomId) {
            setActiveRoomId(null);
            navigate("/voice");
          }
        } catch (error: any) {
          toast.error(error.response?.data?.message || "Failed to end room");
        }
      },
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleRoomLeft = async () => {
    const roomId = activeRoomId;

    if (!roomId) {
      navigate("/voice");
      return;
    }

    try {
      // ✅ Add to left rooms set
      setLeftRoomIds((prev) => new Set(prev).add(roomId));

      // ✅ Force a refetch of the rooms list
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["voice-rooms"] });
      queryClient.refetchQueries({ queryKey: ["voice-rooms"] });

      setShowMiniRoom(false);
      setMiniRoom(null);
      setActiveRoomId(null);
      navigate("/voice");
    } catch (error) {
      console.error("Error refreshing after leaving room:", error);
      setShowMiniRoom(false);
      setMiniRoom(null);
      setActiveRoomId(null);
      navigate("/voice");
    }
  };

  // Close the minimized room
  const handleCloseMiniRoom = async () => {
    if (!miniRoom?.id) return;

    const roomId = miniRoom.id;

    try {
      await leaveRoom.mutateAsync(roomId);

      // ✅ Add to left rooms
      setLeftRoomIds((prev) => new Set(prev).add(roomId));
      await refetch();

      setShowMiniRoom(false);
      setMiniRoom(null);
      setActiveRoomId(null);
      navigate("/voice");

      toast.success("Left room");
    } catch (error: any) {
      console.error("Error leaving minimized room:", error);
      toast.error(error?.response?.data?.message || "Failed to leave room");
    }
  };

  const handleMinimizeRoom = (roomData: any) => {
    setMiniRoom(roomData);
    setShowMiniRoom(true);
  };

  const handleMaximizeRoom = () => {
    if (!miniRoom) return;

    // ✅ Remove from left rooms when maximizing
    setLeftRoomIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(miniRoom.id);
      return newSet;
    });

    setShowMiniRoom(false);
    setActiveRoomId(miniRoom.id);
    navigate(`/voice/${miniRoom.id}`);
  };

  const getRoomStatus = (room: VoiceRoom) => {
    const participants = room.participants?.length || 0;
    const max = room.maxParticipants || 50;
    const percentage = Math.round((participants / max) * 100);
    if (percentage >= 90)
      return { label: "Almost full", color: COLORS.danger, icon: AlertCircle };
    if (percentage >= 70)
      return { label: "Busy", color: COLORS.spotlight, icon: Flame };
    if (percentage >= 40)
      return { label: "Active", color: COLORS.live, icon: Sparkles };
    return { label: "Quiet", color: COLORS.textMuted, icon: Users };
  };

  const typeConfig: Record<string, { label: string; icon: React.ElementType }> =
    {
      OPEN: { label: "Open", icon: Users },
      PRIVATE: { label: "Private", icon: Lock },
      STAGE: { label: "Stage", icon: Radio },
      SCHEDULED: { label: "Scheduled", icon: Calendar },
    };

  // While minimized, the room component stays mounted but the room list
  // becomes visible underneath it.
  const showRoomView = !!activeRoomId && !showMiniRoom;

  return (
    <div className="min-h-screen font-sans" style={{ background: COLORS.void }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header - Only show when NOT in a room */}
        {!showRoomView && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: COLORS.liveDim, color: COLORS.live }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: COLORS.live }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ background: COLORS.live }}
                    />
                  </span>
                  Live Conversations
                </span>
                {activeRooms.length > 0 && (
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{ background: COLORS.liveDim, color: COLORS.live }}
                  >
                    {activeRooms.length} active
                  </span>
                )}
              </div>
              <h1
                className="font-serif text-2xl sm:text-3xl mt-2 flex items-center gap-2"
                style={{ color: COLORS.textPrimary }}
              >
                Voice Rooms
                <span
                  className="text-sm font-sans font-normal"
                  style={{ color: COLORS.textMuted }}
                >
                  · {activeRooms.length} active
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2.5 rounded-xl transition-colors hover:bg-white/5 disabled:opacity-50"
                style={{ color: COLORS.textMuted }}
                title="Refresh"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>

              <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "grid" ? "bg-white/10" : ""
                  }`}
                  style={{
                    color:
                      viewMode === "grid"
                        ? COLORS.textPrimary
                        : COLORS.textMuted,
                  }}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "list" ? "bg-white/10" : ""
                  }`}
                  style={{
                    color:
                      viewMode === "list"
                        ? COLORS.textPrimary
                        : COLORS.textMuted,
                  }}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`p-2.5 rounded-xl transition-colors ${
                  showFilter ? "bg-white/10" : "hover:bg-white/5"
                }`}
                style={{
                  color: showFilter ? COLORS.spotlight : COLORS.textMuted,
                }}
              >
                <Filter className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
                style={{ background: COLORS.spotlight, color: COLORS.void }}
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Create Room</span>
              </button>
            </div>
          </div>
        )}

        {/* Search & Filter Bar - Only show when NOT in a room */}
        {!showRoomView && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: COLORS.textMuted }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rooms..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none text-sm transition-colors focus:border-[#F5A623]"
                style={{
                  background: COLORS.surface,
                  borderColor: COLORS.border,
                  color: COLORS.textPrimary,
                }}
              />
            </div>

            <AnimatePresence>
              {showFilter && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 overflow-hidden"
                >
                  {Object.entries(TYPE_ACCENTS).map(([type, color]) => (
                    <button
                      key={type}
                      onClick={() =>
                        setFilterType(filterType === type ? null : type)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        filterType === type ? "ring-2 ring-offset-2" : ""
                      }`}
                      style={{
                        background:
                          filterType === type ? color : COLORS.surfaceRaised,
                        color:
                          filterType === type ? COLORS.void : COLORS.textMuted,
                        ringColor: color,
                      }}
                    >
                      {TYPE_LABELS[type] || type}
                    </button>
                  ))}
                  {filterType && (
                    <button
                      onClick={() => setFilterType(null)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        background: COLORS.surfaceRaised,
                        color: COLORS.textMuted,
                      }}
                    >
                      Clear
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Main Content */}
        {isLoading ? (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                : "space-y-4"
            }
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border p-5 animate-pulse"
                style={{
                  background: COLORS.surface,
                  borderColor: COLORS.border,
                }}
              >
                <div
                  className="h-5 rounded-lg w-1/3 mb-3"
                  style={{ background: COLORS.surfaceRaised }}
                />
                <div
                  className="h-4 rounded-lg w-2/3"
                  style={{ background: COLORS.surfaceRaised }}
                />
                <div className="flex gap-2 mt-3">
                  <div
                    className="h-6 rounded-full w-16"
                    style={{ background: COLORS.surfaceRaised }}
                  />
                  <div
                    className="h-6 rounded-full w-16"
                    style={{ background: COLORS.surfaceRaised }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {filteredRooms.length > 0 ? (
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                    : "space-y-4"
                }
              >
                {filteredRooms.map((room) => {
                  const type = typeConfig[room.type] || typeConfig.OPEN;
                  const accent = TYPE_ACCENTS[room.type] || TYPE_ACCENTS.OPEN;
                  const isCreator = room.creatorId === user?.id;
                  const isFull =
                    (room.participants?.length || 0) >= room.maxParticipants;
                  const previewParticipants = (room.participants || []).slice(
                    0,
                    4,
                  );
                  const isJoining = joiningRoomId === room.id;
                  const status = getRoomStatus(room);
                  const participantCount = room.participants?.length || 0;
                  const hasMoreParticipants =
                    (room.participants?.length || 0) > 4;
                  const currentUserInRoom = isUserInRoom(room);

                  return (
                    <RoomCard
                      key={room.id}
                      room={room}
                      isCreator={isCreator}
                      isFull={isFull}
                      isJoining={isJoining}
                      onJoin={() => handleJoinRoom(room)}
                      onEnd={() => handleEnd(room.id)}
                      onCopyLink={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/voice/${room.id}`,
                        );
                        toast.success("🔗 Room link copied!");
                      }}
                      accent={accent}
                      typeConfig={type}
                      status={status}
                      participantCount={participantCount}
                      previewParticipants={previewParticipants}
                      hasMoreParticipants={hasMoreParticipants}
                      isUserInRoom={currentUserInRoom}
                    />
                  );
                })}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-24 text-center"
              >
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
                  style={{
                    background: COLORS.spotlightDim,
                  }}
                >
                  <Mic
                    className="w-10 h-10"
                    style={{
                      color: COLORS.spotlight,
                    }}
                  />
                </div>

                <h3
                  className="text-xl font-semibold mb-2"
                  style={{
                    color: COLORS.textPrimary,
                  }}
                >
                  No active rooms yet
                </h3>

                <p
                  className="max-w-sm text-sm mb-6"
                  style={{
                    color: COLORS.textMuted,
                  }}
                >
                  There are no live conversations right now. Create a room and
                  start speaking with others.
                </p>

                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all hover:scale-105"
                  style={{
                    background: COLORS.spotlight,
                    color: COLORS.void,
                  }}
                >
                  <Plus className="w-5 h-5" />
                  Create Room
                </button>
              </motion.div>
            )}

            {/* Ended Rooms - Collapsible */}
            {endedRooms.length > 0 && (
              <div
                className="mt-8 pt-4 border-t"
                style={{ borderColor: COLORS.border }}
              >
                <details className="group">
                  <summary
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ color: COLORS.textMuted }}
                  >
                    <span className="text-sm font-medium">Ended Rooms</span>
                    <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full">
                      {endedRooms.length}
                    </span>
                    <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-3 space-y-2">
                    {endedRooms.map((room) => (
                      <div
                        key={room.id}
                        className="rounded-xl border p-4 opacity-50"
                        style={{
                          background: COLORS.surface,
                          borderColor: COLORS.border,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4
                              className="font-semibold"
                              style={{ color: COLORS.textMuted }}
                            >
                              {room.name}
                            </h4>
                            <p
                              className="text-xs"
                              style={{ color: COLORS.textSecondary }}
                            >
                              Ended {timeSince(room.updatedAt)}
                            </p>
                          </div>
                          <span
                            className="text-xs px-2 py-1 rounded-full"
                            style={{
                              background: COLORS.border,
                              color: COLORS.textMuted,
                            }}
                          >
                            Ended
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </>
        )}
      </div>

      {/* Persistent VoiceRoomView */}
      {activeRoomId && (
        <div
          className={
            showMiniRoom
              ? "fixed inset-0 z-0 opacity-0 pointer-events-none"
              : "fixed inset-0 z-50 bg-black/95"
          }
          aria-hidden={showMiniRoom}
        >
          <VoiceRoomView
            key={activeRoomId}
            roomId={activeRoomId}
            onLeave={handleRoomLeft}
            onMinimize={handleMinimizeRoom}
          />
        </div>
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          setIsCreateMinimized(false);
        }}
        onCreate={handleCreate}
        isPending={createRoom.isPending}
        onMinimize={() => setIsCreateMinimized(true)}
        isMinimized={isCreateMinimized}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmColor={confirmModal.confirmColor}
      />

      {/* Floating Mini Room */}
      <AnimatePresence>
        {showMiniRoom && miniRoom && (
          <FloatingMiniRoom
            room={miniRoom}
            onJoin={handleMaximizeRoom}
            onClose={handleCloseMiniRoom}
            onMaximize={handleMaximizeRoom}
          />
        )}
      </AnimatePresence>

      {/* Join Password Modal */}
      <AnimatePresence>
        {joinTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setJoinTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl w-full max-w-sm p-6 border"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: COLORS.spotlightDim,
                    color: COLORS.spotlight,
                  }}
                >
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3
                    className="font-serif truncate"
                    style={{ color: COLORS.textPrimary }}
                  >
                    {joinTarget.name}
                  </h3>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>
                    This room is password-protected
                  </p>
                </div>
              </div>

              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: COLORS.textPrimary }}
              >
                Password
              </label>
              <div className="relative mb-1.5">
                <KeyRound
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                  style={{ color: COLORS.textMuted }}
                />
                <input
                  type={showJoinPassword ? "text" : "password"}
                  value={joinPassword}
                  onChange={(e) => {
                    setJoinPassword(e.target.value);
                    if (joinError) setJoinError("");
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleConfirmJoinWithPassword()
                  }
                  placeholder="Enter room password"
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border outline-none text-sm"
                  style={{
                    background: COLORS.surfaceRaised,
                    borderColor: joinError ? "#F87171" : COLORS.border,
                    color: COLORS.textPrimary,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowJoinPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: COLORS.textMuted }}
                >
                  {showJoinPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {joinError && (
                <p className="text-xs mb-3" style={{ color: "#F87171" }}>
                  {joinError}
                </p>
              )}
              {!joinError && <div className="mb-3" />}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={() => setJoinTarget(null)}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors hover:bg-white/5"
                  style={{ color: COLORS.textMuted }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmJoinWithPassword}
                  disabled={joiningRoomId !== null}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm disabled:opacity-60"
                  style={{ background: COLORS.spotlight, color: COLORS.void }}
                >
                  {joiningRoomId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  Join Room
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoicePage;
