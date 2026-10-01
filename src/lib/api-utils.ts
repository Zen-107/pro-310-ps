import { NextResponse } from 'next/server';

export const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status });
export const notFound = (what = 'Not found') => jsonError(what, 404);
export const badRequest = (message: string) => jsonError(message, 400);

/** Parse a JSON body; null when the body is missing or malformed. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as T) : null;
  } catch {
    return null;
  }
}

export const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function isIntInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

export function optionalString(v: unknown, maxLength = 2000): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return typeof v === 'string' ? v.trim().slice(0, maxLength) : undefined;
}

/** Log and return a 500 with a generic message. */
export function serverError(context: string, error: unknown) {
  console.error(`${context}:`, error);
  return jsonError('Internal server error', 500);
}
