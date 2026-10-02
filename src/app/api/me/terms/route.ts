import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { hasAcceptedTerms, TERMS_VERSION } from '@/lib/terms';

// Terms of use / PDPA consent from the entry popup. The only API route that
// works before the terms are accepted.

export async function GET() {
  const auth = await requireApiUser(undefined, { allowWithoutTerms: true });
  if ('response' in auth) return auth.response;
  const u = await db.user.findUnique({
    where: { id: auth.user.id },
    select: { termsVersion: true, termsAcceptedAt: true },
  });
  return NextResponse.json({
    version: TERMS_VERSION,
    accepted: hasAcceptedTerms(u),
    acceptedVersion: u?.termsVersion ?? null,
    acceptedAt: u?.termsAcceptedAt ?? null,
  });
}

/** Body: { accept: true, version } — version must be the one the user was shown */
export async function POST(request: Request) {
  const auth = await requireApiUser(undefined, { allowWithoutTerms: true });
  if ('response' in auth) return auth.response;

  const body = await request.json().catch(() => null);
  if (body?.accept !== true) {
    return NextResponse.json({ error: 'accept must be true' }, { status: 400 });
  }
  if (body.version !== TERMS_VERSION) {
    // The text changed while the popup was open: show the new version
    return NextResponse.json({ error: 'Terms version changed', version: TERMS_VERSION }, { status: 409 });
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: auth.user.id },
      data: { termsVersion: TERMS_VERSION, termsAcceptedAt: now },
    });
    // Patients: also record the general PDPA consent on the patient profile
    if (auth.user.role === 'PATIENT') {
      await tx.patient.updateMany({ where: { userId: auth.user.id }, data: { consentAt: now } });
    }
  });
  return NextResponse.json({ accepted: true, version: TERMS_VERSION, acceptedAt: now });
}
