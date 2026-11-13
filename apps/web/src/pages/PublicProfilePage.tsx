// apps/web/src/pages/PublicProfilePage.tsx
/**
 * Someone's public profile: who they are, how they are doing (level, streak, league), their badges and a way
 * to follow them or send a friend request. People who keep their profile private only show a name and photo.
 */

import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Check,
  Clock,
  Copy,
  Flame,
  GraduationCap,
  Languages,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  Pencil,
  Pin,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useUserProfile, type FullProfile, type ProfileRelationship } from "../hooks/usePublicProfile";
import { useSendFriendRequest } from "../hooks/useFriends";
import { FollowButton } from "../components/social/FollowButton";
import { BadgeIcon } from "../components/gamification/BadgeIcon";
import { ShareCardButton } from "../components/gamification/ShareCardDialog";
import type { ShareCardData } from "../lib/shareCard";
import { TIER_STYLE } from "../components/gamification/tiers";
import { getLevelProgress, getXpLevel } from "../lib/xpLevels";
import { tr, msg } from "../i18n/core";

const card =
  "rounded-3xl border border-line bg-surface shadow-sm";

/** "bn" → "Bangla", "BD" → "Bangladesh"; anything the browser does not know is shown as typed */
const nameOf = (type: "language" | "region", code: string): string => {
  try {
    return new Intl.DisplayNames(["en"], { type }).of(type === "region" ? code.toUpperCase() : code) ?? code;
  } catch {
    return code;
  }
};

const ago = (iso: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 5) return "online now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : "a while ago";
};

const Avatar: React.FC<{ name: string; url: string | null; size?: number }> = ({ name, url, size = 88 }) =>
  url ? (
    <img src={url} alt="" style={{ width: size, height: size }} className="rounded-3xl object-cover shrink-0" />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="rounded-3xl shrink-0 bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/20 text-indigo-700 dark:text-indigo-200 text-3xl font-bold flex items-center justify-center"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );

/** Follow and friend actions, or edit and share on your own profile */
const Actions: React.FC<{ userId: string; name: string; relationship: ProfileRelationship; progressCard?: ShareCardData }> = ({ userId, name, relationship, progressCard }) => {
  const sendRequest = useSendFriendRequest();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  if (relationship.isMe) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error(tr("Couldn't copy the link"));
      }
    };
    return (
      <div className="flex flex-wrap gap-2">
        <Link to="/profile" className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
          <Pencil className="w-4 h-4" /> {" "}{tr("Edit profile")}</Link>
        <button
          type="button"
          onClick={copy}
          className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? tr("Copied") : tr("Copy link")}
        </button>
        {progressCard && <ShareCardButton card={progressCard} label={tr("Share my progress")} />}
      </div>
    );
  }

  const quiet = "h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 border border-slate-200 dark:border-white/10 text-slate-500";
  return (
    <div className="flex flex-wrap gap-2">
      <FollowButton userId={userId} name={name} size="md" />
      {relationship.isFriend ? (
        <span className={quiet}>
          <Users className="w-4 h-4" /> {" "}{tr("Friends")}</span>
      ) : relationship.friendRequest === "sent" ? (
        <span className={quiet}>
          <Clock className="w-4 h-4" /> {" "}{tr("Request sent")}</span>
      ) : relationship.friendRequest === "received" ? (
        <Link to="/friends" className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
          <UserPlus className="w-4 h-4" /> {" "}{tr("Respond to request")}</Link>
      ) : (
        <button
          type="button"
          disabled={sendRequest.isPending}
          onClick={() => sendRequest.mutate(userId, { onSuccess: () => {
                toast.success(tr("Friend request sent to {name}", { name }));
                // The profile shows "Request sent" once it is refetched
                void queryClient.invalidateQueries({ queryKey: ["user-profile", userId] });
              },
            })}
          className="h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-60"
        >
          {sendRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} {" "}{tr("Add friend")}</button>
      )}
    </div>
  );
};

