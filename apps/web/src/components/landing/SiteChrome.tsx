// apps/web/src/components/landing/SiteChrome.tsx
// The top bar and footer of the public pages (landing, Terms, Privacy).

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "../common/SpeakBetterLogo";
import { LEGAL } from "../../lib/legal";
import { tr } from "../../i18n/core";

export const SiteNav: React.FC<{ sections?: boolean }> = ({ sections = false }) => (
  <header className="sticky top-0 z-40 border-b border-line/70 bg-page/85 backdrop-blur-md">
    <nav aria-label={tr("Main")} className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <LogoMark size={32} animated={false} />
        <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">{tr("SpeakBetter")}</span>
      </Link>
      {sections && (
        <div className="hidden items-center gap-1 md:flex">
          {[
            ["#features", "Features"],
            ["#how", "How it works"],
            ["#safety", "Safety"],
            ["#faq", "Questions"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
              {tr(label)}
            </a>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Link to="/login" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-900/[0.05] sm:inline-flex dark:text-slate-200 dark:hover:bg-white/[0.06]">
          {tr("Sign in")}</Link>
        <Link
          to="/register"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {tr("Start free")}{" "}<ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
    </nav>
  </header>
);

export const SiteFooter: React.FC = () => (
  <footer className="border-t border-line bg-surface">
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <div className="max-w-xs">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark size={28} animated={false} />
          <span className="font-bold text-slate-900 dark:text-white">{tr("SpeakBetter")}</span>
        </Link>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{tr("Practise English out loud, every day, with people learning just like you.")}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
        <p className="t-eyebrow col-span-2 mb-1 text-slate-500 sm:col-span-1">{tr("Product")}</p>
        <p className="t-eyebrow hidden mb-1 text-slate-500 sm:block">{tr("About")}</p>
        <Link to="/register" className="text-slate-700 hover:underline dark:text-slate-300">{tr("Create an account")}</Link>
        <Link to="/terms" className="text-slate-700 hover:underline dark:text-slate-300">{tr("Terms of use")}</Link>
        <Link to="/login" className="text-slate-700 hover:underline dark:text-slate-300">{tr("Sign in")}</Link>
        <Link to="/privacy" className="text-slate-700 hover:underline dark:text-slate-300">{tr("Privacy")}</Link>
        {LEGAL.contactEmail && (
          <a href={`mailto:${LEGAL.contactEmail}`} className="col-start-2 text-slate-700 hover:underline dark:text-slate-300">
            {tr("Contact")}</a>
        )}
      </div>
    </div>
    <p className="border-t border-line px-4 py-4 text-center text-xs text-slate-500">
      © {new Date().getFullYear()} {LEGAL.operator === "the SpeakBetter team" ? tr("SpeakBetter") : LEGAL.operator}
    </p>
  </footer>
);
