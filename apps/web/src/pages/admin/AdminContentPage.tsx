// apps/web/src/pages/admin/AdminContentPage.tsx
/** Voice rooms (live and ended; close one that goes wrong) and communities (hide or bring back) */

import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AudioLines, EyeOff, Eye, Hash, Power, Search, Users } from "lucide-react";
import { Badge, Button, Chip, EmptyState, Tabs } from "../../components/ui";
import { adminApi, adminError, useAdminAction, useAdminCommunities, useAdminRooms, type CommunityRow, type RoomRow } from "../../hooks/useAdmin";
import { ActionDialog, AdminTitle, LoadingBlock, Pager, PersonLink, ReasonField } from "../../components/admin/AdminKit";
import { panel, timeAgo } from "../../lib/adminFormat";

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => {
  const [text, setText] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => text !== value && onChange(text), 300);
    return () => window.clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <label className="relative block flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 sm:text-sm dark:text-white"
      />
    </label>
  );
};

const Rooms: React.FC = () => {
  const [state, setState] = useState<"live" | "ended">("live");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<RoomRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useAdminRooms({ state, q, page });
  const close = useAdminAction((room: RoomRow) => adminApi.closeRoom(room.id, reason));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          <Chip selected={state === "live"} onClick={() => (setState("live"), setPage(1))}>
            Live now
          </Chip>
          <Chip selected={state === "ended"} onClick={() => (setState("ended"), setPage(1))}>
            Ended
          </Chip>
        </div>
        <SearchBox value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Room name or host" />
      </div>

      {isLoading || !data ? (
        <LoadingBlock rows={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={AudioLines} title={state === "live" ? "No rooms are live" : "No ended rooms"} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((room) => (
            <li key={room.id} className={`${panel} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{room.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {state === "live" ? `Opened ${timeAgo(room.createdAt)}` : `Ended ${timeAgo(room.endedAt)}`} · {room.messages} messages
                    {room.language ? ` · ${room.language}` : ""}
                  </p>
                </div>
                {state === "live" ? (
                  <Badge tone="danger" icon={Users}>
                    {room.inRoom} in room
                  </Badge>
                ) : (
                  <Badge tone="neutral">{room.status.toLowerCase()}</Badge>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <PersonLink person={room.creator} sub="Host" />
                {state === "live" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Power}
                    onClick={() => {
                      setReason("");
                      setError(null);
                      setClosing(room);
                    }}
                  >
                    Close room
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}

      <ActionDialog
        open={!!closing}
        title={`Close “${closing?.name}”?`}
        description="Everyone in the room is disconnected now, and the host is told why."
        confirmLabel="Close room"
        danger
        busy={close.isPending}
        disabled={reason.trim().length < 3}
        error={error}
        onClose={() => setClosing(null)}
        onConfirm={() =>
          close.mutate(closing!, {
            onSuccess: () => {
              toast.success("Room closed");
              setClosing(null);
            },
            onError: (e) => setError(adminError(e)),
          })
        }
      >
        <ReasonField label="Reason (the host sees it)" value={reason} onChange={setReason} />
      </ActionDialog>
    </div>
  );
};

const Communities: React.FC = () => {
  const [state, setState] = useState<"all" | "visible" | "hidden">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<CommunityRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useAdminCommunities({ state: state === "all" ? undefined : state, q, page });
  const toggle = useAdminAction((c: CommunityRow) => adminApi.hideCommunity(c.id, !c.hiddenAt, c.hiddenAt ? undefined : reason));
  const hiding = !!target && !target.hiddenAt;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {(["all", "visible", "hidden"] as const).map((s) => (
            <Chip key={s} selected={state === s} onClick={() => (setState(s), setPage(1))}>
              {s === "all" ? "All" : s === "visible" ? "Visible" : "Hidden"}
            </Chip>
          ))}
        </div>
        <SearchBox value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Community or owner" />
      </div>

      {isLoading || !data ? (
        <LoadingBlock rows={4} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Hash} title="No communities" />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.items.map((c) => (
            <li key={c.id} className={`${panel} p-4 ${c.hiddenAt ? "opacity-80" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{c.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {c.members} members · {c.messages} messages · {c.type.toLowerCase()} · made {timeAgo(c.createdAt)}
                  </p>
                </div>
                {c.hiddenAt ? <Badge tone="danger" icon={EyeOff}>Hidden</Badge> : <Badge tone="success">Visible</Badge>}
              </div>
              {c.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{c.description}</p>}
              {c.hiddenReason && <p className="mt-2 text-xs text-red-700 dark:text-red-300">Hidden: {c.hiddenReason}</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <PersonLink person={c.owner} sub="Owner" />
                <Button
                  variant="secondary"
                  size="sm"
                  icon={c.hiddenAt ? Eye : EyeOff}
                  onClick={() => {
                    setReason("");
                    setError(null);
                    setTarget(c);
                  }}
                >
                  {c.hiddenAt ? "Bring back" : "Hide"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}

      <ActionDialog
        open={!!target}
        title={hiding ? `Hide “${target?.name}”?` : `Bring back “${target?.name}”?`}
        description={hiding ? "It disappears from every list and can't be opened. Nothing is deleted, and you can bring it back." : "It shows up in lists again and opens normally."}
        confirmLabel={hiding ? "Hide community" : "Bring back"}
        danger={hiding}
        busy={toggle.isPending}
        disabled={hiding && reason.trim().length < 3}
        error={error}
        onClose={() => setTarget(null)}
        onConfirm={() =>
          toggle.mutate(target!, {
            onSuccess: () => {
              toast.success(hiding ? "Community hidden" : "Community is back");
              setTarget(null);
            },
            onError: (e) => setError(adminError(e)),
          })
        }
      >
        {hiding && <ReasonField label="Reason (the owner sees it)" value={reason} onChange={setReason} />}
      </ActionDialog>
    </div>
  );
};

export const AdminContentPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "communities" ? "communities" : "rooms";
  return (
    <div className="space-y-5">
      <AdminTitle title="Rooms & communities" subtitle="Step in when a room or a community goes wrong" />
      <Tabs
        label="Content"
        value={tab}
        onChange={(v) => setParams(v === "rooms" ? {} : { tab: v }, { replace: true })}
        items={[
          { value: "rooms", label: "Voice rooms", icon: AudioLines },
          { value: "communities", label: "Communities", icon: Hash },
        ]}
      />
      <div role="tabpanel">{tab === "rooms" ? <Rooms /> : <Communities />}</div>
    </div>
  );
};

export default AdminContentPage;
