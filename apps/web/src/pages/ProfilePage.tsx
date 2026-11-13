import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
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
import { useSettings } from "../hooks/useSettings";
import { getXpLevel, getLevelProgress, getNextLevelXp } from "../lib/xpLevels";
import { PageHeader } from "../components/ui";
import { tr, msg } from "../i18n/core";

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
      <p className="text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {tr(label)}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{tr(description)}</p>
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
      <span className="text-xs font-bold text-slate-700">{tr(label)}</span>
      <span className="text-[11px] font-bold text-indigo-600">
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
  const { settings, isLoading: settingsLoading } = useSettings();
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
      <div className="min-h-screen bg-page px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-800">
              {tr("Loading your profile")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {tr("Preparing your learning identity and progress...")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-page px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
          <div className="w-full rounded-3xl border border-rose-100 bg-white p-7 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <AlertCircle className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-lg font-bold text-slate-900">
              {tr("We couldn't load your profile")}</h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {tr("Your profile information could not be retrieved right now. Please check your connection and try again.")}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700"
            >
              {tr("Try again")}<ChevronRight className="h-4 w-4" />
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
      label: msg("Profile"),
      mobileLabel: "Profile",
      description: msg("Your public learning identity"),
      icon: <CircleUserRound className="h-4 w-4" />,
    },
    {
      id: "stats",
      label: msg("Stats & Progress"),
      mobileLabel: "Progress",
      description: msg("Your learning performance"),
      icon: <BarChart3 className="h-4 w-4" />,
    },
    {
      id: "settings",
      label: msg("Account Settings"),
      mobileLabel: "Settings",
      description: msg("Preferences and privacy"),
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-page px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5 sm:space-y-6">
        {/* Page heading */}
        <PageHeader
          icon={User}
          tone="indigo"
          eyebrow={tr("Profile")}
          title={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {displayName}
              {profile.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-sans text-xs font-bold tracking-normal text-indigo-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {tr("Verified")}</span>
              )}
            </span>
          }
          subtitle={tr("@{username} · Your SpeakBetter learning profile", { username })}
          actions={
          <div className="flex items-center gap-2">
            <div className="hidden rounded-xl bg-slate-50 px-3 py-2 text-right sm:block">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {tr("Level")}</p>
              <p className="text-xs font-bold text-slate-800">
                {profile.level
                  ? getLevelLabel(profile.level)
                  : tr("Level {level}", { level: derived.level })}
              </p>
            </div>

            <Link
              to={`/u/${profile.userId}`}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{tr("How others see you")}</span>
              <span className="sm:hidden">{tr("Public view")}</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setActiveTab("profile");
                setIsEditing(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Edit3 className="h-4 w-4" />
              {tr("Edit")}</button>
          </div>
          }
        />

        {/* Tab navigation */}
        <nav
          aria-label={tr("Profile sections")}
          className="rounded-2xl border border-line bg-surface p-1.5 shadow-sm"
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
                  className={`group flex min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:justify-start sm:px-4 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span className="truncate">
                    <span className="hidden sm:inline">{tr(tab.label)}</span>
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
                    <p className="text-sm font-bold text-slate-900">
                      {tr("Edit your profile")}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {tr("Keep your learning identity up to date.")}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-slate-800"
                  >
                    {tr("Cancel")}</button>
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
                  <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <Languages className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {tr("Language journey")}</h3>
                        <p className="text-xs text-slate-500">
                          {tr("Your current language focus")}</p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {tr("Native language")}</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {profile.nativeLanguage || tr("Not set")}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {tr("Learning")}</p>

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
                          {tr("No learning languages added yet.")}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {tr("Learning direction")}</h3>
                        <p className="text-xs text-slate-500">
                          {tr("What you want to achieve")}</p>
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
                        {tr("Add learning goals to personalize your journey.")}</p>
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
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-600">
                      {tr("Learning journey")}</span>
                  </div>

                  <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                    {tr("Your progress at a glance")}</h2>

                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                    {tr("Keep building consistency, practicing your languages, and collecting experience through SpeakBetter.")}</p>
                </div>

                <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {tr("Current level")}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {tr("Level")}{" "}{derived.level}
                  </p>
                </div>
              </div>

              <div className="mt-7">
                <ProgressBar
                  value={derived.progress}
                  label={tr("Progress to next level")}
                  valueLabel={`${derived.progress}%`}
                />

                <p className="mt-2 text-[11px] text-slate-400">
                  {derived.xpRemaining > 0
                    ? tr("{value} XP remaining to the next level", { value: formatNumber(derived.xpRemaining) })
                    : tr("You've reached the highest currently calculated level.")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Zap className="h-5 w-5" />}
                label={tr("Total XP")}
                value={formatNumber(derived.xp)}
                description={tr("Experience earned from your learning activity.")}
                className="border-indigo-100 bg-indigo-50/60"
                iconClassName="bg-indigo-600 text-white"
              />

              <StatCard
                icon={<Flame className="h-5 w-5" />}
                label={tr("Current streak")}
                value={`${derived.streak}d`}
                description={tr("Consecutive days you've kept your learning habit.")}
                className="border-amber-100 bg-amber-50/60"
                iconClassName="bg-amber-500 text-white"
              />

              <StatCard
                icon={<Globe2 className="h-5 w-5" />}
                label={tr("Languages")}
                value={String(derived.learningLanguages.length)}
                description={tr("Languages currently included in your learning profile.")}
                className="border-emerald-100 bg-emerald-50/60"
                iconClassName="bg-emerald-600 text-white"
              />

              <StatCard
                icon={<Users className="h-5 w-5" />}
                label={tr("Community")}
                value={`${formatNumber(profile.followersCount ?? 0)}`}
                description={tr("Learners currently following your profile.")}
                className="border-violet-100 bg-violet-50/60"
                iconClassName="bg-violet-600 text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6 lg:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {tr("Profile & learning activity")}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {tr("A quick summary of the information available on your profile.")}</p>
                  </div>

                  <BarChart3 className="h-5 w-5 text-indigo-500" />
                </div>

                <div className="mt-6 space-y-5">
                  <ProgressBar
                    value={Math.min(100, derived.streak * 3.33)}
                    label={tr("30-day consistency target")}
                    valueLabel={`${Math.min(30, derived.streak)}/30 days`}
                  />

                  <ProgressBar
                    value={Math.min(
                      100,
                      derived.learningLanguages.length * 33.33,
                    )}
                    label={tr("Language portfolio")}
                    valueLabel={`${derived.learningLanguages.length} active`}
                  />

                  <ProgressBar
                    value={Math.min(100, derived.goals.length * 20)}
                    label={tr("Goal clarity")}
                    valueLabel={`${derived.goals.length} goals`}
                  />

                  <ProgressBar
                    value={Math.min(100, derived.interests.length * 12.5)}
                    label={tr("Interest profile")}
                    valueLabel={`${derived.interests.length} interests`}
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {tr("Learner profile")}</h3>
                    <p className="text-xs text-slate-500">
                      {tr("Key identity details")}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {tr("Location")}</p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-700">
                        {[profile.city, profile.country]
                          .filter(Boolean)
                          .join(", ") || tr("Not set")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {tr("Member since")}</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {formatDate(profile.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {tr("Social")}</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {formatNumber(profile.followersCount ?? 0)} {" "}{tr("followers ·{value}{value2} following", { value: " ", value2: formatNumber(profile.followingCount ?? 0) })}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        {tr("Verification")}</p>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        {profile.isVerified
                          ? tr("Verified account")
                          : tr("Not verified")}
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
                  <h3 className="text-sm font-bold text-slate-900">
                    {tr("Keep the momentum going")}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {tr("Your current streak is the simplest habit signal here. A little practice every day is more valuable than occasional long sessions.")}</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Settings */}
        {activeTab === "settings" && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Settings className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    {tr("Account settings")}</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
                    {tr("Control notifications, learning reminders, visibility, messaging, translation, language, and appearance preferences from one place.")}</p>
                </div>
              </div>
            </div>

            {settings ? (
              <SettingsForm settings={settings} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">
                {settingsLoading
                  ? tr("Loading your settings…")
                  : tr("We couldn't load your settings. Please refresh and try again.")}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
