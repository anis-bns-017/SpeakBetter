// apps/web/src/components/common/ReconnectScreen.tsx
/**
 * Shown when the app starts but the SpeakBetter server doesn't answer (it is restarting, or the connection
 * dropped). The person stays signed in; the app keeps trying and carries on by itself once the server is back.
 */

import React from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { bn } from "../../i18n/bn";

/** The language provider isn't running yet here (it sits inside the signed-in app), so read the saved choice */
const tr = (text: string) => {
  try {
    return localStorage.getItem("sb.lang") === "bn" ? (bn[text] ?? text) : text;
  } catch {
    return text;
  }
};

export const ReconnectScreen: React.FC<{ checking: boolean; onRetry: () => void }> = ({ checking, onRetry }) => {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  return (
    <div className="sb-page-loading flex min-h-dvh items-center justify-center bg-page px-6">
      <div role="status" aria-live="polite" className="max-w-sm text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200">
          <WifiOff aria-hidden className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{tr("Reconnecting to SpeakBetter…")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {offline
            ? tr("You seem to be offline. You're still signed in, and we'll carry on as soon as you're back online.")
            : tr("The server isn't answering right now. You're still signed in, and we'll carry on as soon as it's back.")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={checking}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <RefreshCw aria-hidden className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? tr("Checking…") : tr("Try now")}
        </button>
      </div>
    </div>
  );
};

export default ReconnectScreen;
