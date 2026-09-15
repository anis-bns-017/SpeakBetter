import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Check,
  ChevronDown,
  Globe2,
  Languages,
  Lock,
  MessageCircle,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Clock3,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { useSettings } from "../../hooks/useSettings";

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

type ThemeValue = "light" | "dark" | "system";

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

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { value: "es", label: "Spanish", nativeLabel: "Español" },
  { value: "fr", label: "French", nativeLabel: "Français" },
  { value: "de", label: "German", nativeLabel: "Deutsch" },
  { value: "pt", label: "Portuguese", nativeLabel: "Português" },
  { value: "ar", label: "Arabic", nativeLabel: "العربية" },
  { value: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { value: "ja", label: "Japanese", nativeLabel: "日本語" },
  { value: "ko", label: "Korean", nativeLabel: "한국어" },
  { value: "zh", label: "Chinese", nativeLabel: "中文" },
];

const THEME_OPTIONS: Array<{
  value: ThemeValue;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "system",
    label: "System",
    description: "Follow your device preference",
    icon: Smartphone,
  },
  {
    value: "light",
    label: "Light",
    description: "Use a bright interface",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use a darker interface",
    icon: Moon,
  },
];

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

const getLanguageLabel = (language: string) =>
  LANGUAGE_OPTIONS.find((item) => item.value === language)?.label || language;

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
    aria-label={label}
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
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>

    <Toggle
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      label={title}
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
  <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <Icon size={19} strokeWidth={2} />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
        </div>
      </div>
    </div>

    <div className="space-y-3 p-4 sm:p-5">{children}</div>
  </section>
);

