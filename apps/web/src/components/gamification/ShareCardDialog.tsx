// apps/web/src/components/gamification/ShareCardDialog.tsx
/**
 * Shows a share card (see lib/shareCard) and lets the learner send it on: the phone's share sheet when there
 * is one, otherwise save the picture or copy it. The picture is made on the device and never uploaded.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Copy, Download, Loader2, Share2, X } from "lucide-react";
import { Button } from "../ui";
import { cardFileName, cardShareText, CARD_HEIGHT, CARD_WIDTH, renderShareCard, type ShareCardData } from "../../lib/shareCard";

export const ShareCardDialog: React.FC<{ card: ShareCardData; onClose: () => void }> = ({ card, onClose }) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    renderShareCard(card)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [card]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const file = useMemo(() => (blob ? new File([blob], cardFileName(card), { type: "image/png" }) : null), [blob, card]);
  const canShareFile = !!file && typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  const canCopy = typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

  const share = useCallback(async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text: cardShareText(card), title: "SpeakBetter" });
    } catch (error) {
      // Closing the share sheet is not an error
      if ((error as Error)?.name !== "AbortError") toast.error("Couldn't open the share sheet. Try Save image.");
    }
  }, [file, card]);

  const save = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = cardFileName(card);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copy = async () => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Picture copied. Paste it into a chat or post.");
    } catch {
      toast.error("Couldn't copy the picture. Try Save image.");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Share card"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        // Keep Escape from also closing a celebration screen behind this dialog
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="relative flex max-h-full w-full max-w-sm flex-col rounded-3xl border border-line bg-surface p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Share this</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="mt-3 min-h-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/[0.05]"
          style={{ aspectRatio: `${CARD_WIDTH} / ${CARD_HEIGHT}`, maxHeight: "58vh" }}
        >
          {url ? (
            <img src={url} alt={cardShareText(card)} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full w-full place-items-center text-sm text-slate-500" role="status">
              {failed ? (
                "Couldn't make the picture on this device."
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Making your card
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          {canShareFile && (
            <Button icon={Share2} onClick={share}>
              Share
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant={canShareFile ? "secondary" : "primary"} icon={Download} onClick={save} disabled={!url}>
              Save image
            </Button>
            {canCopy && (
              <Button variant="secondary" icon={Copy} onClick={copy} disabled={!blob}>
                Copy
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">The picture is made on your device. Nothing is uploaded.</p>
      </div>
    </div>,
    document.body,
  );
};

/** A button that opens the share dialog for a card */
export const ShareCardButton: React.FC<{
  card: ShareCardData;
  label?: string;
  variant?: "primary" | "secondary" | "soft" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({ card, label = "Share", variant = "secondary", size = "md", className }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button variant={variant} size={size} icon={Share2} onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      {open && <ShareCardDialog card={card} onClose={close} />}
    </>
  );
};

export default ShareCardDialog;
