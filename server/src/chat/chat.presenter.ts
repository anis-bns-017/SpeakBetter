import { Prisma } from '@prisma/client';

/** Everything the chat UI needs on a message */
export const MESSAGE_INCLUDE = {
  sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
  reactions: {
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  },
  replyTo: { include: { sender: { select: { id: true, name: true } } } },
  attachments: true,
  translations: true,
  readReceipts: { select: { userId: true, readAt: true } },
} satisfies Prisma.MessageInclude;

/**
 * Messages a user can see: not deleted, not "deleted for me", not expired
 * (disappearing messages) and not older than their "clear history".
 */
export function visibleMessagesWhere(
  userId: string,
  clearedAt?: Date | null,
): Prisma.MessageWhereInput {
  return {
    isDeleted: false,
    hiddenFor: { none: { userId } },
    AND: [
      { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ...(clearedAt ? [{ createdAt: { gt: clearedAt } }] : []),
    ],
  };
}

/**
 * Shapes a message for clients. View-once media never leaves the server in a
 * message — the recipient gets the file only by opening it (once).
 */
export function presentMessage<T extends Record<string, any>>(message: T): T {
  if (!message) return message;
  const out: Record<string, any> = {
    ...message,
    delivered: Boolean(message.deliveredAt),
  };
  if (message.isViewOnce) {
    out.mediaUrl = null;
    out.fileUrl = null;
    if (Array.isArray(message.attachments)) out.attachments = [];
  }
  if (message.replyTo?.isViewOnce) {
    out.replyTo = { ...message.replyTo, mediaUrl: null, fileUrl: null };
  }
  return out as T;
}

/** Metadata is free-form JSON; read it as an object */
export function metaOf(message: { metadata?: unknown } | null | undefined): Record<string, any> {
  const meta = message?.metadata;
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...(meta as Record<string, any>) } : {};
}
