import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Edit3,
  Flame,
  Globe2,
  GraduationCap,
  Languages,
  Loader2,
  MapPin,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
  Zap,
} from "lucide-react";

import { useProfile } from "../hooks/useProfile";
import { ProfileCard } from "../components/profile/ProfileCard";
import { EditProfileForm } from "../components/profile/EditProfileForm";
import { SettingsForm } from "../components/settings/SettingsForm";

type Tab = "profile" | "stats" | "settings";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getLevelLabel = (level?: string | null) => {
  if (!level) return "Learner";

  return level
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getXpLevel = (xp: number) => {
  if (xp >= 10000) return 10;
  if (xp >= 8000) return 9;
  if (xp >= 6500) return 8;
  if (xp >= 5000) return 7;
  if (xp >= 4000) return 6;
  if (xp >= 3000) return 5;
  if (xp >= 2000) return 4;
  if (xp >= 1000) return 3;
  if (xp >= 500) return 2;
  return 1;
};

const getLevelProgress = (xp: number) => {
  const level = getXpLevel(xp);
  const thresholds = [0, 500, 1000, 2000, 3000, 4000, 5000, 6500, 8000, 10000];
  const currentThreshold = thresholds[level - 1] ?? 0;
  const nextThreshold = thresholds[level] ?? currentThreshold + 2000;

  if (nextThreshold <= currentThreshold) return 100;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        ((xp - currentThreshold) / (nextThreshold - currentThreshold)) * 100,
      ),
    ),
  );
};

