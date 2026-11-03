import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { badRequest, jsonError, notFound, readJson, serverError } from '@/lib/api-utils';
import { hasValidVideoConsent, VIDEO_CONSENT_VERSION } from '@/lib/consent';
import { childHasConsent, TERMS_VERSION } from '@/lib/terms';
import { deleteVideoFile } from '@/lib/video-storage';

type Params = { params: Promise<{ id: string }> };

const statusSelect = { consentVersion: true, consentAt: true, schoolConsentAt: true, videoConsentAt: true, videoConsentVersion: true } as const;

function consentStatus(p: { consentVersion: string | null; consentAt: Date | null; schoolConsentAt: Date | null; videoConsentAt: Date | null; videoConsentVersion: string | null }) {
  return {
    canPlay: childHasConsent(p),
    terms: p.consentVersion === TERMS_VERSION,
    termsAt: p.consentAt?.toISOString() ?? null,
    schoolConsent: p.schoolConsentAt !== null,
    video: hasValidVideoConsent(p),
    videoAt: p.videoConsentAt?.toISOString() ?? null,
    termsVersion: TERMS_VERSION,
    videoVersion: VIDEO_CONSENT_VERSION,
  };
}

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['PARENT', 'TEACHER']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  if (!(await canAccessPatient(auth.user, id))) return notFound('Child not found');
  const p = await db.patient.findUniqueOrThrow({ where: { id }, select: statusSelect });
  return NextResponse.json(consentStatus(p));
}

/**
 * Consent for a child.
 *  PARENT:  { terms: true, version } — accept the current terms for the child (lets the child play)
 *           { terms: false }          — withdraw (child can no longer play)
 *           { video: boolean }        — video recording; withdrawing deletes every recorded video
 *  TEACHER: { schoolConsent: boolean } — paper consent from home received by the school
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(['PARENT', 'TEACHER']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');
  const isParent = auth.user.role === 'PARENT';

  try {
    if (!(await canAccessPatient(auth.user, id))) return notFound('Child not found');
    const data: Record<string, unknown> = {};

    if (body.terms !== undefined) {
      if (!isParent) return jsonError('Only a parent can accept the terms for a child', 403);
      if (body.terms === true) {
        if (body.version !== TERMS_VERSION) return NextResponse.json({ error: 'Terms version changed', version: TERMS_VERSION }, { status: 409 });
        Object.assign(data, { consentVersion: TERMS_VERSION, consentAt: new Date() });
      } else if (body.terms === false) {
        Object.assign(data, { consentVersion: null, consentAt: null });
      } else return badRequest('terms must be a boolean');
    }
    if (body.video !== undefined) {
      if (!isParent) return jsonError('Only a parent can decide on video recording', 403);
      if (typeof body.video !== 'boolean') return badRequest('video must be a boolean');
      Object.assign(data, body.video
        ? { videoConsentAt: new Date(), videoConsentVersion: VIDEO_CONSENT_VERSION }
        : { videoConsentAt: null, videoConsentVersion: null });
    }
    if (body.schoolConsent !== undefined) {
      if (isParent) return jsonError('School consent is recorded by the teacher', 403);
      if (typeof body.schoolConsent !== 'boolean') return badRequest('schoolConsent must be a boolean');
      data.schoolConsentAt = body.schoolConsent ? new Date() : null;
    }
    if (Object.keys(data).length === 0) return badRequest('Nothing to change');

    const p = await db.patient.update({ where: { id }, data, select: statusSelect });

    // Withdrawing video consent erases every video already recorded for the child
    // (consent is cleared first, so no new upload can start meanwhile)
    let videosDeleted = 0;
    if (body.video === false) {
      const where = { session: { patientId: id } };
      const videos = await db.sessionVideo.findMany({ where, select: { storageKey: true } });
      await db.sessionVideo.deleteMany({ where });
      await Promise.all(videos.map((v) => deleteVideoFile(v.storageKey).catch(() => {})));
      videosDeleted = videos.length;
    }
    return NextResponse.json({ ...consentStatus(p), videosDeleted });
  } catch (error) {
    return serverError('Kid consent POST error', error);
  }
}
