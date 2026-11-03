import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { badRequest, jsonError, optionalString, readJson, serverError } from '@/lib/api-utils';
import { hashPassword } from '@/lib/password';
import { childForLinkCode } from '@/lib/parents';

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parent sign-up (no session): { linkCode, name, email, password }. The link
 * code from the teacher's card proves the parent knows the child; the new
 * account joins the child's school and is linked as GUARDIAN. The parent then
 * signs in and accepts the terms for the child.
 */
export async function POST(req: Request) {
  const body = await readJson(req);
  if (!body) return badRequest('Invalid JSON body');
  const name = optionalString(body.name, 120);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name) return badRequest('name is required');
  if (!EMAIL.test(email)) return badRequest('email is invalid');
  if (password.length < MIN_PASSWORD) return badRequest(`password must be at least ${MIN_PASSWORD} characters`);

  try {
    const child = await childForLinkCode(body.linkCode);
    if (!child) return jsonError('Link code not found', 404);
    if (await db.user.findUnique({ where: { email } })) return jsonError('Email already in use', 409);
    await db.clinician.create({
      data: {
        title: 'PARENT',
        organization: { connect: { id: child.organizationId } },
        user: { create: { email, name, role: 'PARENT', passwordHash: await hashPassword(password) } },
        careAssignments: { create: { patientId: child.id, role: 'GUARDIAN' } },
      },
    });
    return NextResponse.json({ email, childName: child.nickname || child.name }, { status: 201 });
  } catch (error) {
    return serverError('Parent register error', error);
  }
}
