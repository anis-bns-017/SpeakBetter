import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../components/voice/lobby/lobbyTheme";
import { ConfirmationModal } from "../components/voice/lobby/LobbyModals";
import { useRandomCall } from "../components/call/useRandomCall";
import { callApi, type ReportReason } from "../components/call/callApi";
import { CallSetup } from "../components/call/CallSetup";
import { InCallScreen, SearchingScreen, TimeoutScreen } from "../components/call/CallScreens";
import { CallRecap } from "../components/call/CallRecap";
import { ReportDialog } from "../components/call/CallSafety";
import { useCallExtras } from "../components/call/useCallExtras";
import {
  CaptionsPanel,
  ReactionBar,
  ReactionFloat,
  TipComposer,
  TipsInbox,
} from "../components/call/CallExtras";
import { useWordBank } from "../hooks/useWordBank";
import { fetchMeaning } from "../hooks/useLookup";

/** Random one-to-one calls: pick a level and goal, get matched, talk for five minutes */
export const RandomCallPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const rc = useRandomCall();
  const inCall = rc.phase === "in-call";
  const extras = useCallExtras({
    getSocket: rc.getSocket,
    connected: rc.connected,
    callId: rc.call?.callId ?? null,
    inCall,
    muted: rc.muted,
  });
  // The word bank only matters while captions can be tapped
  const bank = useWordBank(inCall || rc.phase === "connecting");
  const savedWords = useMemo(
    () => new Set([...bank.savedSet, ...extras.savedWords]),
    [bank.savedSet, extras.savedWords],
  );
  const saveWord = (word: string, sentence: string) => {
    void fetchMeaning(word)
      .then((meaning) => bank.save({ word, sentence, meaning, speakerName: rc.call?.partner.name }))
      .then((saved) => {
        if (saved) extras.noteSavedWord(word);
      });
  };
  const [lastPrefs, setLastPrefs] = useState<Parameters<typeof rc.join>[0] | null>(null);
  const [reporting, setReporting] = useState<{ callId: string; name: string } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  // Leaving by accident (close tab, refresh) would drop the other person: ask first
  useEffect(() => {
    if (rc.phase !== "in-call") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [rc.phase]);

  useEffect(() => {
    if (rc.error && rc.error.code !== "MEDIA") toast.error(rc.error.message);
    else if (rc.error) toast.error(rc.error.message);
    if (rc.error) rc.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rc.error]);

  const start = (prefs: Parameters<typeof rc.join>[0]) => {
    setLastPrefs(prefs);
    rc.join(prefs);
  };

  const submitReport = async (reason: ReportReason, details: string) => {
    if (!reporting) return;
    try {
      await callApi.report(reporting.callId, { reason, details: details || undefined });
      toast.success("Thanks. We will review this.");
      setReporting(null);
    } catch {
      toast.error("Could not send the report. Try again.");
    }
  };

  const doBlock = async () => {
    if (!rc.call) return;
    try {
      await callApi.block(rc.call.callId);
      toast.success(`${rc.call.partner.name} is blocked`);
    } catch {
      toast.error("Could not block. Try again.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden font-sans" style={{ background: COLORS.void }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background: `radial-gradient(60% 80% at 15% 0%, color-mix(in srgb, ${COLORS.purple} 12.2%, transparent) 0%, transparent 70%), radial-gradient(50% 70% at 90% 5%, color-mix(in srgb, ${COLORS.spotlight} 8.6%, transparent) 0%, transparent 70%)`,
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {rc.phase !== "in-call" && rc.phase !== "connecting" && (
          <button
            onClick={() => navigate("/voice")}
            className="mb-4 inline-flex items-center gap-1.5 text-sm hover:opacity-80"
            style={{ color: COLORS.textMuted }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voice rooms
          </button>
        )}

        {rc.phase === "loading" && (
          <p className="py-24 text-center text-sm" style={{ color: COLORS.textMuted }} role="status">
            Getting ready...
          </p>
        )}

        {rc.phase === "setup" && (
          <CallSetup
            status={rc.status}
            waiting={rc.waiting}
            connected={rc.connected}
            onStart={start}
            onStatusChange={rc.setStatus}
          />
        )}

        {rc.phase === "searching" && (
          <SearchingScreen
            userName={user?.name || "You"}
            userAvatar={user?.avatarUrl}
            waiting={rc.waiting}
            waitedSeconds={rc.waitedSeconds}
            onCancel={rc.cancel}
          />
        )}

        {rc.phase === "timeout" && (
          <TimeoutScreen
            onRetry={() => lastPrefs && rc.join(lastPrefs)}
            onRooms={() => navigate("/voice")}
            onBack={rc.reset}
          />
        )}

        {(rc.phase === "connecting" || rc.phase === "in-call") && rc.call && (
          <InCallScreen
            call={rc.call}
            userName={user?.name || "You"}
            userAvatar={user?.avatarUrl}
            secondsLeft={rc.secondsLeft}
            card={rc.card}
            deck={rc.deck}
            cardIndex={rc.cardIndex}
            drawing={rc.drawing}
            muted={rc.muted}
            micError={rc.micError}
            meSpeaking={rc.meSpeaking}
            partnerSpeaking={rc.partnerSpeaking}
            talk={rc.talk}
            silent={rc.silent}
            mediaState={rc.mediaState}
            partnerWantsExtend={rc.partnerWantsExtend}
            iWantExtend={rc.iWantExtend}
            justExtended={rc.justExtended}
            onCard={rc.goToCard}
            onDraw={rc.drawCard}
            onMute={rc.toggleMute}
            onExtend={rc.extend}
            onEnd={rc.endCall}
            onReport={() => setReporting({ callId: rc.call!.callId, name: rc.call!.partner.name })}
            onBlock={() => setConfirmBlock(true)}
            extras={{
              reactionFloat: <ReactionFloat reactions={extras.reactions} />,
              captions: (
                <CaptionsPanel
                  supported={extras.captionsSupported}
                  on={extras.captionsOn}
                  error={extras.captionsError}
                  partnerName={rc.call.partner.name}
                  lines={extras.partnerLines}
                  interim={extras.partnerInterim}
                  myCaption={extras.myCaption}
                  saved={savedWords}
                  onToggle={() => extras.setCaptionsOn(!extras.captionsOn)}
                  onSaveWord={saveWord}
                />
              ),
              inbox: (
                <TipsInbox
                  partnerName={rc.call.partner.name}
                  tips={extras.liveTips}
                  onDismiss={extras.dismissTip}
                />
              ),
              reactionBar: <ReactionBar onReact={extras.sendReaction} />,
              composer: (
                <TipComposer
                  partnerName={rc.call.partner.name}
                  sentCount={extras.sentTips}
                  onSend={extras.sendTip}
                />
              ),
            }}
          />
        )}

        {rc.phase === "ended" && rc.ended && (
          <CallRecap
            ended={rc.ended}
            tips={extras.tips.map((t) => t.text)}
            savedWords={extras.savedWords}
            onAgain={() => {
              rc.reset();
            }}
            onLobby={() => navigate("/voice")}
            onReport={() => setReporting({ callId: rc.ended!.callId, name: rc.ended!.partnerName })}
          />
        )}
      </div>

      <ReportDialog
        open={!!reporting}
        partnerName={reporting?.name ?? ""}
        onClose={() => setReporting(null)}
        onSubmit={submitReport}
      />

      <AnimatePresence>
        {confirmBlock && (
          <ConfirmationModal
            isOpen={confirmBlock}
            onClose={() => setConfirmBlock(false)}
            onConfirm={doBlock}
            title={`Block ${rc.call?.partner.name ?? "this person"}?`}
            message="The call ends now and you will never be matched with them again."
            confirmText="Block and end call"
            confirmColor={COLORS.danger}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RandomCallPage;
