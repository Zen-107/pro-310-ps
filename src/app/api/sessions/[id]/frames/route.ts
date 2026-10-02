import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { sessionScope } from '@/lib/access';
import { badRequest, isIntInRange, jsonError, notFound, readJson, serverError } from '@/lib/api-utils';
import { JOINT_FORMULAS } from '@/lib/joint-formulas';
import {
  REPLAY_FPS,
  REPLAY_LANDMARKS,
  REPLAY_MAX_CHUNKS,
  REPLAY_MAX_FRAMES_PER_CHUNK,
  isReplayFrame,
  type ReplayFrame,
} from '@/lib/replay';

type Params = { params: Promise<{ id: string }> };

const knownMeasurement = (k: string) => k in JOINT_FORMULAS;

// Upload one chunk of recorded pose frames (owning patient).
// Body: { seq: number, frames: ReplayFrame[] }. Re-sending a seq is a no-op.
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const { id: sessionId } = await params;
  const body = await readJson<{ seq?: unknown; frames?: unknown }>(req);
  if (!body) return badRequest('Invalid JSON body');
  if (!isIntInRange(body.seq, 0, REPLAY_MAX_CHUNKS - 1)) return badRequest(`seq must be an integer 0–${REPLAY_MAX_CHUNKS - 1}`);
  const frames = Array.isArray(body.frames) ? body.frames : null;
  if (!frames || frames.length === 0) return badRequest('frames must be a non-empty array');
  if (frames.length > REPLAY_MAX_FRAMES_PER_CHUNK) return jsonError(`At most ${REPLAY_MAX_FRAMES_PER_CHUNK} frames per chunk`, 413);
  if (!frames.every((f) => isReplayFrame(f, knownMeasurement))) {
    return badRequest(`Each frame needs t (epoch ms), s ('w'|'i'), p (${REPLAY_LANDMARKS.length}×[x,y,z,visibility]) and a (known measurements)`);
  }
  const sorted = (frames as ReplayFrame[]).sort((a, b) => a.t - b.t);

  try {
    const session = await db.exerciseSession.findFirst({
      where: { id: sessionId, patientId: auth.user.patientId! },
      select: { id: true, startedAt: true, review: { select: { id: true } } },
    });
    if (!session) return notFound('Session not found');
    if (session.review) return jsonError('Session has been reviewed and is locked', 409);
    // Frames must belong to this session's time span (small clock skew allowed)
    if (sorted[0].t < session.startedAt.getTime() - 60_000) return badRequest('Frames predate the session');

    await db.sessionFrameChunk.createMany({
      data: [{ sessionId, seq: body.seq, startedAt: new Date(sorted[0].t), frames: sorted as never }],
      skipDuplicates: true,
    });
    return NextResponse.json({ seq: body.seq, frames: sorted.length });
  } catch (error) {
    return serverError('Session frames POST error', error);
  }
}

// All recorded frames of a session, in time order (care team or owning patient)
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const { id } = await params;

  try {
    const session = await db.exerciseSession.findFirst({
      where: { AND: [{ id }, sessionScope(auth.user)] },
      select: { id: true, startedAt: true, endedAt: true },
    });
    if (!session) return notFound('Session not found');
    const chunks = await db.sessionFrameChunk.findMany({
      where: { sessionId: id },
      orderBy: { seq: 'asc' },
      select: { frames: true },
    });
    const frames = chunks.flatMap((c) => (Array.isArray(c.frames) ? (c.frames as unknown as ReplayFrame[]) : [])).sort((a, b) => a.t - b.t);
    return NextResponse.json({
      sessionId: id,
      fps: REPLAY_FPS,
      landmarks: REPLAY_LANDMARKS,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      frames,
    });
  } catch (error) {
    return serverError('Session frames GET error', error);
  }
}
