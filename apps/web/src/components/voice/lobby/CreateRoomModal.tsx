// apps/web/src/components/voice/lobby/CreateRoomModal.tsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mic,
  Minimize2,
  PartyPopper,
  Radio,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  COLORS,
  LANGUAGES,
  ROOM_TEMPLATES,
  TOPICS,
  TYPE_ACCENTS,
  TYPE_LABELS,
} from "./lobbyTheme";

export interface CreateRoomForm {
  name: string;
  description: string;
  type: "OPEN" | "PRIVATE" | "STAGE" | "SCHEDULED";
  maxParticipants: number;
  password: string;
  topics: string[];
  language: string;
  tags: string[];
  /** ISO string, only for SCHEDULED rooms */
  scheduledFor?: string;
}

const EMPTY_FORM: CreateRoomForm = {
  name: "",
  description: "",
  type: "OPEN",
  maxParticipants: 50,
  password: "",
  topics: [],
  language: "English",
  tags: [],
};

const ROOM_TYPES = [
  { value: "OPEN", label: "Open", icon: Users, desc: "Anyone can join" },
  { value: "PRIVATE", label: "Private", icon: Lock, desc: "Password protected" },
  { value: "STAGE", label: "Stage", icon: Radio, desc: "Speaker focused" },
  { value: "SCHEDULED", label: "Scheduled", icon: Calendar, desc: "Plan ahead" },
] as const;

/** `datetime-local` wants local time without a zone: "2026-11-01T18:30" */
const toLocalInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const currentTimeMs = () => Date.now();

const inputStyle = {
  background: COLORS.surfaceRaised,
  borderColor: COLORS.border,
  color: COLORS.textPrimary,
};

