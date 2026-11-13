import React, { useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { usePushDevice } from "../../hooks/usePush";
import { tr } from "../../i18n/core";

const KEY = "sb.alertsBanner.dismissed";

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * A one-time nudge on the dashboard to turn on practice reminders. Only shows when this browser can do push,
 * the server has it set up and the person has not decided yet.
 */
export const EnableAlertsBanner: React.FC = () => {
  const push = usePushDevice();
  const [hidden, setHidden] = useState(wasDismissed);

  const show = !hidden && push.supported && !!push.config?.enabled && push.permission === "default" && !push.subscribed;
  if (!show) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* it just shows again next time */
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-indigo-200/70 bg-indigo-50/70 p-4 sm:flex-row sm:items-center dark:border-indigo-500/20 dark:bg-indigo-500/10" role="region" aria-label={tr("Turn on reminders")}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-white">{tr("Never miss a day")}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{tr("Get a reminder at your chosen time if you haven't practised yet. You can turn it off any time.")}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await push.enable()) dismiss();
          }}
          disabled={push.busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {push.busy && <Loader2 className="h-4 w-4 animate-spin" />} {" "}{tr("Turn on reminders")}</button>
        <button type="button" onClick={dismiss} aria-label={tr("Not now")} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white/60 hover:text-slate-700 dark:hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default EnableAlertsBanner;
