// Server side of the kid login (codes, picture hashes, switch tickets).
// Kids sign in without email or typing a password:
//  1. kid code (6 characters, printed on a card by the teacher) + 3 pictures in order
//  2. an adult switches to the child ("play as …") with a signed one-time ticket;
//     going back needs the adult's 4-digit PIN, again through a ticket.
// Tickets are HMAC-signed with NEXTAUTH_SECRET and expire after 60 seconds.
// Browser-safe formats live in src/lib/kid-codes.ts (re-exported here).

import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { authSecret } from '@/lib/auth-secret';
import { hashPassword, verifyPassword } from '@/lib/password';
import { CODE_ALPHABET, KID_CODE_LENGTH, PICTURE_PIN_LENGTH, PICTURES, type PictureId } from '@/lib/kid-codes';

export * from '@/lib/kid-codes';

export function newCode(length = KID_CODE_LENGTH): string {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

export function randomPicturePin(): PictureId[] {
  return Array.from({ length: PICTURE_PIN_LENGTH }, () => PICTURES[randomInt(PICTURES.length)].id);
}

export const hashPicturePin = (pin: PictureId[]) => hashPassword(pin.join('-'));
export const verifyPicturePin = (pin: PictureId[], stored: string) => verifyPassword(pin.join('-'), stored);

/** Wrong picture attempts before the code locks, and for how long */
export const MAX_PIN_FAILS = 5;
export const PIN_LOCK_MS = 10 * 60_000;

// ─── Switch tickets ──────────────────────────────────────────────────
export interface SwitchTicket {
  /** User to sign in as */
  userId: string;
  /** Set when an adult switched to a child: the adult to return to */
  returnUserId?: string;
  exp: number;
  nonce: string;
}

const TICKET_TTL_MS = 60_000;
const usedNonces = new Map<string, number>(); // single-use within the process

function secret(): string {
  const s = authSecret();
  if (!s) throw new Error('NEXTAUTH_SECRET (or DATABASE_URL) is not set');
  return s;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function createTicket(t: Omit<SwitchTicket, 'exp' | 'nonce'>): string {
  const payload = Buffer.from(
    JSON.stringify({ ...t, exp: Date.now() + TICKET_TTL_MS, nonce: randomBytes(12).toString('base64url') })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Verifies signature and expiry and burns the nonce; null when invalid */
export function readTicket(ticket: unknown): SwitchTicket | null {
  if (typeof ticket !== 'string') return null;
  const [payload, mac] = ticket.split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  let t: SwitchTicket;
  try {
    t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const now = Date.now();
  if (typeof t.userId !== 'string' || typeof t.exp !== 'number' || t.exp < now || usedNonces.has(t.nonce)) return null;
  for (const [n, exp] of usedNonces) if (exp < now) usedNonces.delete(n);
  usedNonces.set(t.nonce, t.exp);
  return t;
}
