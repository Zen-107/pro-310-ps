import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';

// Current user's account + clinician/patient profile
export async function GET() {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;

  try {
    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        adultPinHash: true,
        clinician: {
          select: { id: true, title: true, specialty: true, organization: { select: { id: true, name: true, type: true } } },
        },
        patient: {
          select: {
            id: true,
            name: true,
            dateOfBirth: true,
            gender: true,
            nickname: true,
            avatar: true,
            consentAt: true,
            organization: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const { adultPinHash, ...rest } = user;
    // Kid mode: who switched to this child (leaving needs their PIN)
    return NextResponse.json({ ...rest, hasPin: !!adultPinHash, returnName: auth.user.returnName });
  } catch (error) {
    console.error('Me GET error:', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
