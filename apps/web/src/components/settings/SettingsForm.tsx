import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Check,
  ChevronDown,
  Languages,
  MessageCircle,
  Palette,
  RotateCcw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Volume2,
  Eye,
  EyeOff,
  Clock3,
  UserRound,
  Users,
  Zap,
  CalendarClock,
  Radio,
  UserPlus,
  Wand2,
} from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { useTheme } from "../../contexts/ThemeContext";
import { ThemeCards } from "../theme/ThemePicker";
import { useChooseTheme } from "../../hooks/useChooseTheme";
import { AppAlertsCard } from "./AppAlertsCard";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  type NotificationPreferences,
} from "../../hooks/useNotifications";
import { tr, msg } from "../../i18n/core";

/**
 * SettingsForm
 *
 * This component is intentionally aligned with the Prisma Settings model.
 *
 * Prisma fields currently supported by the project:
 * - theme
 * - language
 * - emailNotifications
 * - pushNotifications
 * - soundEffects
 * - dailyReminderEnabled
 * - dailyReminderTime
 * - shareActivityWithFriends
 * - showOnlineStatus
 * - showProfilePublic
 * - allowFriendRequests
 * - allowDirectMessages
 * - autoTranslateMessages
 *
 * The old component only exposed a small subset of these fields and also used
 * a mock useSettings hook. This version uses the real application hook and
 * provides a complete, production-style settings experience.
 */

type ThemeValue = "light" | "dark" | "navy" | "system";

interface Settings {
  id?: string;
  userId?: string;

  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEffects: boolean;

  theme: ThemeValue | string;
  language: string;

  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string | null;

