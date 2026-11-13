// apps/web/src/hooks/useAdmin.ts
// Everything the admin section reads and changes (server: src/admin). Queries share the "admin" key prefix, so
// one action can refresh every admin screen that might show it.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/api/client";

export type StaffRole = "MODERATOR" | "ADMIN";
export type PlatformRole = "USER" | StaffRole;

export interface AdminMe {
  id: string;
  name: string;
  role: PlatformRole;
  permissions: string[];
}

export interface Person {
  id: string;
  name: string;
  avatarUrl: string | null;
  email?: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

export interface Overview {
  users: { total: number; newToday: number; new7: number; new30: number; suspended: number; staff: number };
  active: { today: number; week: number; month: number };
  rooms: { live: number; people: number };
  communities: { total: number; hidden: number };
  pro: { active: number; revenue30: number };
  reports: { open: number; app: number; randomCall: number };
  signups: Array<{ day: string; value: number }>;
  learners: Array<{ day: string; value: number }>;
  features: Array<{ reason: string; name: string; actions: number; xp: number }>;
  latestUsers: Array<Person & { email: string; createdAt: string }>;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: PlatformRole;
  createdAt: string;
  lastActive: string | null;
  xp: number;
  level: string | null;
  country: string | null;
  signIn: "google" | "password";
  plan: "FREE" | "PRO";
  suspended: boolean;
  suspendedUntil: string | null;
  reportsAgainst: number;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: PlatformRole;
  createdAt: string;
  googleId: string | null;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  signIn: "google" | "password";
  suspended: boolean;
  permanent: boolean;
  profile: { level: string | null; xp: number; country: string | null; nativeLanguage: string | null; lastActive: string } | null;
  plan: "FREE" | "PRO";
  subscription: { plan: string; status: string; endDate: string | null; provider: string | null } | null;
  randomCall: { restrictedUntil: string | null; permanentlyBanned: boolean; restrictionCount: number; restrictionReason: string | null } | null;
  stats: { xpTotal: number; xp30: number; messages: number; rooms: number; flashcards: number; friends: number; reportsMade: number };
  sessions: Array<{ id: string; createdAt: string; lastUsedAt: string | null; ip: string | null; userAgent: string | null; expiresAt: string }>;
  reportsAgainst: Array<{ id: string; source: "app" | "random-call"; reason: string; details: string | null; status: string; createdAt: string; reporter: Person }>;
  payments: Array<{ id: string; amount: number; currency: string; status: string; createdAt: string }>;
  history: AuditEntry[];
}

export interface ReportItem {
  key: string;
  source: "app" | "random-call";
  id: string;
  reason: string;
  details: string | null;
  status: string;
  open: boolean;
  createdAt: string;
  reporter: Person | null;
  subject: Person | null;
  targetType: string;
  targetId: string;
  content: string | null;
  contentDeleted: boolean;
  where: string | null;
  resolution: string | null;
}

export interface ReportCounts {
  open: number;
  app: number;
  randomCall: number;
}

export interface RoomRow {
  id: string;
  name: string;
  status: string;
  language: string | null;
  topics: string[];
  maxParticipants: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  creator: Person;
  inRoom: number;
  messages: number;
}

export interface CommunityRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  avatarUrl: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  owner: Person;
  members: number;
  messages: number;
  channels: number;
}

export type Audience = "all" | "active7" | "active30" | "pro" | "free" | "staff";

export interface Billing {
  totals: {
    activePro: number;
    byProvider: Array<{ provider: string; count: number }>;
    revenueAll: number;
    paymentsAll: number;
    revenue30: number;
    payments30: number;
    failed30: number;
  };
  payments: Paged<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    plan: string | null;
    interval: string | null;
    createdAt: string;
    user: Person & { email: string };
  }>;
  subscriptions: Array<{
    id: string;
    plan: string;
    status: string;
    interval: string | null;
    provider: string | null;
    startDate: string;
    endDate: string | null;
    cancelAtPeriodEnd: boolean;
    user: Person & { email: string };
  }>;
}

export interface SystemInfo {
  checks: Array<{ name: string; ok: boolean | null; ms: number | null; note: string }>;
  settings: Array<{ key: string; what: string; set: boolean }>;
  server: { environment: string; node: string; uptimeSeconds: number; memoryMb: number; heapMb: number };
  tables: Record<string, number>;
}

const get = async <T>(url: string, params?: Record<string, unknown>) => (await apiClient.get<T>(url, { params })).data;
const clean = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null));

