import { NextRequest } from 'next/server';

// Helpers for calling App Router route handlers directly.

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: 'CLINICIAN' | 'PATIENT' | 'ADMIN';
  clinicianId: string | null;
  patientId: string | null;
  organizationId: string | null;
}

const g = globalThis as { __testSession?: unknown; __integrationPreloaded?: boolean };

/** Sign in as `user` for subsequent handler calls (null = signed out) */
export function signInAs(user: TestUser | null) {
  g.__testSession = user ? { user, expires: new Date(Date.now() + 3_600_000).toISOString() } : null;
}

export const integrationEnabled = () => !!g.__integrationPreloaded && !!process.env.TEST_DATABASE_URL;

export function req(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const { body, ...rest } = init;
  return new NextRequest(`http://localhost${path}`, {
    ...rest,
    body: body === undefined ? undefined : typeof body === 'string' || body instanceof Uint8Array ? (body as BodyInit) : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

export async function json(res: Response) {
  return { status: res.status, body: await res.json().catch(() => null) };
}
