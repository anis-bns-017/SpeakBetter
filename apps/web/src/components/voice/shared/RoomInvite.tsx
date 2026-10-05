// apps/web/src/components/voice/shared/RoomInvite.tsx
/**
 * RoomInvite — premium share sheet for voice rooms.
 * Features:
 *  - Copy-able room link
 *  - Native Web Share API (mobile)
 *  - Share to WhatsApp / X / Telegram / Email / Discord
 *  - QR code via public API (no npm dep)
 *  - Recent share feedback toast
 */

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  Share2,
  Twitter,
  Send,
  Mail,
  MessageCircle,
  QrCode,
  Link2,
  Users,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { THEME } from "../VoiceRoomView.theme";

interface RoomInviteProps {
  isOpen: boolean;
  onClose: () => void;
  roomName: string;
  roomId: string;
  participantCount?: number;
  /** Optional override — defaults to window.location.origin + /voice/:id */
  roomUrl?: string;
}

export const RoomInvite: React.FC<RoomInviteProps> = ({
  isOpen,
  onClose,
  roomName,
  roomId,
  participantCount = 0,
  roomUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const inviteUrl = useMemo(
    () =>
      roomUrl ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/voice/${roomId}`
        : ""),
    [roomUrl, roomId],
  );

  const shareText = `Join me in "${roomName}" on SpeakBetter 🎙️`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("🔗 Invite link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: `Join ${roomName}`,
        text: shareText,
        url: inviteUrl,
      });
    } catch {
      // user cancelled
    }
  };

  const shareTo = (target: "whatsapp" | "twitter" | "telegram" | "email" | "discord") => {
    const encodedUrl = encodeURIComponent(inviteUrl);
    const encodedText = encodeURIComponent(shareText);
    let href = "";

    switch (target) {
      case "whatsapp":
        href = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
      case "twitter":
        href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case "telegram":
        href = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        break;
      case "email":
        href = `mailto:?subject=${encodeURIComponent(`Join ${roomName} on SpeakBetter`)}&body=${encodedText}%0A%0A${encodedUrl}`;
        break;
      case "discord":
        // Discord has no web share URL; copy is the best UX
        handleCopy();
        toast.info("Link copied — paste it in Discord");
        return;
    }

    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  const qrSrc = useMemo(() => {
    if (!inviteUrl) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
      inviteUrl,
    )}`;
  }, [inviteUrl]);

  const hasNativeShare =
    typeof navigator !== "undefined" && Boolean(navigator.share);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-2xl flex items-center justify-center z-[80] px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="rounded-3xl w-full max-w-md border overflow-hidden"
            style={{
              background: THEME.colors.background.card,
              borderColor: THEME.colors.border.primary,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-5 pt-5 pb-4 flex items-start justify-between gap-3"
              style={{
                background:
                  "linear-gradient(135deg, rgba(129,140,248,0.14), rgba(167,139,250,0.06))",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${THEME.colors.accent.primary}, ${THEME.colors.accent.secondary})`,
                  }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-base font-bold truncate"
                    style={{ color: THEME.colors.text.primary }}
                  >
                    Invite friends
                  </h3>
                  <p
                    className="text-xs truncate"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    {roomName}
                    {participantCount > 0 ? ` · ${participantCount} inside` : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors shrink-0"
                style={{ color: THEME.colors.text.muted }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 pb-5 pt-4 space-y-4">
              {/* Link row */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Link2
                    className="w-3.5 h-3.5"
                    style={{ color: THEME.colors.accent.primary }}
                  />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Room link
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 rounded-xl border pl-3.5 pr-1.5 py-1.5"
                  style={{
                    background: THEME.colors.background.primary,
                    borderColor: THEME.colors.border.primary,
                  }}
                >
                  <span
                    className="flex-1 text-xs truncate font-mono"
                    style={{ color: THEME.colors.text.secondary }}
                    title={inviteUrl}
                  >
                    {inviteUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1.5 rounded-lg font-semibold text-[11px] flex items-center gap-1.5 transition-all hover:scale-[1.03] active:scale-95 shrink-0"
                    style={{
                      background: copied
                        ? "rgba(52,211,153,0.18)"
                        : "rgba(129,140,248,0.18)",
                      color: copied
                        ? THEME.colors.accent.success
                        : THEME.colors.accent.primary,
                    }}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Share buttons */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Share2
                    className="w-3.5 h-3.5"
                    style={{ color: THEME.colors.accent.primary }}
                  />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: THEME.colors.text.muted }}
                  >
                    Share via
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <ShareButton
                    label="WhatsApp"
                    color="#25D366"
                    icon={<MessageCircle className="w-4 h-4" />}
                    onClick={() => shareTo("whatsapp")}
                  />
                  <ShareButton
                    label="X"
                    color="#FFFFFF"
                    icon={<Twitter className="w-4 h-4" />}
                    onClick={() => shareTo("twitter")}
                  />
                  <ShareButton
                    label="Telegram"
                    color="#26A5E4"
                    icon={<Send className="w-4 h-4" />}
                    onClick={() => shareTo("telegram")}
                  />
                  <ShareButton
                    label="Email"
                    color="#F59E0B"
                    icon={<Mail className="w-4 h-4" />}
                    onClick={() => shareTo("email")}
                  />
                  <ShareButton
                    label="Discord"
                    color="#5865F2"
                    icon={<Users className="w-4 h-4" />}
                    onClick={() => shareTo("discord")}
                  />
                </div>
              </div>

              {/* QR / Native share row */}
              <div className="flex gap-2">
                {hasNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex-1 py-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all hover:bg-white/5"
                    style={{
                      borderColor: THEME.colors.border.primary,
                      color: THEME.colors.text.primary,
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    More options
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  className="flex-1 py-2.5 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-all hover:bg-white/5"
                  style={{
                    borderColor: showQr
                      ? THEME.colors.accent.primary
                      : THEME.colors.border.primary,
                    color: showQr
                      ? THEME.colors.accent.primary
                      : THEME.colors.text.primary,
                  }}
                >
                  <QrCode className="w-4 h-4" />
                  {showQr ? "Hide QR" : "Show QR"}
                </button>
              </div>

              {/* QR code */}
              <AnimatePresence initial={false}>
                {showQr && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="rounded-2xl border p-4 flex flex-col items-center gap-3"
                      style={{
                        background: THEME.colors.background.primary,
                        borderColor: THEME.colors.border.primary,
                      }}
                    >
                      {qrSrc && (
                        <img
                          src={qrSrc}
                          alt="Room QR code"
                          width={200}
                          height={200}
                          className="rounded-xl bg-white p-2"
                          loading="lazy"
                        />
                      )}
                      <p
                        className="text-[10px] text-center"
                        style={{ color: THEME.colors.text.muted }}
                      >
                        Scan with a phone camera to join
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Hint */}
              <p
                className="text-[10px] text-center leading-relaxed"
                style={{ color: THEME.colors.text.muted }}
              >
                Anyone with the link can join the room.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ------------------------------------------------------------
// Share button sub-component
// ------------------------------------------------------------
const ShareButton: React.FC<{
  label: string;
  color: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, color, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border py-2.5 transition-all hover:-translate-y-0.5 active:scale-95"
    style={{
      background: "rgba(255,255,255,0.02)",
      borderColor: "rgba(255,255,255,0.08)",
    }}
    title={label}
  >
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center"
      style={{ background: `${color}22`, color }}
    >
      {icon}
    </span>
    <span
      className="text-[9px] font-medium"
      style={{ color: "rgba(255,255,255,0.7)" }}
    >
      {label}
    </span>
  </button>
);

export default RoomInvite;