const Tile: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode }> = ({ icon, label, value, sub }) => (
  <div className={`${card} p-4`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 flex items-center gap-1.5">
      {icon} {tr(label)}
    </p>
    <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const Profile: React.FC<{ p: FullProfile }> = ({ p }) => {
  const [showAll, setShowAll] = useState(false);
  const level = getXpLevel(p.stats.xp);
  const badges = showAll ? p.badges.all : p.badges.showcase;
  const joined = new Date(p.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <>
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-col sm:flex-row gap-5">
          <Avatar name={p.name} url={p.avatarUrl} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-[26px] sm:text-[30px] leading-[1.15] font-semibold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span className="truncate">{p.name}</span>
                {p.isVerified && <BadgeCheck className="w-5 h-5 text-sky-500 shrink-0" aria-label={tr("Verified")} />}
                {p.level && (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-300" title={tr("English level")}>
                    {p.level}
                  </span>
                )}
              </h1>
              {p.username && <p className="text-sm text-slate-500">@{p.username}</p>}
            </div>

            {p.bio && <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">{p.bio}</p>}

            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
              {p.country && (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {nameOf("region", p.country)}
                </li>
              )}
              {(p.nativeLanguage || p.learningLanguages.length > 0) && (
                <li className="inline-flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5" />
                  {p.nativeLanguage && <>{tr("Speaks")}{" "}{nameOf("language", p.nativeLanguage)}</>}
                  {p.nativeLanguage && p.learningLanguages.length > 0 && " · "}
                  {p.learningLanguages.length > 0 && <>{tr("Learning")}{" "}{p.learningLanguages.map((l) => nameOf("language", l)).join(", ")}</>}
                </li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {" "}{tr("Joined")}{" "}{joined}
                {p.lastActive && <> {" "}{tr("· active")}{" "}{ago(p.lastActive)}</>}
              </li>
            </ul>

            <Actions
              userId={p.id}
              name={p.name}
              relationship={p.relationship}
              progressCard={{
                kind: "progress",
                person: p.name,
                level,
                streak: p.stats.streak,
                xp: p.stats.xp,
                badges: p.badges.earned,
                league: p.league?.name ?? null,
                leagueColor: p.league?.color ?? null,
              }}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile
          icon={<Zap className="w-3.5 h-3.5 text-violet-500" />}
          label={tr("Level {level}", { level })}
          value={p.stats.xp.toLocaleString()}
          sub={
            <span className="block mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden" aria-hidden>
              <span className="block h-full rounded-full bg-violet-500" style={{ width: `${getLevelProgress(p.stats.xp)}%` }} />
            </span>
          }
        />
        <Tile
          icon={<Flame className="w-3.5 h-3.5 text-orange-500" />}
          label={tr("Streak")}
          value={`${p.stats.streak}d`}
          sub={`Best ${p.stats.longestStreak} ${p.stats.longestStreak === 1 ? "day" : "days"}`}
        />
        <Tile
          icon={<Trophy className="w-3.5 h-3.5" style={{ color: p.league?.color }} />}
          label={tr("League")}
          value={p.league ? <span style={{ color: p.league.color }}>{p.league.name}</span> : "-"}
          sub={p.league ? `Best: ${p.league.best}` : "Not started"}
        />
        <Tile
          icon={<Users className="w-3.5 h-3.5 text-sky-500" />}
          label={tr("Followers")}
          value={p.stats.followers}
          sub={`${p.stats.following} following · ${p.stats.friends} ${p.stats.friends === 1 ? "friend" : "friends"}`}
        />
      </div>

      <section className={`${card} p-5`}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Learning so far")}</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          {[
            { icon: GraduationCap, label: msg("Grammar lessons"), value: p.stats.lessonsPassed, tone: "text-violet-500" },
            { icon: BookOpen, label: msg("Texts read"), value: p.stats.textsRead, tone: "text-teal-500" },
            { icon: Megaphone, label: msg("Daily challenges"), value: p.stats.challengeAnswers, tone: "text-rose-500" },
          ].map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className="rounded-2xl bg-slate-50 dark:bg-white/[0.04] py-3 px-2">
              <Icon className={`w-5 h-5 mx-auto ${tone}`} />
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</dd>
              <dt className="text-[11px] text-slate-500">{tr(label)}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {tr("Badges")}{" "}<span className="font-normal text-slate-400">{tr("· {earned} of", { earned: p.badges.earned })}{" "}{p.badges.total}</span>
          </h2>
          {p.badges.earned > p.badges.showcase.length && (
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
              {showAll ? tr("Show fewer") : tr("See all {earned}", { earned: p.badges.earned })}
            </button>
          )}
        </div>
        {p.relationship.isMe && p.badges.earned > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {tr("Pinned badges come first.")}{" "}<Link to="/leagues?tab=badges" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">{tr("Choose which to pin")}</Link>
          </p>
        )}
        {badges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{p.relationship.isMe ? tr("Earn your first badge by practising today.") : tr("No badges yet.")}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-3">
            {badges.map((b) => (
              <li key={b.key} className="flex flex-col items-center text-center gap-1.5" title={`${b.name}: ${b.description}`}>
                <span className="relative">
                  <BadgeIcon icon={b.icon} tier={b.tier} earned size={52} />
                  {b.pinned && (
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-indigo-600 text-white ring-2 ring-white dark:ring-slate-900">
                      <Pin className="h-2.5 w-2.5" aria-hidden />
                      <span className="sr-only">{tr("Pinned")}</span>
                    </span>
                  )}
                </span>
                <span className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-slate-100">{b.name}</span>
                <span className="text-[11px]" style={{ color: TIER_STYLE[b.tier].ring }}>{tr(TIER_STYLE[b.tier].label)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.interests.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{tr("Interests")}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {p.interests.map((i) => (
              <li key={i} className="rounded-full px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-200">
                {i}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

export const PublicProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading, isError } = useUserProfile(userId);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-4">
      <button type="button" onClick={() => window.history.back()} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="w-4 h-4" /> {" "}{tr("Back")}</button>

      {isLoading && (
        <div className="flex justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-slate-400" />
        </div>
      )}

      {(isError || (!isLoading && !data)) && (
        <div className={`${card} p-8 text-center`}>
          <p className="text-base font-semibold text-slate-900 dark:text-white">{tr("Profile not found")}</p>
          <p className="mt-1 text-sm text-slate-500">{tr("This person may have left, or you can't see their profile.")}</p>
          <Link to="/friends" className="mt-4 inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
            {tr("Find people")}</Link>
        </div>
      )}

      {data && data.private && (
        <section className={`${card} p-8 text-center space-y-4`}>
          <div className="flex justify-center">
            <Avatar name={data.name} url={data.avatarUrl} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{data.name}</h1>
          <p className="text-sm text-slate-500 inline-flex items-center gap-1.5">
            <Lock className="w-4 h-4" /> {" "}{tr("This profile is private. Friends can see it.")}</p>
          <div className="flex justify-center">
            <Actions userId={data.id} name={data.name} relationship={data.relationship} />
          </div>
        </section>
      )}

      {data && !data.private && <Profile p={data} />}
    </div>
  );
};

export default PublicProfilePage;