export const useAdminMe = () =>
  useQuery({ queryKey: ["admin", "me"], queryFn: () => get<AdminMe>("/admin/me"), retry: false, staleTime: 60_000 });

export const useAdminOverview = () =>
  useQuery({ queryKey: ["admin", "overview"], queryFn: () => get<Overview>("/admin/overview"), refetchInterval: 60_000 });

export const useAdminUsers = (params: { q?: string; status?: string; role?: string; sort?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => get<Paged<AdminUserRow>>("/admin/users", clean(params)),
    placeholderData: keepPreviousData,
  });

export const useAdminUser = (id: string) =>
  useQuery({ queryKey: ["admin", "user", id], queryFn: () => get<AdminUser>(`/admin/users/${id}`), enabled: !!id });

export const useAdminReports = (params: { state?: string; source?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "reports", params],
    queryFn: () => get<Paged<ReportItem> & { counts: ReportCounts }>("/admin/reports", clean(params)),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

export const useAdminRooms = (params: { state?: string; q?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "rooms", params],
    queryFn: () => get<Paged<RoomRow> & { openRoomReports: number }>("/admin/rooms", clean(params)),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

export const useAdminCommunities = (params: { state?: string; q?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "communities", params],
    queryFn: () => get<Paged<CommunityRow>>("/admin/communities", clean(params)),
    placeholderData: keepPreviousData,
  });

export const useAdminBilling = (page: number) =>
  useQuery({ queryKey: ["admin", "billing", page], queryFn: () => get<Billing>("/admin/billing", { page }), placeholderData: keepPreviousData });

export const useAdminBroadcastInfo = () =>
  useQuery({
    queryKey: ["admin", "broadcast"],
    queryFn: () => get<{ audiences: Record<Audience, number>; history: AuditEntry[] }>("/admin/broadcast"),
  });

export const useAdminSystem = () =>
  useQuery({ queryKey: ["admin", "system"], queryFn: () => get<SystemInfo>("/admin/system"), refetchInterval: 30_000 });

export const useAdminAudit = (params: { action?: string; q?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "audit", params],
    queryFn: () => get<Paged<AuditEntry> & { actions: Array<{ action: string; count: number }> }>("/admin/audit", clean(params)),
    placeholderData: keepPreviousData,
  });

/** Any admin action; refreshes every admin screen when it succeeds */
export const useAdminAction = <V,>(request: (vars: V) => Promise<unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });
};

export const adminApi = {
  warn: (id: string, message: string) => apiClient.post(`/admin/users/${id}/warn`, { message }),
  suspend: (id: string, body: { days?: number; permanent?: boolean; reason: string }) => apiClient.post(`/admin/users/${id}/suspend`, body),
  unsuspend: (id: string, note?: string) => apiClient.post(`/admin/users/${id}/unsuspend`, note ? { note } : {}),
  signOut: (id: string) => apiClient.post(`/admin/users/${id}/sign-out`),
  setRole: (id: string, role: PlatformRole) => apiClient.put(`/admin/users/${id}/role`, { role }),
  grantPro: (id: string, days: number, note?: string) => apiClient.post(`/admin/users/${id}/pro`, note ? { days, note } : { days }),
  deleteUser: (id: string, confirmEmail: string, reason: string) => apiClient.delete(`/admin/users/${id}`, { data: { confirmEmail, reason } }),
  resolveReport: (
    source: string,
    id: string,
    body: { decision: "dismiss" | "action"; note?: string; warn?: string; suspendDays?: number; permanent?: boolean; deleteContent?: boolean },
  ) => apiClient.post(`/admin/reports/${source}/${id}/resolve`, body),
  closeRoom: (id: string, reason: string) => apiClient.post(`/admin/rooms/${id}/close`, { reason }),
  hideCommunity: (id: string, hidden: boolean, reason?: string) => apiClient.put(`/admin/communities/${id}/hidden`, reason ? { hidden, reason } : { hidden }),
  deleteMessage: (kind: string, id: string, reason: string) => apiClient.delete(`/admin/messages/${kind}/${id}`, { data: { reason } }),
  broadcast: (body: { title: string; message: string; link?: string; audience: Audience }) =>
    apiClient.post<{ recipients: number; sent: number }>("/admin/broadcast", body),
};

/** The server's message for a failed request */
export const adminError = (error: unknown, fallback = "That didn't work. Try again."): string => {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  const message = Array.isArray(data?.message) ? data?.message[0] : data?.message;
  return typeof message === "string" ? message : fallback;
};
