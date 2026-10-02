// Care-team chat message shape shared by the message routes.
import type { MessageKind } from '@prisma/client';
import { db } from '@/lib/db';

export const MAX_MESSAGE_LENGTH = 2000;

export const senderSelect = {
  id: true,
  name: true,
  role: true,
  clinician: { select: { title: true } },
} as const;

type MessageRow = {
  id: string;
  body: string;
  kind: MessageKind;
  escalated: boolean;
  createdAt: Date;
  sender: { id: string; name: string; role: string; clinician: { title: string } | null } | null;
};

export function messageDTO(m: MessageRow, meId: string) {
  return {
    id: m.id,
    body: m.body,
    kind: m.kind,
    escalated: m.escalated,
    createdAt: m.createdAt.toISOString(),
    mine: m.sender?.id === meId,
    // null for AI companion replies
    sender: m.sender && { id: m.sender.id, name: m.sender.name, role: m.sender.role, title: m.sender.clinician?.title ?? null },
  };
}

export function markThreadRead(patientId: string, userId: string, at: Date) {
  return db.careThreadRead.upsert({
    where: { patientId_userId: { patientId, userId } },
    create: { patientId, userId, lastReadAt: at },
    update: { lastReadAt: at },
  });
}
