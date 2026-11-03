// apps/web/src/pages/CheckoutPage.tsx
/**
 * Test checkout for the sandbox payment provider. It stands in for a payment provider's page: the learner
 * sees what they are buying and picks whether the payment succeeds, fails or is cancelled. Nothing is
 * charged and no card is asked for. A real provider replaces this page with its own hosted checkout.
 */

import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { formatMoney, useCheckoutDetails, useSettleSandbox, type SandboxOutcome } from "../hooks/useBilling";
import { tutorErrorMessage } from "../hooks/useAiTutor";

const card =
  "rounded-3xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

const Settle: React.FC<{ paymentId: string }> = ({ paymentId }) => {
  const navigate = useNavigate();
  const settle = useSettleSandbox(paymentId);

  const choose = async (outcome: SandboxOutcome) => {
    try {
      const res = await settle.mutateAsync(outcome);
      if (res.status === "SUCCEEDED") {
        toast.success("You're on Pro now. Enjoy!");
        navigate("/premium", { replace: true });
      } else if (res.status === "FAILED") {
        toast.error("The test payment failed. You were not charged.");
        navigate("/premium", { replace: true });
      } else {
        navigate("/premium", { replace: true });
      }
    } catch (error) {
      toast.error(tutorErrorMessage(error, "Something went wrong. Please try again."));
    }
  };

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => choose("success")}
        disabled={settle.isPending}
        className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        {settle.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
        Pay (test payment succeeds)
      </button>
      <button
        type="button"
        onClick={() => choose("fail")}
        disabled={settle.isPending}
        className="w-full h-11 rounded-2xl border border-rose-200 dark:border-rose-400/20 text-rose-600 dark:text-rose-300 text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <XCircle className="w-4 h-4" />
        Make the payment fail
      </button>
      <button
        type="button"
        onClick={() => choose("cancel")}
        disabled={settle.isPending}
        className="w-full h-11 rounded-2xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
};

export const CheckoutPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const checkout = useCheckoutDetails(paymentId);

  const back = (
    <Link to="/premium" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
      <ArrowLeft className="w-4 h-4" /> Back to plans
    </Link>
  );

  if (checkout.isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const data = checkout.data;
  if (!data) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-slate-600 dark:text-slate-300">We couldn't find that checkout.</p>
        {back}
      </div>
    );
  }

  const open = data.status === "PENDING" && !data.expired;

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-10 space-y-5">
      {back}
      <div className={`${card} p-6 space-y-5`}>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Checkout</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            SpeakBetter Pro, {data.interval === "YEARLY" ? "yearly" : "monthly"} ({data.days} days)
          </p>
        </div>

        <div className="flex items-baseline justify-between border-y border-slate-100 dark:border-white/[0.06] py-4">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total</span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatMoney(data.amount, data.currency)}</span>
        </div>

        {data.sandbox && (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <FlaskConical className="w-4 h-4 mt-0.5 shrink-0" />
            <p>This is a test checkout. No card is needed and nothing is charged.</p>
          </div>
        )}

        {open ? (
          <Settle paymentId={data.id} />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
            {data.expired
              ? "This checkout expired. Go back and start again."
              : data.status === "SUCCEEDED"
                ? "This payment is already done."
                : "This checkout is closed."}
          </p>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;
