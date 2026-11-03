import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api/client';

export type BillingInterval = 'MONTHLY' | 'YEARLY';

export interface PlanLimits {
  aiTurnsPerDay: number;
}

export interface BillingCatalog {
  currency: string;
  /** True while payments are a test: nothing is charged */
  sandbox: boolean;
  paymentsAvailable: boolean;
  yearlySavingsPercent: number;
  plans: Array<{
    id: 'FREE' | 'PRO';
    name: string;
    limits: PlanLimits;
    prices: Record<BillingInterval, number> | null;
  }>;
}

export interface MySubscription {
  plan: 'FREE' | 'PRO';
  /** FREE (never subscribed), ACTIVE, CANCELLED (works until the end date) or EXPIRED (ran out) */
  status: 'FREE' | 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
  interval: BillingInterval | null;
  endDate: string | null;
  daysLeft: number;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
}

export interface PaymentRow {
  id: string;
  plan: 'FREE' | 'PRO' | null;
  interval: BillingInterval | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  days: number | null;
  createdAt: string;
}

export interface CheckoutDetails extends PaymentRow {
  sandbox: boolean;
  expired: boolean;
}

export type SandboxOutcome = 'success' | 'fail' | 'cancel';

export const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

export const useBillingCatalog = () =>
  useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => (await apiClient.get<BillingCatalog>('/billing/plans')).data,
    staleTime: 5 * 60_000,
  });

export const useMySubscription = () =>
  useQuery({
    queryKey: ['billing-me'],
    queryFn: async () => (await apiClient.get<MySubscription>('/billing/me')).data,
    staleTime: 30_000,
  });

export const usePayments = () =>
  useQuery({
    queryKey: ['billing-payments'],
    queryFn: async () => (await apiClient.get<PaymentRow[]>('/billing/payments')).data,
    staleTime: 30_000,
  });

export const useCheckoutDetails = (id: string | undefined) =>
  useQuery({
    queryKey: ['billing-checkout', id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<CheckoutDetails>(`/billing/checkout/${id}`)).data,
    retry: false,
  });

/** Anything that changes the plan changes what the AI partner allows too */
const useRefreshBilling = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['billing-me'] });
    queryClient.invalidateQueries({ queryKey: ['billing-payments'] });
    queryClient.invalidateQueries({ queryKey: ['ai-tutor-status'] });
  };
};

export const useStartCheckout = () =>
  useMutation({
    mutationFn: async (input: { interval: BillingInterval }) =>
      (await apiClient.post<{ paymentId: string; checkoutUrl: string }>('/billing/checkout', { plan: 'PRO', ...input })).data,
  });

export const useSettleSandbox = (paymentId: string) => {
  const refresh = useRefreshBilling();
  return useMutation({
    mutationFn: async (outcome: SandboxOutcome) =>
      (await apiClient.post<{ status: string; subscription: MySubscription }>(`/billing/checkout/${paymentId}/sandbox`, { outcome })).data,
    onSuccess: refresh,
  });
};

export const useCancelSubscription = () => {
  const refresh = useRefreshBilling();
  return useMutation({
    mutationFn: async () => (await apiClient.post<MySubscription>('/billing/cancel')).data,
    onSuccess: refresh,
  });
};

export const useResumeSubscription = () => {
  const refresh = useRefreshBilling();
  return useMutation({
    mutationFn: async () => (await apiClient.post<MySubscription>('/billing/resume')).data,
    onSuccess: refresh,
  });
};
