// apps/web/src/pages/PremiumPage.tsx
/**
 * Premium: what Pro adds, the price, and the subscription itself (days left, cancel, payment history).
 * Free keeps every learning feature; Pro mainly raises the daily limit on the AI speaking partner, the one
 * feature that costs money to run. While payments are in test mode a banner says so and nothing is charged.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bot, Check, Crown, FlaskConical, Loader2, Sparkles } from "lucide-react";
import {
  formatMoney,
  useBillingCatalog,
  useCancelSubscription,
  useMySubscription,
  usePayments,
  useResumeSubscription,
  useStartCheckout,
  type BillingInterval,
  type MySubscription,
  type PaymentRow,
} from "../hooks/useBilling";
import { tutorErrorMessage } from "../hooks/useAiTutor";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

const FREE_FEATURES = [
  "Voice rooms, random calls, chat and communities",
  "Flashcards with spaced repetition, vocabulary, grammar and exercises",
  "Pronunciation practice, level test and daily plan",
  "Tap-to-translate everywhere",
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

const STATUS_STYLE: Record<PaymentRow["status"], string> = {
  SUCCEEDED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  PROCESSING: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  FAILED: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300",
  REFUNDED: "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300",
  PARTIALLY_REFUNDED: "bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300",
};

const Feature: React.FC<{ children: React.ReactNode; strong?: boolean }> = ({ children, strong }) => (
  <li className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300">
    <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
    <span className={strong ? "font-semibold text-slate-900 dark:text-white" : undefined}>{children}</span>
  </li>
);

const SubscriptionCard: React.FC<{ sub: MySubscription }> = ({ sub }) => {
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const busy = cancel.isPending || resume.isPending;

  const run = async (action: "cancel" | "resume") => {
    try {
      await (action === "cancel" ? cancel : resume).mutateAsync();
      toast.success(action === "cancel" ? "Renewal switched off. Pro stays until the end date." : "Welcome back, Pro will carry on.");
    } catch (error) {
      toast.error(tutorErrorMessage(error, "Something went wrong. Please try again."));
    }
  };

  return (
    <div className={`${card} p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4`}>
      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/80 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/25 flex items-center justify-center shrink-0">
        <Crown className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 dark:text-white">
          You're on Pro {sub.interval === "YEARLY" ? "(yearly)" : "(monthly)"}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {sub.cancelAtPeriodEnd
            ? `Won't renew. Pro works until ${formatDate(sub.endDate)} (${sub.daysLeft} ${sub.daysLeft === 1 ? "day" : "days"} left).`
            : `Paid up until ${formatDate(sub.endDate)} (${sub.daysLeft} ${sub.daysLeft === 1 ? "day" : "days"} left).`}
        </p>
      </div>
      {sub.cancelAtPeriodEnd ? (
        <button
          type="button"
          onClick={() => run("resume")}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold"
        >
          Keep Pro
        </button>
      ) : (
        <button
          type="button"
          onClick={() => run("cancel")}
          disabled={busy}
          className="h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-50"
        >
          Cancel renewal
        </button>
      )}
    </div>
  );
};

export const PremiumPage: React.FC = () => {
  const navigate = useNavigate();
  const catalog = useBillingCatalog();
  const mine = useMySubscription();
  const payments = usePayments();
  const startCheckout = useStartCheckout();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");

  if (catalog.isLoading || mine.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (!catalog.data || !mine.data) {
    return <p className="text-center text-slate-500 py-32">Couldn't load plans. Please refresh.</p>;
  }

  const { data: plans } = catalog;
  const sub = mine.data;
  const free = plans.plans.find((p) => p.id === "FREE")!;
  const pro = plans.plans.find((p) => p.id === "PRO")!;
  const price = pro.prices![interval];
  const isPro = sub.plan === "PRO";
  const monthlyEquivalent = interval === "YEARLY" ? pro.prices!.YEARLY / 12 : pro.prices!.MONTHLY;

  const buy = async () => {
    try {
      const { checkoutUrl } = await startCheckout.mutateAsync({ interval });
      navigate(checkoutUrl);
    } catch (error) {
      toast.error(tutorErrorMessage(error, "Couldn't start checkout. Please try again."));
    }
  };

  const history = (payments.data ?? []).filter((p) => p.status !== "PENDING");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-6">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/15">
          <Crown className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-5">SpeakBetter Pro</h1>
        <p className="text-slate-600 dark:text-slate-300 mt-2 max-w-xl mx-auto">
          Everything you use to learn stays free. Pro gives you far more time with your AI speaking partner, the one feature that costs us money to run.
        </p>
      </div>

      {plans.sandbox && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-400/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <FlaskConical className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Payments are in test mode. Nothing is charged, and you choose whether the test payment works.</p>
        </div>
      )}

      {isPro && <SubscriptionCard sub={sub} />}
      {sub.status === "EXPIRED" && (
        <div className={`${card} px-5 py-4 text-sm text-slate-600 dark:text-slate-300`}>
          Your Pro ended on {formatDate(sub.endDate)}. Pick a plan below to come back.
        </div>
      )}

      <div className="flex justify-center">
        <div className="inline-flex p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05]" role="tablist" aria-label="Billing period">
          {(["MONTHLY", "YEARLY"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={interval === value}
              onClick={() => setInterval(value)}
              className={`h-9 px-4 rounded-xl text-sm font-medium transition-colors ${
                interval === value
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {value === "MONTHLY" ? "Monthly" : "Yearly"}
              {value === "YEARLY" && <span className="ml-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">Save {plans.yearlySavingsPercent}%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className={`${card} p-6 flex flex-col`}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Free</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{formatMoney(0, plans.currency)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">forever</p>
          <ul className="mt-5 space-y-2.5 flex-1">
            <Feature strong>
              <Bot className="inline w-4 h-4 mr-1 -mt-0.5" />
              {free.limits.aiTurnsPerDay} AI partner turns a day
            </Feature>
            {FREE_FEATURES.map((f) => (
              <Feature key={f}>{f}</Feature>
            ))}
          </ul>
          <div className="mt-6 h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.05] text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center">
            {isPro ? "Included" : "Your plan"}
          </div>
        </div>

        <div className={`${card} p-6 flex flex-col ring-2 ring-indigo-500/70 relative`}>
          <span className="absolute -top-3 right-5 px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-semibold">Best for speaking</span>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pro</h2>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {formatMoney(price, plans.currency)}
            <span className="text-base font-medium text-slate-500 dark:text-slate-400"> / {interval === "YEARLY" ? "year" : "month"}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {interval === "YEARLY" ? `About ${formatMoney(monthlyEquivalent, plans.currency)} a month` : "Billed every 30 days"}
          </p>
          <ul className="mt-5 space-y-2.5 flex-1">
            <Feature strong>
              <Bot className="inline w-4 h-4 mr-1 -mt-0.5" />
              {pro.limits.aiTurnsPerDay} AI partner turns a day
            </Feature>
            <Feature>Everything in Free</Feature>
            <Feature>Room to practise a real conversation every day</Feature>
          </ul>
          <button
            type="button"
            onClick={buy}
            disabled={startCheckout.isPending || !plans.paymentsAvailable}
            className="mt-6 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {startCheckout.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {!plans.paymentsAvailable ? "Not available yet" : isPro ? "Add more time" : "Go Pro"}
          </button>
          {isPro && <p className="text-xs text-slate-400 text-center mt-2">New time is added on top of what you have left.</p>}
        </div>
      </div>

      {history.length > 0 && (
        <div className={`${card} p-5 sm:p-6`}>
          <h2 className="font-semibold text-slate-900 dark:text-white">Payment history</h2>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {history.map((p) => (
              <li key={p.id} className="py-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">
                    Pro, {p.interval === "YEARLY" ? "yearly" : "monthly"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(p.createdAt)}</p>
                </div>
                <span className="font-medium text-slate-700 dark:text-slate-200">{formatMoney(p.amount, p.currency)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[p.status]}`}>
                  {p.status === "SUCCEEDED" ? "Paid" : p.status.charAt(0) + p.status.slice(1).toLowerCase().replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PremiumPage;