export const CreateRoomModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateRoomForm) => void;
  isPending: boolean;
  onMinimize?: () => void;
  isMinimized?: boolean;
}> = ({ isOpen, onClose, onCreate, isPending, onMinimize }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CreateRoomForm>(EMPTY_FORM);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Earliest start the date picker allows (fixed when the modal opens)
  const [minStartLocal] = useState(() => toLocalInput(new Date()));

  const patch = (changes: Partial<CreateRoomForm>) =>
    setForm((f) => ({ ...f, ...changes }));

  const toggleTopic = (topic: string) =>
    setForm((f) => ({
      ...f,
      topics: f.topics.includes(topic)
        ? f.topics.filter((t) => t !== topic)
        : [...f.topics, topic],
    }));

  const applyTemplate = (id: string) => {
    const template = ROOM_TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    const { values } = template;
    setForm((f) => ({
      ...f,
      name: values.name,
      description: values.description,
      type: values.type as CreateRoomForm["type"],
      maxParticipants: values.maxParticipants,
      topics: [...values.topics],
      password: "",
    }));
  };

  const scheduledIso = (() => {
    if (!scheduledLocal) return undefined;
    const date = new Date(scheduledLocal);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  })();

  const handleNext = () => {
    if (step === 1 && !form.name.trim()) {
      toast.error("Please enter a room name");
      return;
    }
    if (step === 2 && form.type === "PRIVATE" && form.password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    if (step === 2 && form.type === "SCHEDULED") {
      if (!scheduledIso) {
        toast.error("Pick when the room starts");
        return;
      }
      if (new Date(scheduledIso).getTime() < currentTimeMs()) {
        toast.error("The start time must be in the future");
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      ...form,
      scheduledFor: form.type === "SCHEDULED" ? scheduledIso : undefined,
    });
  };

  if (!isOpen) return null;

  const accent = TYPE_ACCENTS[form.type] || COLORS.spotlight;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Create a voice room"
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
                  aria-label="Minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-colors hover:bg-white/5"
                style={{ color: COLORS.textMuted }}
                title="Close"
                aria-label="Close"
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
                style={{ background: i <= step ? COLORS.spotlight : COLORS.border }}
              />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: COLORS.textMuted }}
                >
                  Start from a template
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ROOM_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template.id)}
                      className="text-left rounded-xl border px-3 py-2.5 transition-all hover:-translate-y-0.5"
                      style={{
                        background: COLORS.surfaceRaised,
                        borderColor: COLORS.border,
                      }}
                      title={template.hint}
                    >
                      <span className="text-lg leading-none" aria-hidden="true">
                        {template.emoji}
                      </span>
                      <span
                        className="block text-xs font-semibold mt-1.5"
                        style={{ color: COLORS.textPrimary }}
                      >
                        {template.label}
                      </span>
                      <span
                        className="block text-[10px] leading-tight mt-0.5"
                        style={{ color: COLORS.textMuted }}
                      >
                        {template.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="room-name"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: COLORS.textPrimary }}
                >
                  Room Name *
                </label>
                <input
                  id="room-name"
                  type="text"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="e.g., Spanish Conversation Practice"
                  className="w-full px-4 py-3 rounded-xl border outline-none text-sm transition-all focus:border-[#F5A623]"
                  style={inputStyle}
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="room-description"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: COLORS.textPrimary }}
                >
                  Description
                </label>
                <textarea
                  id="room-description"
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="What will this room be about?"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border outline-none text-sm resize-none focus:border-[#F5A623]"
                  style={inputStyle}
                />
              </div>

              <div>
                <p
                  className="block text-sm font-medium mb-2"
                  style={{ color: COLORS.textPrimary }}
                >
                  Topics (select multiple)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TOPICS.map((topic) => {
                    const Icon = topic.icon;
                    const selected = form.topics.includes(topic.name);
                    return (
                      <button
                        key={topic.name}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleTopic(topic.name)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                        style={{
                          background: selected
                            ? COLORS.spotlightDim
                            : COLORS.surfaceRaised,
                          borderColor: selected ? COLORS.spotlight : COLORS.border,
                          color: selected ? COLORS.spotlight : COLORS.textMuted,
                        }}
                      >
                        <Icon className={`w-4 h-4 ${selected ? topic.color : ""}`} />
                        <span>{topic.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Room Type
                  </p>
                  <div className="space-y-2">
                    {ROOM_TYPES.map((type) => {
                      const Icon = type.icon;
                      const selected = form.type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => patch({ type: type.value, password: "" })}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all"
                          style={{
                            background: selected
                              ? COLORS.spotlightDim
                              : COLORS.surfaceRaised,
                            borderColor: selected ? COLORS.spotlight : COLORS.border,
                          }}
                        >
                          <Icon
                            className="w-4 h-4"
                            style={{
                              color: selected ? COLORS.spotlight : COLORS.textMuted,
                            }}
                          />
                          <div className="flex-1 text-left">
                            <span
                              style={{
                                color: selected
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
                          {selected && (
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
                    htmlFor="room-max"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Max Participants
                  </label>
                  <input
                    id="room-max"
                    type="number"
                    value={form.maxParticipants}
                    onChange={(e) =>
                      patch({ maxParticipants: parseInt(e.target.value) || 50 })
                    }
                    min={2}
                    max={100}
                    className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
                    style={inputStyle}
                  />

                  <label
                    htmlFor="room-language"
                    className="block text-sm font-medium mt-4 mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Language
                  </label>
                  <select
                    id="room-language"
                    value={form.language}
                    onChange={(e) => patch({ language: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
                    style={inputStyle}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.type === "SCHEDULED" && (
                <div>
                  <label
                    htmlFor="room-start"
                    className="block text-sm font-medium mb-1.5"
                    style={{ color: COLORS.textPrimary }}
                  >
                    Starts at *
                  </label>
                  <input
                    id="room-start"
                    type="datetime-local"
                    value={scheduledLocal}
                    min={minStartLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none text-sm"
                    style={{ ...inputStyle, colorScheme: "dark" }}
                  />
                  <p className="text-xs mt-1.5" style={{ color: COLORS.textMuted }}>
                    People will see a countdown and can add it to their calendar.
                  </p>
                </div>
              )}

              {form.type === "PRIVATE" && (
                <div>
                  <label
                    htmlFor="room-password"
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
                      id="room-password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => patch({ password: e.target.value })}
                      placeholder="At least 4 characters"
                      minLength={4}
                      className="w-full pl-10 pr-10 py-3 rounded-xl border outline-none text-sm"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: COLORS.textMuted }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: COLORS.textMuted }}>
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
              className="space-y-5"
            >
              <div
                className="rounded-2xl border overflow-hidden"
                style={{ background: COLORS.surfaceRaised, borderColor: COLORS.border }}
              >
                <div className="h-1" style={{ background: accent }} />
                <div className="p-5 flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${accent} 13.3%, transparent)` }}
                  >
                    <Mic className="w-7 h-7" style={{ color: accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-lg font-semibold truncate"
                      style={{ color: COLORS.textPrimary }}
                    >
                      {form.name || "Untitled Room"}
                    </h3>
                    {form.description && (
                      <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
                        {form.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {[
                        TYPE_LABELS[form.type] || form.type,
                        `👥 up to ${form.maxParticipants}`,
                        `🌐 ${form.language}`,
                        ...(form.type === "SCHEDULED" && scheduledIso
                          ? [
                              `🗓 ${new Date(scheduledIso).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}`,
                            ]
                          : []),
                        ...form.topics,
                      ].map((chip) => (
                        <span
                          key={chip}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: COLORS.border, color: COLORS.textMuted }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: COLORS.textMuted }}
              >
                <Sparkles className="w-4 h-4" style={{ color: COLORS.spotlight }} />
                <span>
                  {form.type === "SCHEDULED"
                    ? "Your room will appear in the lobby with a countdown."
                    : "Your room will be live and ready for others to join!"}
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
                onClick={() => setStep((s) => s - 1)}
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
