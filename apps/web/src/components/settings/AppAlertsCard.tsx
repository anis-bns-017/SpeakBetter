import React, { useState } from "react";
import { toast } from "sonner";
import { BellRing, CheckCircle2, CloudDownload, Download, Loader2, Send, Share, Smartphone } from "lucide-react";
import { lastSavedAt, offlineReady, saveForOffline } from "../../lib/offline";
import { useInstall, usePushDevice } from "../../hooks/usePush";
import { isStandalone } from "../../lib/pwa";

const button =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors disabled:opacity-60";
const primary = `${button} bg-indigo-600 text-white hover:bg-indigo-700`;
const quiet = `${button} border border-slate-200 text-slate-700 hover:bg-slate-50`;

const Row: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ icon: Icon, title, children, action }) => (
  <div className="rounded-2xl border border-slate-200 p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <div className="mt-1 text-sm leading-5 text-slate-500">{children}</div>
        </div>
      </div>
      {action && <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div>}
    </div>
  </div>
);

/** Save every story, lesson and word pack on this device, so they open without a connection */
const OfflineRow: React.FC = () => {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(lastSavedAt());
  const ready = offlineReady();

  const save = async () => {
    try {
      const n = await saveForOffline((done, total) => setProgress({ done, total }));
      setSavedAt(lastSavedAt());
      toast.success(`Saved ${n} lessons, stories and packs for offline use`);
    } catch {
      toast.error("Couldn't save everything. Check your connection and try again.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <Row
      icon={CloudDownload}
      title="Use SpeakBetter offline"
      action={
        ready ? (
          <button type="button" className={quiet} onClick={() => void save()} disabled={!!progress}>
            {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
            {progress ? `${progress.done}/${progress.total}` : savedAt ? "Update" : "Save for offline"}
          </button>
        ) : undefined
      }
    >
      {ready
        ? savedAt
          ? `Lessons, stories and word packs are saved on this device (last updated ${savedAt.toLocaleDateString()}). Things you open are also kept automatically.`
          : "Save every story, grammar lesson and word pack on this device, so you can study on the bus or a plane. Things you open are also kept automatically."
        : "Offline use needs the app to finish setting up in this browser. Reload the page, or install the app, and it will be ready."}
    </Row>
  );
};

/** Install SpeakBetter on the home screen, and get practice reminders on this device */
export const AppAlertsCard: React.FC = () => {
  const install = useInstall();
  const push = usePushDevice();

  const installRow = install.installed ? (
    <Row icon={Smartphone} title="SpeakBetter app" action={<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Installed</span>}>
      You're using SpeakBetter as an app on this device.
    </Row>
  ) : install.canPrompt ? (
    <Row
      icon={Smartphone}
      title="Install SpeakBetter"
      action={
        <button type="button" className={primary} onClick={() => void install.install()}>
          <Download className="h-4 w-4" /> Install app
        </button>
      }
    >
      Open it from your home screen or desktop like any other app, full screen and quick to start.
    </Row>
  ) : install.ios ? (
    <Row icon={Smartphone} title="Add SpeakBetter to your home screen">
      In Safari, tap <Share className="mx-0.5 inline h-4 w-4 align-text-bottom" /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Notifications on iPhone only work from the home screen app.
    </Row>
  ) : (
    <Row icon={Smartphone} title="Install SpeakBetter">
      Use your browser's menu and choose <strong>Install app</strong> (or <strong>Add to Home screen</strong> on a phone).
    </Row>
  );

  let alertsRow: React.ReactNode;
  if (push.loadingConfig) {
    alertsRow = (
      <Row icon={BellRing} title="Alerts on this device">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Row>
    );
  } else if (!push.config?.enabled) {
    alertsRow = (
      <Row icon={BellRing} title="Alerts on this device">
        Phone and browser alerts aren't set up on this server yet.
      </Row>
    );
  } else if (!push.supported) {
    alertsRow = (
      <Row icon={BellRing} title="Alerts on this device">
        {install.ios && !isStandalone()
          ? "On iPhone and iPad, add SpeakBetter to your home screen first, then come back here to turn alerts on."
          : "This browser can't show alerts from websites. Try Chrome, Edge, Firefox or Safari."}
      </Row>
    );
  } else if (push.permission === "denied") {
    alertsRow = (
      <Row icon={BellRing} title="Alerts on this device">
        Notifications are blocked for this site. Allow them in your browser's site settings (the lock icon next to the address), then reload this page.
      </Row>
    );
  } else if (push.subscribed) {
    alertsRow = (
      <Row
        icon={BellRing}
        title="Alerts are on for this device"
        action={
          <>
            <button type="button" className={quiet} onClick={() => push.test.mutate()} disabled={push.test.isPending}>
              {push.test.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send a test
            </button>
            <button type="button" className={quiet} onClick={() => void push.disable()} disabled={push.busy}>
              Turn off
            </button>
          </>
        }
      >
        You'll get your daily practice reminder, and alerts for live rooms and replies, even when SpeakBetter is closed. Set the reminder time below.
      </Row>
    );
  } else {
    alertsRow = (
      <Row
        icon={BellRing}
        title="Get alerts on this device"
        action={
          <button type="button" className={primary} onClick={() => void push.enable()} disabled={push.busy}>
            {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Turn on alerts
          </button>
        }
      >
        A reminder at your chosen time if you haven't practised, plus live rooms and replies, even when SpeakBetter is closed.
      </Row>
    );
  }

  return (
    <div className="space-y-3">
      {installRow}
      {alertsRow}
      <OfflineRow />
    </div>
  );
};

export default AppAlertsCard;
