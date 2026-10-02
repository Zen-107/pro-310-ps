import { createReadStream, promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { sessionScope } from '@/lib/access';
import { badRequest, isIntInRange, jsonError, notFound, serverError } from '@/lib/api-utils';
import { hasValidVideoConsent } from '@/lib/consent';
import {
  VIDEO_MAX_CHUNK_BYTES,
  VIDEO_MAX_TOTAL_BYTES,
  VIDEO_MIME_TYPES,
  appendChunk,
  baseMimeType,
  videoPath,
} from '@/lib/video-storage';

type Params = { params: Promise<{ id: string }> };

type Pause = { at: number; resumedAt: number };

/** X-Video-Pauses header → validated pause intervals (sent with the final chunk) */
function parsePauses(header: string | null): Pause[] | null {
  if (!header) return null;
  try {
    const list = JSON.parse(header);
    if (!Array.isArray(list) || list.length > 200) return null;
    const ok = list.every(
      (p) => p && Number.isFinite(p.at) && Number.isFinite(p.resumedAt) && p.resumedAt >= p.at
    );
    return ok ? list.map((p) => ({ at: p.at, resumedAt: p.resumedAt })) : null;
  } catch {
    return null;
  }
}

// Upload one chunk of the session video (owning patient, with video consent).
// Query: seq (0, 1, 2… in order), final=1 on the last chunk, startedAt=epoch ms
// (seq 0 only). Body: raw MediaRecorder bytes, Content-Type video/webm|mp4.
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  const { id: sessionId } = await params;
  const q = req.nextUrl.searchParams;
  const seq = Number(q.get('seq'));
  const final = q.get('final') === '1';
  if (!isIntInRange(seq, 0, 100_000)) return badRequest('seq must be a non-negative integer');
  const mime = baseMimeType(req.headers.get('content-type'));
  if (!mime) return badRequest(`Content-Type must be one of ${Object.keys(VIDEO_MIME_TYPES).join(', ')}`);

  try {
    const session = await db.exerciseSession.findFirst({
      where: { id: sessionId, patientId: auth.user.patientId! },
      select: {
        id: true,
        review: { select: { id: true } },
        video: true,
        patient: { select: { videoConsentAt: true, videoConsentVersion: true } },
      },
    });
    if (!session) return notFound('Session not found');
    // Consent is enforced here, not only in the UI
    if (!hasValidVideoConsent(session.patient)) return jsonError('Video recording requires the patient’s video consent', 403);
    if (session.review) return jsonError('Session has been reviewed and is locked', 409);
    if (session.video?.completedAt) return jsonError('Video already finalized', 409);

    const expected = session.video?.chunkCount ?? 0;
    if (seq < expected) return NextResponse.json({ seq, duplicate: true }); // retried chunk
    if (seq !== expected) return jsonError(`Expected chunk ${expected}`, 409);

    const data = new Uint8Array(await req.arrayBuffer());
    if (data.byteLength > VIDEO_MAX_CHUNK_BYTES) return jsonError('Chunk too large', 413);
    if ((session.video?.sizeBytes ?? 0) + data.byteLength > VIDEO_MAX_TOTAL_BYTES) return jsonError('Video too large', 413);

    let video = session.video;
    if (!video) {
      const startedAt = Number(q.get('startedAt'));
      if (!Number.isFinite(startedAt) || startedAt <= 0) return badRequest('startedAt (epoch ms) is required on the first chunk');
      video = await db.sessionVideo.create({
        data: {
          sessionId,
          storageKey: `${sessionId}.${VIDEO_MIME_TYPES[mime]}`,
          mimeType: mime,
          recordStartAt: new Date(startedAt),
          consentVersion: session.patient.videoConsentVersion!,
        },
      });
    } else if (video.mimeType !== mime) {
      return badRequest('Content-Type changed between chunks');
    }

    if (data.byteLength) await appendChunk(video.storageKey, data, seq === 0);
    await db.sessionVideo.update({
      where: { id: video.id },
      data: {
        chunkCount: seq + 1,
        sizeBytes: { increment: data.byteLength },
        ...(final ? { completedAt: new Date(), pauses: parsePauses(req.headers.get('x-video-pauses')) ?? [] } : {}),
      },
    });
    return NextResponse.json({ seq, final });
  } catch (error) {
    return serverError('Session video POST error', error);
  }
}

// Stream the session video (care team or owning patient). Supports Range
// requests so the browser can seek. ?meta=1 returns metadata only.
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN', 'PATIENT']);
  if ('response' in auth) return auth.response;
  const { id } = await params;

  try {
    const session = await db.exerciseSession.findFirst({
      where: { AND: [{ id }, sessionScope(auth.user)] },
      select: { video: true },
    });
    const video = session?.video;
    if (!video || video.sizeBytes === 0) return notFound('No video for this session');

    if (req.nextUrl.searchParams.get('meta') === '1') {
      return NextResponse.json({
        mimeType: video.mimeType,
        sizeBytes: video.sizeBytes,
        recordStartAt: video.recordStartAt.toISOString(),
        pauses: video.pauses,
        complete: !!video.completedAt,
        consentVersion: video.consentVersion,
      });
    }

    const file = videoPath(video.storageKey);
    const { size } = await fs.stat(file);
    const headers: Record<string, string> = {
      'Content-Type': video.mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
    };

    const range = req.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
      }
      const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
      return new NextResponse(stream, {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
      });
    }
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new NextResponse(stream, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
  } catch (error) {
    return serverError('Session video GET error', error);
  }
}
