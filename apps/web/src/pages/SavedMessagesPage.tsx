// Saved messages: everything you starred, from all your chats, in one place.
import React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, MessageCircle, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, EmptyState, PageHeader } from "../components/ui";
import { chatApi, type SavedChatMessage } from "../hooks/useChat";
import { serverMessage } from "../lib/serverMessage";
import { msg, tr } from "../i18n/core";

const TYPE_LABEL: Record<string, string> = {
  IMAGE: msg("Photo"),
  VIDEO: msg("Video"),
  AUDIO: msg("Audio"),
  VOICE_NOTE: msg("Voice message"),
  FILE: msg("Document"),
  GIF: msg("GIF"),
  LOCATION: msg("Location"),
};

/** What to show for a message: its words, or the kind of attachment when it has none */
function savedPreview(m: Pick<SavedChatMessage, "type" | "content">): string {
  if (m.type === "VOICE_NOTE") return tr(TYPE_LABEL.VOICE_NOTE);
  const text = m.content?.trim();
  if (text) return text;
  return tr(TYPE_LABEL[m.type] ?? "Message");
}

export const SavedMessagesPage: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["saved-messages"],
    queryFn: async () => (await chatApi.getAllSaved()).data,
  });
  const unsave = useMutation({
    mutationFn: (id: string) => chatApi.saveMessage(id, false),
    onSuccess: (_r, id) => {
      qc.setQueryData<SavedChatMessage[]>(["saved-messages"], (old) => old?.filter((m) => m.id !== id));
    },
    onError: (e) => {
      toast.error(serverMessage(e) || tr("Couldn't remove it. Please try again."), { id: "unsave" });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <PageHeader icon={Star} title={tr("Saved messages")} subtitle={tr("Everything you saved from your chats, in one place.")} />

      {isLoading && (
        <Card className="flex justify-center py-10" role="status">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" aria-label={tr("Loading")} />
        </Card>
      )}

      {isError && (
        <Card className="space-y-3 text-center">
          <p className="text-sm text-red-600">{tr("Couldn't load your saved messages.")}</p>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            {tr("Try again")}
          </Button>
        </Card>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon={Star}
          title={tr("Nothing saved yet")}
          text={tr("Open a message's menu in any chat and choose Save to keep it here.")}
          action={
            <Link to="/chat" className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700">
              <MessageCircle className="h-4 w-4" aria-hidden /> {tr("Go to chats")}
            </Link>
          }
        />
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((m) => (
            <li key={m.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{m.sender?.name ?? tr("Someone")}</p>
                    <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                      {m.chat?.type === "GROUP" && m.chat.name ? `${m.chat.name} · ` : ""}
                      {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={StarOff}
                    aria-label={tr("Remove from saved")}
                    title={tr("Remove from saved")}
                    disabled={unsave.isPending}
                    onClick={() => unsave.mutate(m.id)}
                  />
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-200">{savedPreview(m)}</p>
                {m.chatId && (
                  <Link
                    to={`/chat?chatId=${m.chatId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
                  >
                    {tr("Open chat")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SavedMessagesPage;