const getNextLevelXp = (xp: number) => {
  const level = getXpLevel(xp);
  const thresholds = [0, 500, 1000, 2000, 3000, 4000, 5000, 6500, 8000, 10000];
  return thresholds[level] ?? xp;
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  className: string;
  iconClassName: string;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  description,
  className,
  iconClassName,
}) => (
  <div className={`rounded-2xl border p-4 sm:p-5 ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        {icon}
      </div>
      <Sparkles className="h-4 w-4 text-slate-300" />
    </div>

    <div className="mt-4">
      <p className="text-2xl font-black tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  </div>
);

interface ProgressBarProps {
  value: number;
  label: string;
  valueLabel: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  valueLabel,
}) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <span className="text-[11px] font-black text-indigo-600">
        {valueLabel}
      </span>
    </div>

    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full bg-indigo-600 transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  </div>
);

export const ProfilePage: React.FC = () => {
  const { profile, isLoading, error } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const derived = useMemo(() => {
    const xp = Number(profile?.xp ?? 0);
    const streak = Number(profile?.streak ?? 0);
    const learningLanguages = profile?.learningLanguages ?? [];
    const interests = profile?.interests ?? [];
    const goals = profile?.goals ?? [];

    const level = getXpLevel(xp);
    const progress = getLevelProgress(xp);
    const nextLevelXp = getNextLevelXp(xp);
    const xpRemaining = Math.max(0, nextLevelXp - xp);

    return {
      xp,
      streak,
      learningLanguages,
      interests,
      goals,
      level,
      progress,
      nextLevelXp,
      xpRemaining,
    };
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/70 px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">
              Loading your profile
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Preparing your learning identity and progress...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-slate-50/70 px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-rose-100 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <AlertCircle className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-black text-slate-900">
              We couldn't load your profile
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your profile information could not be retrieved right now. Please
              check your connection and try again.
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700"
            >
              Try again
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displayName =
    profile.displayName?.trim() || profile.user?.name?.trim() || "Learner";

  const username =
    profile.username?.trim() || profile.user?.email?.split("@")[0] || "learner";

  const tabs: Array<{
    id: Tab;
    label: string;
    mobileLabel: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "profile",
      label: "Profile",
      mobileLabel: "Profile",
      description: "Your public learning identity",
      icon: <CircleUserRound className="h-4 w-4" />,
    },
    {
      id: "stats",
      label: "Stats & Progress",
      mobileLabel: "Progress",
      description: "Your learning performance",
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      id: "settings",
      label: "Account Settings",
      mobileLabel: "Settings",
      description: "Preferences and privacy",
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70 px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        {/* Page heading */}
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 sm:flex">
              <User className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                  {displayName}
                </h1>

                {profile.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>

              <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm">
                @{username} · Your SpeakBetter learning profile
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl bg-slate-50 px-3 py-2 text-right sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                Level
              </p>
              <p className="text-xs font-black text-slate-800">
                {profile.level
                  ? getLevelLabel(profile.level)
                  : `Level ${derived.level}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab("profile");
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </button>
          </div>
        </header>

        {/* Tab navigation */}
        <nav
          aria-label="Profile sections"
          className="rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm"
        >
          <div className="grid grid-cols-3 gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-black transition sm:justify-start sm:px-4 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="truncate">
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.mobileLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Profile */}
        {activeTab === "profile" && (
          <section className="space-y-5">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Edit your profile
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Keep your learning identity up to date.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl px-3 py-2 text-xs font-black text-slate-500 transition hover:bg-white hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                <EditProfileForm
                  profile={profile}
                  onCancel={() => setIsEditing(false)}
                  onSuccess={() => setIsEditing(false)}
                />
              </div>
            ) : (
              <>
                <ProfileCard
                  profile={profile}
                  onEdit={() => setIsEditing(true)}
                  isOwnProfile
                />

                {/* Profile overview */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Languages className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          Language journey
                        </h3>
                        <p className="text-xs text-slate-500">
                          Your current language focus
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Native language
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {profile.nativeLanguage || "Not set"}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                        Learning
                      </p>

                      {derived.learningLanguages.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {derived.learningLanguages.map((language) => (
                            <span
                              key={language}
                              className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700"
                            >
                              {language}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">
                          No learning languages added yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          Learning direction
                        </h3>
                        <p className="text-xs text-slate-500">
                          What you want to achieve
                        </p>
                      </div>
                    </div>

                    {derived.goals.length ? (
                      <div className="mt-5 space-y-2">
                        {derived.goals.slice(0, 5).map((goal, index) => (
                          <div
                            key={`${goal}-${index}`}
                            className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <p className="text-xs font-semibold leading-5 text-slate-700">
                              {goal}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-5 text-sm text-slate-400">
                        Add learning goals to personalize your journey.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* Stats & Progress */}
        {activeTab === "stats" && (
          <section className="space-y-5">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">
                      Learning journey
                    </span>
                  </div>

                  <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">
                    Your progress at a glance
                  </h2>

                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                    Keep building consistency, practicing your languages, and
                    collecting experience through SpeakBetter.
                  </p>
                </div>

                <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    Current level
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    Level {derived.level}
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <ProgressBar
                  value={derived.progress}
                  label="Progress to next level"
                  valueLabel={`${derived.progress}%`}
                />

                <p className="mt-2 text-[11px] text-slate-400">
                  {derived.xpRemaining > 0
                    ? `${formatNumber(derived.xpRemaining)} XP remaining to the next level`
                    : "You've reached the highest currently calculated level."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Zap className="h-5 w-5" />}
                label="Total XP"
                value={formatNumber(derived.xp)}
                description="Experience earned from your learning activity."
                className="border-indigo-100 bg-indigo-50/60"
                iconClassName="bg-indigo-600 text-white"
              />

              <StatCard
                icon={<Flame className="h-5 w-5" />}
                label="Current streak"
                value={`${derived.streak}d`}
                description="Consecutive days you've kept your learning habit."
                className="border-amber-100 bg-amber-50/60"
                iconClassName="bg-amber-500 text-white"
              />

              <StatCard
                icon={<Globe2 className="h-5 w-5" />}
                label="Languages"
                value={String(derived.learningLanguages.length)}
                description="Languages currently included in your learning profile."
                className="border-emerald-100 bg-emerald-50/60"
                iconClassName="bg-emerald-600 text-white"
              />

              <StatCard
                icon={<Users className="h-5 w-5" />}
                label="Community"
                value={`${formatNumber(profile.followersCount ?? 0)}`}
                description="Learners currently following your profile."
                className="border-violet-100 bg-violet-50/60"
                iconClassName="bg-violet-600 text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Profile & learning activity
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      A quick summary of the information available on your
                      profile.
                    </p>
                  </div>

                  <BarChart3 className="h-5 w-5 text-indigo-500" />
                </div>

                <div className="mt-6 space-y-5">
                  <ProgressBar
                    value={Math.min(100, derived.streak * 3.33)}
                    label="30-day consistency target"
                    valueLabel={`${Math.min(30, derived.streak)}/30 days`}
                  />

                  <ProgressBar
                    value={Math.min(
                      100,
                      derived.learningLanguages.length * 33.33,
                    )}
                    label="Language portfolio"
                    valueLabel={`${derived.learningLanguages.length} active`}
                  />

                  <ProgressBar
                    value={Math.min(100, derived.goals.length * 20)}
                    label="Goal clarity"
                    valueLabel={`${derived.goals.length} goals`}
                  />

                  <ProgressBar
                    value={Math.min(100, derived.interests.length * 12.5)}
                    label="Interest profile"
                    valueLabel={`${derived.interests.length} interests`}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Learner profile
                    </h3>
                    <p className="text-xs text-slate-500">
                      Key identity details
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Location
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-700">
                        {[profile.city, profile.country]
                          .filter(Boolean)
                          .join(", ") || "Not set"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Member since
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {formatDate(profile.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Social
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {formatNumber(profile.followersCount ?? 0)} followers ·{" "}
                        {formatNumber(profile.followingCount ?? 0)} following
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        Verification
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {profile.isVerified
                          ? "Verified account"
                          : "Not verified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Keep the momentum going
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Your current streak is the simplest habit signal here. A
                    little practice every day is more valuable than occasional
                    long sessions.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Settings */}
        {activeTab === "settings" && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Settings className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">
                    Account settings
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    Control notifications, learning reminders, visibility,
                    messaging, translation, language, and appearance preferences
                    from one place.
                  </p>
                </div>
              </div>
            </div>

            <SettingsForm />
          </section>
        )}
      </div>
    </div>
  );
};
