import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-guard';
import { badRequest, jsonError, readJson, serverError } from '@/lib/api-utils';
import { childForLinkCode, linkParent } from '@/lib/parents';

// Link another child to the signed-in parent: { linkCode }
export async function POST(req: Request) {
  const auth = await requireApiUser(['PARENT']);
  if ('response' in auth) return auth.response;
  const body = await readJson(req);
  if (!body?.linkCode) return badRequest('linkCode is required');
  try {
    const child = await childForLinkCode(body.linkCode);
    // Children from another school are not linkable (organization boundary)
    if (!child || child.organizationId !== auth.user.organizationId) return jsonError('Link code not found', 404);
    await linkParent(auth.user.clinicianId!, child.id);
    return NextResponse.json({ id: child.id, name: child.nickname || child.name });
  } catch (error) {
    return serverError('Parent link error', error);
  }
}