  shareActivityWithFriends: boolean;
  showOnlineStatus: boolean;
  showProfilePublic?: boolean;
  allowFriendRequests?: boolean;
  allowDirectMessages?: boolean;
  autoTranslateMessages?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

interface SettingsFormProps {
  settings: Settings;
}

interface FormData {
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEffects: boolean;
  theme: ThemeValue;
  language: string;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  shareActivityWithFriends: boolean;
  showOnlineStatus: boolean;
  showProfilePublic: boolean;
  allowFriendRequests: boolean;
  allowDirectMessages: boolean;
  autoTranslateMessages: boolean;
}

const REMINDER_TIMES = [
  "06:00",
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "12:00",
  "14:00",
  "16:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

const normalizeTheme = (theme?: string): ThemeValue => {
  const value = String(theme ?? "system").toLowerCase();

  if (value === "light") return "light";
  if (value === "dark") return "dark";
  if (value === "navy") return "navy";
  return "system";
};

const buildFormData = (settings: Settings): FormData => ({
  emailNotifications: Boolean(settings.emailNotifications),
  pushNotifications: Boolean(settings.pushNotifications),
  soundEffects: Boolean(settings.soundEffects),
  theme: normalizeTheme(settings.theme),
  language: settings.language || "en",

  dailyReminderEnabled:
    settings.dailyReminderEnabled === undefined
      ? true
      : Boolean(settings.dailyReminderEnabled),

  dailyReminderTime: settings.dailyReminderTime || "20:00",

  shareActivityWithFriends:
    settings.shareActivityWithFriends === undefined
      ? true
      : Boolean(settings.shareActivityWithFriends),

  showOnlineStatus:
    settings.showOnlineStatus === undefined
      ? true
      : Boolean(settings.showOnlineStatus),

  showProfilePublic:
    settings.showProfilePublic === undefined
      ? true
      : Boolean(settings.showProfilePublic),

  allowFriendRequests:
    settings.allowFriendRequests === undefined
      ? true
      : Boolean(settings.allowFriendRequests),

  allowDirectMessages:
    settings.allowDirectMessages === undefined
      ? true
      : Boolean(settings.allowDirectMessages),

  autoTranslateMessages:
    settings.autoTranslateMessages === undefined
      ? false
      : Boolean(settings.autoTranslateMessages),
});

const formatTime = (time: string) => {
  if (!time) return "Not set";

  const [hours, minutes] = time.split(":").map(Number);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};

const Toggle = ({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={tr(label)}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? "bg-indigo-600" : "bg-slate-300"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

const SettingRow = ({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => (
  <div
    className={`flex items-center justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-4 transition-colors ${
      disabled ? "opacity-60" : "hover:border-slate-300"
    }`}
  >
    <div className="flex min-w-0 items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <Icon size={19} strokeWidth={2} />
      </div>

      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{tr(title)}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{tr(description)}</p>
      </div>
    </div>

    <Toggle
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      label={tr(title)}
    />
  </div>
);

const Section = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
    <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={19} strokeWidth={2} />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">{tr(title)}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">{tr(description)}</p>
        </div>
      </div>
    </div>

    <div className="space-y-3 p-4 sm:p-5">{children}</div>
  </section>
);

const NOTIFICATION_KINDS: Array<{ key: keyof NotificationPreferences; icon: React.ElementType; title: string; description: string }> = [
  { key: "roomReminders", icon: CalendarClock, title: msg("Room reminders"), description: msg("“Starting in 10 minutes” for scheduled rooms you tapped “Remind me” on.") },
  { key: "followedLive", icon: Radio, title: msg("People you follow"), description: msg("When someone you follow goes live or schedules a room.") },
  { key: "newFollowers", icon: UserPlus, title: msg("New followers"), description: msg("When someone starts following you.") },
  { key: "corrections", icon: Wand2, title: msg("Corrections"), description: msg("When someone corrects something you said in a room or a chat.") },
  { key: "friendRequests", icon: Users, title: msg("Friend requests"), description: msg("When someone wants to be friends.") },
  { key: "achievements", icon: Zap, title: msg("Badges and leagues"), description: msg("When you earn a badge, and your weekly league result.") },
  { key: "challenges", icon: Radio, title: msg("Challenges"), description: msg("Reactions to your daily challenge answer, and friends challenging you to beat a score.") },
];

/** Which in-app notifications you get. Each switch saves straight away. */
const NotificationKinds = () => {
  const { data } = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  if (!data) return null;
  return (
    <>
      <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{tr("Notify me about")}</p>
      {NOTIFICATION_KINDS.map((kind) => (
        <SettingRow
          key={kind.key}
          icon={kind.icon}
          title={tr(kind.title)}
          description={tr(kind.description)}
          checked={data[kind.key]}
          disabled={update.isPending}
          onChange={(value) =>
            update.mutate({ [kind.key]: value }, { onError: () => toast.error(tr("Couldn't save that setting")) })
          }
        />
      ))}
    </>
  );
};

export const SettingsForm: React.FC<SettingsFormProps> = ({ settings }) => {
  const { updateSettings, isUpdating } = useSettings();
  // The theme applies and saves the moment it is picked; the form only carries the current one along
  const { theme: currentTheme } = useTheme();
  const chooseTheme = useChooseTheme();

  const initialFormData = useMemo(() => buildFormData(settings), [settings]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isDirty, setIsDirty] = useState(false);

  // Fresh settings from the server replace what is in the form
  const [formSource, setFormSource] = useState(initialFormData);
  if (formSource !== initialFormData) {
    setFormSource(initialFormData);
    setFormData(initialFormData);
    setIsDirty(false);
  }

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    setIsDirty(true);
  };

  const resetChanges = () => {
    setFormData(initialFormData);
    setIsDirty(false);
    toast.info(tr("Your unsaved changes were discarded."));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isUpdating) return;

    try {
      /**
       * The current useSettings hook was originally typed with only the older
       * Settings fields. Runtime API calls can still carry the additional
       * Prisma-backed fields, so the payload is kept complete here.
       *
       * Once useSettings.ts is updated to expose every Prisma Settings field,
       * this cast can be removed and the hook's UpdateSettingsData type can
       * be reused directly.
       */
      const payload = {
        emailNotifications: formData.emailNotifications,
        pushNotifications: formData.pushNotifications,
        soundEffects: formData.soundEffects,
        theme: currentTheme.toUpperCase(),
        dailyReminderEnabled: formData.dailyReminderEnabled,
        dailyReminderTime: formData.dailyReminderEnabled
          ? formData.dailyReminderTime
          : null,
        shareActivityWithFriends: formData.shareActivityWithFriends,
        showOnlineStatus: formData.showOnlineStatus,
        showProfilePublic: formData.showProfilePublic,
        allowFriendRequests: formData.allowFriendRequests,
        allowDirectMessages: formData.allowDirectMessages,
        autoTranslateMessages: formData.autoTranslateMessages,
      };

      await (
        updateSettings as unknown as (data: typeof payload) => Promise<unknown>
      )(payload);

      setIsDirty(false);
      toast.success(tr("Settings saved successfully."));
    } catch (error) {
      console.error("Failed to update settings:", error);
      toast.error(tr("Failed to save settings. Please try again."));
    }
  };

  const enabledPreferences = [
    formData.emailNotifications,
    formData.pushNotifications,
    formData.soundEffects,
    formData.dailyReminderEnabled,
    formData.shareActivityWithFriends,
    formData.showOnlineStatus,
    formData.showProfilePublic,
    formData.allowFriendRequests,
    formData.allowDirectMessages,
    formData.autoTranslateMessages,
  ].filter(Boolean).length;


  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-5xl pb-24">
      {/* Header */}
      <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-slate-50 shadow-sm">
        <div className="px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                <Palette size={22} strokeWidth={2} />
              </div>

              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
                  {tr("Account preferences")}</p>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  {tr("Settings")}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {tr("Personalize your SpeakBetter experience, notifications, privacy, language, reminders, and messaging preferences.")}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-start rounded-2xl border border-line bg-surface px-3 py-2 shadow-sm sm:self-center">
              <Zap size={16} className="text-indigo-600" />
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  {tr("Active preferences")}</p>
                <p className="text-sm font-bold text-slate-900">
                  {enabledPreferences} {" "}{tr("enabled")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Appearance (the app language has its own card above this form) */}
        <Section
          icon={Palette}
          title={tr("Appearance")}
          description={tr("Control how SpeakBetter looks.")}
        >
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Palette size={18} />
              </div>

              <div>
                <p className="font-semibold text-slate-900">{tr("Theme")}</p>
                <p className="text-sm text-slate-500">
                  {tr("Light, dark or navy blue. Pick what is easiest on your eyes.")}</p>
              </div>
            </div>

            <ThemeCards value={currentTheme} onChange={chooseTheme} />
            <p className="mt-3 text-xs text-slate-500">{tr("Changes apply right away and follow you to your other devices.")}</p>
          </div>

        </Section>

        {/* Notifications (the bell links here with #notifications) */}
        <div id="notifications" className="scroll-mt-6" />
        <Section
          icon={Bell}
          title={tr("Notifications")}
          description={tr("Choose when SpeakBetter should notify you and remind you to practice.")}
        >
          <SettingRow
            icon={Bell}
            title={tr("Email notifications")}
            description={tr("Receive important account, learning, and activity updates by email.")}
            checked={formData.emailNotifications}
            onChange={(value) => updateField("emailNotifications", value)}
          />

          <SettingRow
            icon={Smartphone}
            title={tr("Push notifications")}
            description={tr("Receive real-time notifications for messages, invitations, reminders, and activity.")}
            checked={formData.pushNotifications}
            onChange={(value) => updateField("pushNotifications", value)}
          />

          <AppAlertsCard />

          <SettingRow
            icon={Volume2}
            title={tr("Sound effects")}
            description={tr("Play interface sounds and interaction feedback while using SpeakBetter.")}
            checked={formData.soundEffects}
            onChange={(value) => updateField("soundEffects", value)}
          />

          <NotificationKinds />

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Clock3 size={19} />
                </div>

                <div>
                  <p className="font-semibold text-slate-900">
                    {tr("Daily practice reminder")}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {tr("Get a reminder at your preferred time so you can maintain your learning habit.")}</p>
                </div>
              </div>

              <Toggle
                checked={formData.dailyReminderEnabled}
                onChange={(value) => updateField("dailyReminderEnabled", value)}
                label={tr("Daily practice reminder")}
              />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label
                htmlFor="dailyReminderTime"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                {tr("Reminder time")}</label>

              <div className="relative">
                <select
                  id="dailyReminderTime"
                  value={formData.dailyReminderTime}
                  disabled={!formData.dailyReminderEnabled}
                  onChange={(event) =>
                    updateField("dailyReminderTime", event.target.value)
                  }
                  className="w-full appearance-none rounded-xl border border-line bg-surface px-4 py-3 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {REMINDER_TIMES.map((time) => (
                    <option key={time} value={time}>
                      {formatTime(time)}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={17}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Privacy */}
        <Section
          icon={Shield}
          title={tr("Privacy & visibility")}
          description={tr("Control what other people can see and how they can interact with you.")}
        >
          <SettingRow
            icon={Eye}
            title={tr("Public profile")}
            description={tr("Allow other SpeakBetter users to view your public profile.")}
            checked={formData.showProfilePublic}
            onChange={(value) => updateField("showProfilePublic", value)}
          />

          <SettingRow
            icon={Users}
            title={tr("Share activity with friends")}
            description={tr("Let friends see relevant learning activity and progress updates.")}
            checked={formData.shareActivityWithFriends}
            onChange={(value) => updateField("shareActivityWithFriends", value)}
          />

          <SettingRow
            icon={Eye}
            title={tr("Show online status")}
            description={tr("Allow other users to see when you are currently online.")}
            checked={formData.showOnlineStatus}
            onChange={(value) => updateField("showOnlineStatus", value)}
          />

          <SettingRow
            icon={UserRound}
            title={tr("Allow friend requests")}
            description={tr("Let other users send you friend requests.")}
            checked={formData.allowFriendRequests}
            onChange={(value) => updateField("allowFriendRequests", value)}
          />
        </Section>

        {/* Messaging */}
        <Section
          icon={MessageCircle}
          title={tr("Messaging & translation")}
          description={tr("Control direct messaging and the built-in translation experience.")}
        >
          <SettingRow
            icon={MessageCircle}
            title={tr("Allow direct messages")}
            description={tr("Allow other users to start direct conversations with you.")}
            checked={formData.allowDirectMessages}
            onChange={(value) => updateField("allowDirectMessages", value)}
          />

          <SettingRow
            icon={Languages}
            title={tr("Auto-translate messages")}
            description={tr("Automatically use translation support for messages when available.")}
            checked={formData.autoTranslateMessages}
            onChange={(value) => updateField("autoTranslateMessages", value)}
          />

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                <Sparkles size={18} />
              </div>

              <div>
                <p className="font-semibold text-indigo-950">
                  {tr("Better conversations, fewer barriers")}</p>
                <p className="mt-1 text-sm leading-5 text-indigo-800/80">
                  {tr("Auto-translation is especially useful when practicing with language partners who have different native languages.")}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Privacy summary */}
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm">
              {formData.showProfilePublic ? (
                <Eye size={19} />
              ) : (
                <EyeOff size={19} />
              )}
            </div>

            <div>
              <p className="font-semibold text-slate-900">{tr("Privacy snapshot")}</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {tr("Your profile is")}{" "}
                <span className="font-semibold text-slate-700">
                  {formData.showProfilePublic ? tr("public") : tr("private")}
                </span>
                {tr(", your online status is")}{" "}
                <span className="font-semibold text-slate-700">
                  {formData.showOnlineStatus ? tr("visible") : tr("hidden")}
                </span>
                {tr(", and direct messages are")}{" "}
                <span className="font-semibold text-slate-700">
                  {formData.allowDirectMessages ? tr("allowed") : tr("restricted")}
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {isDirty ? (
              <>
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                <p className="text-sm font-medium text-slate-600">
                  {tr("You have unsaved changes.")}</p>
              </>
            ) : (
              <>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check size={13} strokeWidth={3} />
                </span>
                <p className="text-sm font-medium text-slate-500">
                  {tr("All settings are saved.")}</p>
              </>
            )}
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={resetChanges}
              disabled={!isDirty || isUpdating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              <RotateCcw size={16} />
              {tr("Reset")}</button>

            <button
              type="submit"
              disabled={!isDirty || isUpdating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <Save size={16} />
              {isUpdating ? tr("Saving...") : tr("Save changes")}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
