import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, readJson, serverError } from '@/lib/api-utils';
import { VIDEO_CONSENT_VERSION, hasValidVideoConsent } from '@/lib/consent';
import { deleteVideoFile } from '@/lib/video-storage';

// Patient's own video-recording consent. GET → status; POST { consent: boolean }
// gives (current version) or withdraws consent and deletes all recorded videos.
export async function GET() {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  if (!auth.user.patientId) return jsonError('No patient profile', 403);
  try {
    const p = await db.patient.findUnique({
      where: { id: auth.user.patientId },
      select: { videoConsentAt: true, videoConsentVersion: true },
    });
    return NextResponse.json({
      consented: hasValidVideoConsent(p),
      consentedAt: p?.videoConsentAt?.toISOString() ?? null,
      version: p?.videoConsentVersion ?? null,
      currentVersion: VIDEO_CONSENT_VERSION,
    });
  } catch (error) {
    return serverError('Video consent GET error', error);
  }
}

export async function POST(req: Request) {
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;
  if (!auth.user.patientId) return jsonError('No patient profile', 403);
  const body = await readJson<{ consent?: unknown }>(req);
  if (!body || typeof body.consent !== 'boolean') return badRequest('Body must be { consent: boolean }');
  try {
    const p = await db.patient.update({
      where: { id: auth.user.patientId },
      data: body.consent
        ? { videoConsentAt: new Date(), videoConsentVersion: VIDEO_CONSENT_VERSION }
        : { videoConsentAt: null, videoConsentVersion: null },
      select: { videoConsentAt: true, videoConsentVersion: true },
    });
    // Withdrawal also erases every video already recorded for this patient
    // (consent is cleared first, so no new upload can start meanwhile)
    let videosDeleted = 0;
    if (!body.consent) {
      const where = { session: { patientId: auth.user.patientId } };
      const videos = await db.sessionVideo.findMany({ where, select: { storageKey: true } });
      await db.sessionVideo.deleteMany({ where });
      await Promise.all(videos.map((v) => deleteVideoFile(v.storageKey).catch(() => {})));
      videosDeleted = videos.length;
    }
    return NextResponse.json({
      videosDeleted,
      consented: hasValidVideoConsent(p),
      consentedAt: p.videoConsentAt?.toISOString() ?? null,
      version: p.videoConsentVersion,
      currentVersion: VIDEO_CONSENT_VERSION,
    });
  } catch (error) {
    return serverError('Video consent POST error', error);
  }
}
