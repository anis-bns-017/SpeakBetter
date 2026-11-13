// apps/web/src/components/voice/lobby/LobbyModals.tsx
import React from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Maximize2,
  X,
} from "lucide-react";
import type { MinimizedRoomData } from "../VoiceRoomView.types";
import { COLORS, TYPE_ACCENTS } from "./lobbyTheme";
import { initials } from "./lobbyUtils";
import { tr } from "../../../i18n/core";

// ---- Confirmation ----
export const ConfirmationModal: React.FC<{
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
  confirmColor = COLORS.danger,
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
        role="alertdialog"
        aria-modal="true"
        aria-label={tr(title)}
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
            style={{ background: `color-mix(in srgb, ${confirmColor} 13.3%, transparent)` }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: confirmColor }} />
          </div>
          <h3
            className="font-serif text-xl mb-2"
            style={{ color: COLORS.textPrimary }}
          >
            {tr(title)}
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
              style={{ background: confirmColor, color: "var(--sx-text-ffffff)" }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ---- Floating mini room (a minimized room you are still in) ----
export const FloatingMiniRoom: React.FC<{
  room: MinimizedRoomData;
  onJoin: () => void;
  onClose: () => void;
  onMaximize: () => void;
}> = ({ room, onJoin, onClose, onMaximize }) => {
  const count = room.participants?.length || 0;
  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed bottom-6 right-6 z-50 w-72 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden"
      style={{
        background: "var(--sx-bg-20-20-37-950)",
        borderColor: COLORS.border,
        boxShadow: "0 20px 60px var(--sx-shadow-0-0-0-800)",
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
            title={tr("Maximize")}
            aria-label={tr("Maximize room")}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: COLORS.textMuted }}
            title={tr("Leave room")}
            aria-label={tr("Leave room")}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex -space-x-2">
            {(room.participants || []).slice(0, 3).map((p: { id: string; user?: { name?: string } }) => (
              <div
                key={p.id}
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
            {count > 3 && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-semibold border-2"
                style={{
                  background: COLORS.surfaceRaised,
                  borderColor: COLORS.surface,
                  color: COLORS.textMuted,
                }}
              >
                +{count - 3}
              </div>
            )}
          </div>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {count} {" "}{tr("listening")}</span>
        </div>

        <button
          onClick={onJoin}
          className="w-full py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${TYPE_ACCENTS[room.type] || COLORS.spotlight}, ${COLORS.purple})`,
            color: "var(--sx-text-ffffff)",
          }}
        >
          {tr("Open Room")}</button>
      </div>
    </motion.div>
  );
};

// ---- Password prompt for private rooms ----
export const JoinPasswordModal: React.FC<{
  roomName: string;
  password: string;
  error: string;
  show: boolean;
  joining: boolean;
  onPasswordChange: (value: string) => void;
  onToggleShow: () => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({
  roomName,
  password,
  error,
  show,
  joining,
  onPasswordChange,
  onToggleShow,
  onConfirm,
  onClose,
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
    onClick={onClose}
  >
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={tr("Join {roomName}", { roomName })}
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
          style={{ background: COLORS.spotlightDim, color: COLORS.spotlight }}
        >
          <Lock className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="font-serif truncate" style={{ color: COLORS.textPrimary }}>
            {roomName}
          </h3>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            {tr("This room is password-protected")}</p>
        </div>
      </div>

      <label
        htmlFor="lobby-join-password"
        className="block text-sm font-medium mb-1.5"
        style={{ color: COLORS.textPrimary }}
      >
        {tr("Password")}</label>
      <div className="relative mb-1.5">
        <KeyRound
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: COLORS.textMuted }}
        />
        <input
          id="lobby-join-password"
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          placeholder={tr("Enter room password")}
          autoFocus
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border outline-none text-sm"
          style={{
            background: COLORS.surfaceRaised,
            borderColor: error ? "#F87171" : COLORS.border,
            color: COLORS.textPrimary,
          }}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: COLORS.textMuted }}
          aria-label={show ? tr("Hide password") : tr("Show password")}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error ? (
        <p className="text-xs mb-3" style={{ color: "var(--sx-text-f87171)" }}>
          {error}
        </p>
      ) : (
        <div className="mb-3" />
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          onClick={onClose}
          className="px-4 py-2.5 text-sm font-medium rounded-xl transition-colors hover:bg-white/5"
          style={{ color: COLORS.textMuted }}
        >
          {tr("Cancel")}</button>
        <button
          onClick={onConfirm}
          disabled={joining}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm disabled:opacity-60"
          style={{ background: COLORS.spotlight, color: COLORS.void }}
        >
          {joining ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {tr("Join Room")}</button>
      </div>
    </motion.div>
  </motion.div>
);
