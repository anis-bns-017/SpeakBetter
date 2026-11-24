// apps/web/src/components/communities/MembersPanel.tsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Ban, Crown, UserMinus } from "lucide-react";
import { useBanMember, useRemoveMember, useUnbanMember, useUpdateMemberRole, type Community } from "../../hooks/useCommunities";
import { ASSIGNABLE_ROLES, ROLE_LABEL, canManage, isAdmin, rankOf, type MemberRole } from "../../lib/communityRoles";
import { PersonAvatar } from "./PersonAvatar";
import { tr } from "../../i18n/core";

const iconBtn = "h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-40";

export const MembersPanel: React.FC<{ community: Community; myId?: string }> = ({ community, myId }) => {
  const myRole = community.viewer?.role ?? null;
  const setRole = useUpdateMemberRole();
  const remove = useRemoveMember();
  const ban = useBanMember();
  const unban = useUnbanMember();
  const communityId = community.id;

  const members = useMemo(
    () => [...community.members].sort((a, b) => rankOf(b.role) - rankOf(a.role) || a.user.name.localeCompare(b.user.name)),
    [community.members],
  );

  return (
    <div className="space-y-5">
      <ul className="space-y-1">
        {members.map((m) => {
          const mine = m.userId === myId;
          const manageable = !mine && canManage(myRole, m.role);
          return (
            <li key={m.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
              <PersonAvatar name={m.user.name} url={m.user.avatarUrl} />
              <div className="min-w-0 flex-1">
                <Link to={`/u/${m.userId}`} className="block text-sm font-semibold text-slate-900 dark:text-white truncate hover:underline">
                  {m.user.name}{mine && <span className="font-normal text-slate-500"> ({tr("You")})</span>}
                </Link>
                {!(myRole === "OWNER" && m.role !== "OWNER") && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    {m.role === "OWNER" && <Crown className="w-3 h-3 text-amber-500" aria-hidden />}
                    {tr(ROLE_LABEL[m.role as MemberRole] ?? ROLE_LABEL.MEMBER)}
                  </span>
                )}
              </div>
              {myRole === "OWNER" && m.role !== "OWNER" && (
                <select
                  value={m.role}
                  disabled={setRole.isPending}
                  aria-label={tr("Role for {name}", { name: m.user.name })}
                  onChange={(e) => setRole.mutate({ communityId, userId: m.userId, role: e.target.value })}
                  className="h-9 rounded-lg border border-line bg-surface px-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>
                  ))}
                </select>
              )}
              {manageable && (
                <>
                  <button
                    type="button"
                    className={iconBtn}
                    title={tr("Remove")}
                    aria-label={tr("Remove {name}", { name: m.user.name })}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(tr("Remove {name} from this community? They can join again.", { name: m.user.name }))) remove.mutate({ communityId, userId: m.userId });
                    }}
                  >
                    <UserMinus className="w-4 h-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={iconBtn}
                    title={tr("Ban")}
                    aria-label={tr("Ban {name}", { name: m.user.name })}
                    disabled={ban.isPending}
                    onClick={() => {
                      if (window.confirm(tr("Ban {name}? They can't come back until you unban them.", { name: m.user.name }))) ban.mutate({ communityId, userId: m.userId });
                    }}
                  >
                    <Ban className="w-4 h-4" aria-hidden />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {isAdmin(myRole) && community.bans.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{tr("Banned")}</h3>
          <ul className="space-y-1">
            {community.bans.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2">
                <PersonAvatar name={b.user.name} url={b.user.avatarUrl} />
                <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-white truncate">{b.user.name}</span>
                <button
                  type="button"
                  disabled={unban.isPending}
                  onClick={() => unban.mutate({ communityId, userId: b.userId })}
                  className="h-9 px-3 rounded-lg border border-line text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                >
                  {tr("Unban")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