export const SettingsForm: React.FC<SettingsFormProps> = ({ settings }) => {
  const { updateSettings, isUpdating } = useSettings();

  const initialFormData = useMemo(() => buildFormData(settings), [settings]);

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setFormData(initialFormData);
    setIsDirty(false);
  }, [initialFormData]);

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
    toast.info("Your unsaved changes were discarded.");
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
        theme: formData.theme,
        language: formData.language,
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
      toast.success("Settings saved successfully.");
    } catch (error) {
      console.error("Failed to update settings:", error);
      toast.error("Failed to save settings. Please try again.");
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

  const selectedLanguage = getLanguageLabel(formData.language);

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
                  Account preferences
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">
                  Settings
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  Personalize your SpeakBetter experience, notifications,
                  privacy, language, reminders, and messaging preferences.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:self-center">
              <Zap size={16} className="text-indigo-600" />
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Active preferences
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {enabledPreferences} enabled
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Appearance & language */}
        <Section
          icon={Palette}
          title="Appearance & language"
          description="Control how SpeakBetter looks and which language you prefer."
        >
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Palette size={18} />
              </div>

              <div>
                <p className="font-semibold text-slate-900">Theme</p>
                <p className="text-sm text-slate-500">
                  Choose your preferred interface appearance.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = formData.theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField("theme", option.value)}
                    className={`relative rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-4 focus:ring-indigo-100 ${
                      selected
                        ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}

                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
                        selected
                          ? "bg-white text-indigo-600"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Icon size={19} />
                    </div>

                    <p className="font-semibold text-slate-900">
                      {option.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <label htmlFor="language" className="mb-3 flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Languages size={18} />
              </span>

              <span>
                <span className="block font-semibold text-slate-900">
                  Interface language
                </span>
                <span className="block text-sm text-slate-500">
                  Current language: {selectedLanguage}
                </span>
              </span>
            </label>

            <div className="relative">
              <select
                id="language"
                value={formData.language}
                onChange={(event) =>
                  updateField("language", event.target.value)
                }
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
              >
                {LANGUAGE_OPTIONS.map((language) => (
                  <option key={language.value} value={language.value}>
                    {language.label} — {language.nativeLabel}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={17}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section
          icon={Bell}
          title="Notifications"
          description="Choose when SpeakBetter should notify you and remind you to practice."
        >
          <SettingRow
            icon={Bell}
            title="Email notifications"
            description="Receive important account, learning, and activity updates by email."
            checked={formData.emailNotifications}
            onChange={(value) => updateField("emailNotifications", value)}
          />

          <SettingRow
            icon={Smartphone}
            title="Push notifications"
            description="Receive real-time notifications for messages, invitations, reminders, and activity."
            checked={formData.pushNotifications}
            onChange={(value) => updateField("pushNotifications", value)}
          />

          <SettingRow
            icon={Volume2}
            title="Sound effects"
            description="Play interface sounds and interaction feedback while using SpeakBetter."
            checked={formData.soundEffects}
            onChange={(value) => updateField("soundEffects", value)}
          />

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Clock3 size={19} />
                </div>

                <div>
                  <p className="font-semibold text-slate-900">
                    Daily practice reminder
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    Get a reminder at your preferred time so you can maintain
                    your learning habit.
                  </p>
                </div>
              </div>

              <Toggle
                checked={formData.dailyReminderEnabled}
                onChange={(value) => updateField("dailyReminderEnabled", value)}
                label="Daily practice reminder"
              />
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <label
                htmlFor="dailyReminderTime"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Reminder time
              </label>

              <div className="relative">
                <select
                  id="dailyReminderTime"
                  value={formData.dailyReminderTime}
                  disabled={!formData.dailyReminderEnabled}
                  onChange={(event) =>
                    updateField("dailyReminderTime", event.target.value)
                  }
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
          title="Privacy & visibility"
          description="Control what other people can see and how they can interact with you."
        >
          <SettingRow
            icon={Eye}
            title="Public profile"
            description="Allow other SpeakBetter users to view your public profile."
            checked={formData.showProfilePublic}
            onChange={(value) => updateField("showProfilePublic", value)}
          />

          <SettingRow
            icon={Users}
            title="Share activity with friends"
            description="Let friends see relevant learning activity and progress updates."
            checked={formData.shareActivityWithFriends}
            onChange={(value) => updateField("shareActivityWithFriends", value)}
          />

          <SettingRow
            icon={Eye}
            title="Show online status"
            description="Allow other users to see when you are currently online."
            checked={formData.showOnlineStatus}
            onChange={(value) => updateField("showOnlineStatus", value)}
          />

          <SettingRow
            icon={UserRound}
            title="Allow friend requests"
            description="Let other users send you friend requests."
            checked={formData.allowFriendRequests}
            onChange={(value) => updateField("allowFriendRequests", value)}
          />
        </Section>

        {/* Messaging */}
        <Section
          icon={MessageCircle}
          title="Messaging & translation"
          description="Control direct messaging and the built-in translation experience."
        >
          <SettingRow
            icon={MessageCircle}
            title="Allow direct messages"
            description="Allow other users to start direct conversations with you."
            checked={formData.allowDirectMessages}
            onChange={(value) => updateField("allowDirectMessages", value)}
          />

          <SettingRow
            icon={Languages}
            title="Auto-translate messages"
            description="Automatically use translation support for messages when available."
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
                  Better conversations, fewer barriers
                </p>
                <p className="mt-1 text-sm leading-5 text-indigo-800/80">
                  Auto-translation is especially useful when practicing with
                  language partners who have different native languages.
                </p>
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
              <p className="font-semibold text-slate-900">Privacy snapshot</p>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                Your profile is{" "}
                <span className="font-semibold text-slate-700">
                  {formData.showProfilePublic ? "public" : "private"}
                </span>
                , your online status is{" "}
                <span className="font-semibold text-slate-700">
                  {formData.showOnlineStatus ? "visible" : "hidden"}
                </span>
                , and direct messages are{" "}
                <span className="font-semibold text-slate-700">
                  {formData.allowDirectMessages ? "allowed" : "restricted"}
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
                  You have unsaved changes.
                </p>
              </>
            ) : (
              <>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check size={13} strokeWidth={3} />
                </span>
                <p className="text-sm font-medium text-slate-500">
                  All settings are saved.
                </p>
              </>
            )}
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <button
              type="button"
              onClick={resetChanges}
              disabled={!isDirty || isUpdating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              <RotateCcw size={16} />
              Reset
            </button>

            <button
              type="submit"
              disabled={!isDirty || isUpdating}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              <Save size={16} />
              {isUpdating ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
