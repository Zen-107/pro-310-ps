// Calendar dates for quests and streaks are evaluated in the clinic's timezone,
// so "today" is the same day for the patient and the server.
export const APP_TIMEZONE = 'Asia/Bangkok';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' of an instant in APP_TIMEZONE */
export function localDateString(date: Date = new Date()): string {
  return dayFormatter.format(date);
}

/** A 'YYYY-MM-DD' string as the Date Prisma stores in a @db.Date column */
export function dateOnly(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** 'YYYY-MM-DD' of a @db.Date value */
export function dateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(day: string): number {
  return dateOnly(day).getUTCDay();
}

export function addDays(day: string, delta: number): string {
  const d = dateOnly(day);
  d.setUTCDate(d.getUTCDate() + delta);
  return dateOnlyString(d);
}

export function isValidDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(dateOnly(value).getTime());
}

/** Whole years between a date of birth and now */
export function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
