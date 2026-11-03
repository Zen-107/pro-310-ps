import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { badRequest, notFound, readJson, serverError } from '@/lib/api-utils';
import { hashPicturePin, isPicturePin, newCode, PARENT_CODE_LENGTH, randomPicturePin } from '@/lib/kid-login';
import { ASSIGNERS } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };
type Reset = 'pictures' | 'kidCode' | 'parentLinkCode';
const RESETS: Reset[] = ['pictures', 'kidCode', 'parentLinkCode'];

/**
 * New login codes for a child (class teacher): { reset: 'pictures' | 'kidCode' | 'parentLinkCode', pictures? }.
 * `pictures` lets the teacher choose the 3 pictures with the child; otherwise random.
 * Returns the new card values (pictures are shown only here).
 */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiUser(ASSIGNERS);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  const body = await readJson(req);
  const reset = body?.reset as Reset;
  if (!RESETS.includes(reset)) return badRequest(`reset must be one of ${RESETS.join(', ')}`);
  if (body?.pictures !== undefined && !isPicturePin(body.pictures)) return badRequest('pictures must be 3 picture ids');

  try {
    if (!(await canAccessPatient(auth.user, id))) return notFound('Child not found');
    const result: { kidCode?: string; pictures?: string[]; parentLinkCode?: string } = {};
    for (;;) {
      try {
        if (reset === 'pictures') {
          const pictures = isPicturePin(body?.pictures) ? body.pictures : randomPicturePin();
          await db.patient.update({
            where: { id },
            data: { picturePinHash: await hashPicturePin(pictures), pinFailCount: 0, pinLockedUntil: null },
          });
          result.pictures = pictures;
        } else if (reset === 'kidCode') {
          const p = await db.patient.update({ where: { id }, data: { kidCode: newCode(), pinFailCount: 0, pinLockedUntil: null } });
          result.kidCode = p.kidCode!;
        } else {
          const p = await db.patient.update({ where: { id }, data: { parentLinkCode: newCode(PARENT_CODE_LENGTH) } });
          result.parentLinkCode = p.parentLinkCode!;
        }
        break;
      } catch (e) {
        // Unique-code collision: try another code
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
    return NextResponse.json(result);
  } catch (error) {
    return serverError('Kid codes POST error', error);
  }
}
