// apps/web/src/components/voice/chat/AttachmentPreviewModal.tsx
/**
 * AttachmentPreviewModal — review a file before sending.
 * Features:
 *  - Thumbnail preview (image / video / audio waveform / file icon)
 *  - Optional caption (becomes the message content)
 *  - File size + type display
 *  - Replace / Remove / Send actions
 *  - Upload progress bar
 *  - Drag-drop replacement inside the modal
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Image as ImageIcon,
  Video,
  Music,
  File as FileIcon,
  Upload,
  Loader2,
  Send,
  RotateCcw,
  Trash2,
  Play,
  Pause,
} from "lucide-react";
import { THEME } from "../VoiceRoomView.theme";

export interface PendingAttachment {
  file: File;
  kind: "image" | "video" | "audio" | "file";
  previewUrl: string | null; // local object URL — null for non-previewable
}

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  attachment: PendingAttachment | null;
  /** Called when user clicks Send. Return the final Cloudinary URL. */
  onSend: (caption: string) => Promise<void>;
  onCancel: () => void;
  /** Optional: called when user replaces the file inside the modal */
  onReplace?: (file: File) => void;
  maxLength?: number;
}

export const AttachmentPreviewModal: React.FC<
  AttachmentPreviewModalProps
> = ({
  isOpen,
  attachment,
  onSend,
  onCancel,
  onReplace,
  maxLength = 500,
}) => {
  const [caption, setCaption] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const replaceInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dragCounter = useRef(0);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setCaption("");
      setIsSending(false);
      setProgress(0);
      setIsDragging(false);
      setIsPlaying(false);
      dragCounter.current = 0;
    }
  }, [isOpen]);

  // Reset caption when attachment changes
  useEffect(() => {
    setCaption("");
  }, [attachment?.file.name]);

  // Escape to cancel
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) onCancel();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isSending) {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSending, caption]);

  const handleSend = useCallback(async () => {
    if (isSending) return;
    setIsSending(true);
    setProgress(10);

    // Animate progress while uploading
    const tick = window.setInterval(() => {
      setProgress((p) => Math.min(p + 8 + Math.random() * 10, 92));
    }, 220);

    try {
      await onSend(caption.trim());
      window.clearInterval(tick);
      setProgress(100);
      // Small delay so the user sees 100%
      await new Promise((r) => setTimeout(r, 250));
    } catch (err) {
      window.clearInterval(tick);
      setProgress(0);
      // Error toast handled by parent
    } finally {
      setIsSending(false);
    }
  }, [isSending, onSend, caption]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file && onReplace) onReplace(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const togglePlayAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  if (!attachment) return null;

  const { file, kind, previewUrl } = attachment;
  const sizeLabel = formatFileSize(file.size);
  const overLimit = caption.length > maxLength;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[85] px-4"
          onClick={isSending ? undefined : onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="rounded-3xl w-full max-w-lg border overflow-hidden"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
            }}
            onClick={(e) => e.stopPropagation()}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between gap-3 border-b"
              style={{ borderColor: THEME.colors.border.primary }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${colorForKind(kind)}22`,
                  }}
                >
                  {kindIcon(kind, colorForKind(kind))}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    Send {kind === "file" ? "file" : kind}
                  </p>
                  <p
                    className="text-[10px] truncate"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    {file.name} · {sizeLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCancel}
                disabled={isSending}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40 shrink-0"
                style={{ color: THEME.colors.text.muted }}
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview area */}
            <div
              className="relative"
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              {/* Image */}
              {kind === "image" && previewUrl && (
                <div className="flex items-center justify-center max-h-[340px] overflow-hidden bg-black/60">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="max-w-full max-h-[340px] object-contain"
                  />
                </div>
              )}

              {/* Video */}
              {kind === "video" && previewUrl && (
                <div className="flex items-center justify-center max-h-[340px] overflow-hidden bg-black/60">
                  <video
                    src={previewUrl}
                    controls
                    preload="metadata"
                    className="max-w-full max-h-[340px]"
                  />
                </div>
              )}

              {/* Audio */}
              {kind === "audio" && previewUrl && (
                <div className="flex items-center justify-center py-8 bg-black/40">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={togglePlayAudio}
                      className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                      style={{
                        background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                        color: "#fff",
                      }}
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </button>
                    <div className="text-sm" style={{ color: THEME.colors.text.secondary }}>
                      Audio preview
                    </div>
                    <audio
                      ref={audioRef}
                      src={previewUrl}
                      onEnded={() => setIsPlaying(false)}
                      onPause={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      className="hidden"
                    />
                  </div>
                </div>
              )}

              {/* Generic file */}
              {kind === "file" && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div
                      className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                      style={{ background: "rgba(129,140,248,0.14)" }}
                    >
                      <FileIcon
                        className="w-7 h-7"
                        style={{ color: THEME.colors.accent.primary }}
                      />
                    </div>
                    <p
                      className="text-sm font-medium max-w-[320px] truncate"
                      style={{ color: THEME.colors.text.primary }}
                    >
                      {file.name}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: THEME.colors.text.muted }}
                    >
                      {sizeLabel} · {file.type || "Unknown type"}
                    </p>
                  </div>
                </div>
              )}

              {/* Drag overlay */}
              <AnimatePresence>
                {isDragging && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center z-10"
                    style={{
                      background: "rgba(129,140,248,0.18)",
                      backdropFilter: "blur(4px)",
                      border: `2px dashed ${THEME.colors.accent.primary}`,
                    }}
                  >
                    <div className="text-center">
                      <Upload
                        className="w-8 h-8 mx-auto mb-2"
                        style={{ color: THEME.colors.accent.primary }}
                      />
                      <p
                        className="text-sm font-semibold"
                        style={{ color: THEME.colors.text.primary }}
                      >
                        Drop to replace
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Caption + actions */}
            <div
              className="px-5 py-4 space-y-3 border-t"
              style={{ borderColor: THEME.colors.border.primary }}
            >
              {/* Caption input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Caption (optional)
                  </span>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{
                      color: overLimit
                        ? THEME.colors.accent.error
                        : THEME.colors.text.muted,
                    }}
                  >
                    {caption.length}/{maxLength}
                  </span>
                </div>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) =>
                    setCaption(e.target.value.slice(0, maxLength + 20))
                  }
                  placeholder="Say something about this…"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none border focus:ring-1 transition-all"
                  style={{
                    background: THEME.colors.background.primary,
                    borderColor: overLimit
                      ? THEME.colors.accent.error
                      : THEME.colors.border.primary,
                    color: THEME.colors.text.primary,
                  }}
                  disabled={isSending}
                  autoFocus
                />
              </div>

              {/* Progress bar */}
              <AnimatePresence initial={false}>
                {isSending && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.08)" }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.25 }}
                        style={{
                          background: `linear-gradient(90deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                        }}
                      />
                    </div>
                    <p
                      className="text-[10px] mt-1.5 text-center"
                      style={{ color: THEME.colors.text.muted }}
                    >
                      Uploading… {Math.round(progress)}%
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onReplace && (
                    <>
                      <input
                        ref={replaceInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onReplace(f);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => replaceInputRef.current?.click()}
                        disabled={isSending}
                        className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all hover:bg-white/5 disabled:opacity-40"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Replace
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSending}
                    className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all hover:bg-red-500/10 disabled:opacity-40"
                    style={{ color: THEME.colors.accent.error }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || overLimit}
                  className="px-5 py-2.5 rounded-full font-semibold text-sm flex items-center gap-2 transition-all hover:scale-[1.03] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                    color: "#fff",
                    boxShadow: `0 6px 20px ${THEME.colors.accent.primary}44`,
                  }}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send
                    </>
                  )}
                </button>
              </div>

              <p
                className="text-[9px] text-center"
                style={{ color: THEME.colors.text.muted }}
              >
                <b>⌘/Ctrl + Enter</b> to send · <b>Esc</b> to cancel
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function kindIcon(kind: "image" | "video" | "audio" | "file", color: string) {
  const style = { color };
  const cls = "w-4 h-4";
  switch (kind) {
    case "image":
      return <ImageIcon className={cls} style={style} />;
    case "video":
      return <Video className={cls} style={style} />;
    case "audio":
      return <Music className={cls} style={style} />;
    default:
      return <FileIcon className={cls} style={style} />;
  }
}

function colorForKind(kind: "image" | "video" | "audio" | "file"): string {
  switch (kind) {
    case "image":
      return THEME.colors.accent.cyan;
    case "video":
      return THEME.colors.accent.error;
    case "audio":
      return THEME.colors.accent.success;
    default:
      return THEME.colors.accent.primary;
  }
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default AttachmentPreviewModal;