// apps/web/src/components/common/ErrorBoundary.tsx
/**
 * Catches a crash in part of the screen and shows a way out, instead of a blank page.
 *   - variant "page": around each page, inside the app frame, so the sidebar keeps working. It resets when
 *     you go to another page (pass the path as `resetKey`).
 *   - variant "app": the last line, around everything, for a crash in the frame itself.
 * A page file that can't be downloaded (offline, or a new version was deployed) gets its own message.
 */

import React from "react";
import { AlertTriangle, Home, RefreshCw, WifiOff } from "lucide-react";
import { isChunkLoadError } from "../../lib/lazyPage";
import { tr } from "../../i18n/core";

interface Props {
  variant: "page" | "app";
  /** Changing it clears the error (the current path, for pages) */
  resetKey?: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept in the console for now; an error tracker (Sentry, for example) would be called from here
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  private retry = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const offline = isChunkLoadError(error);
    const Icon = offline ? WifiOff : AlertTriangle;
    const title = offline ? "This page didn't load" : "Something went wrong here";
    const text = offline
      ? "Check your connection, then try again. If SpeakBetter was just updated, trying again loads the new version."
      : "This part of the app hit a problem. Trying again usually fixes it, and your progress is saved.";

    const body = (
      <div role="alert" className="mx-auto max-w-md px-6 py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
          <Icon aria-hidden className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-900 dark:text-white">{tr(title)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{tr(text)}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button
            type="button"
            onClick={this.retry}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <RefreshCw aria-hidden className="h-4 w-4" /> {" "}{tr("Try again")}</button>
          <a
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <Home aria-hidden className="h-4 w-4" /> {" "}{tr("Go to dashboard")}</a>
        </div>
        {import.meta.env.DEV && !offline && (
          <pre className="mt-6 max-h-40 overflow-auto rounded-xl bg-slate-100 p-3 text-left text-[11px] text-slate-700 dark:bg-white/[0.05] dark:text-slate-300">
            {error.message}
          </pre>
        )}
      </div>
    );

    return this.props.variant === "app" ? <div className="min-h-dvh bg-page flex items-center">{body}</div> : body;
  }
}

/** Shown while a page's file downloads; appears only after a short wait, so fast loads don't flash it */
export const PageLoading: React.FC = () => (
  <div role="status" aria-label={tr("Loading page")} className="sb-page-loading flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-indigo-400" />
  </div>
);
