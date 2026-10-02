import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, readJson, serverError } from '@/lib/api-utils';
import { companionReply } from '@/lib/ai-agent';
import { MAX_MESSAGE_LENGTH, markThreadRead, messageDTO, senderSelect } from '@/lib/messages';
import { graphemes, sanitizeText } from '@/lib/text-safe';

const MAX_QUESTIONS_PER_HOUR = 20;

// Ask the AI companion (patient only). Body: { body }.
// The question and the reply are both stored in the patient's care-team
// thread (kinds ASSISTANT_QUESTION / ASSISTANT_REPLY) so clinicians can see
// what the assistant said. Red-flag symptoms get a fixed escalation reply.
export async function POST(req: Request) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const patientId = auth.user.patientId;
  if (!patientId) return jsonError('No patient profile', 403);
  const input = await readJson(req);
  if (!input) return badRequest('Invalid JSON body');
  const body = typeof input.body === 'string' ? sanitizeText(input.body).trim() : '';
  if (!body) return badRequest('Message body is required');
  if (graphemes(body).length > MAX_MESSAGE_LENGTH) return badRequest(`Message must be at most ${MAX_MESSAGE_LENGTH} characters`);

  try {
    const recent = await db.careMessage.count({
      where: { patientId, kind: 'ASSISTANT_QUESTION', createdAt: { gt: new Date(Date.now() - 3_600_000) } },
    });
    if (recent >= MAX_QUESTIONS_PER_HOUR) {
      return jsonError('Too many questions to the AI assistant — please try again later or message your care team', 429);
    }

    const question = await db.careMessage.create({
      data: { patientId, senderId: auth.user.id, kind: 'ASSISTANT_QUESTION', body },
      include: { sender: { select: senderSelect } },
    });
    const reply = await companionReply(patientId, body);
    const answer = await db.careMessage.create({
      data: {
        patientId,
        senderId: null,
        kind: 'ASSISTANT_REPLY',
        escalated: reply.escalated,
        model: reply.model,
        body: reply.body,
      },
      include: { sender: { select: senderSelect } },
    });
    if (reply.escalated) {
      // Flag the question too, so it stands out in the clinician's thread
      await db.careMessage.update({ where: { id: question.id }, data: { escalated: true } });
      question.escalated = true;
    }
    await markThreadRead(patientId, auth.user.id, answer.createdAt);

    return NextResponse.json(
      { messages: [messageDTO(question, auth.user.id), messageDTO(answer, auth.user.id)], escalated: reply.escalated },
      { status: 201 }
    );
  } catch (error) {
    return serverError('AI assistant POST error', error);
  }
}
