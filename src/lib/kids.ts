// Kids UI wording and reward rules (docs/KIDS-ART-UI.md §8).
// Children see stars and stickers, never percentages.

/** Accuracy % → 1–3 stars */
export function starsFor(accuracy: number): 1 | 2 | 3 {
  if (accuracy >= 85) return 3;
  if (accuracy >= 60) return 2;
  return 1;
}

/** Child-facing sticker names for the BADGES ids in lib/exercises-data.ts */
export const KIDS_STICKERS: Record<string, { name: string; hint: string }> = {
  first_session: { name: 'ก้าวแรก', hint: 'เล่นรอบแรก' },
  streak_3: { name: 'ไฟติด 3 วัน', hint: 'เล่นติดกัน 3 วัน' },
  streak_7: { name: 'ครบสัปดาห์', hint: 'เล่นติดกัน 7 วัน' },
  streak_30: { name: 'ซูเปอร์ฮีโร่ 30 วัน', hint: 'เล่นติดกัน 30 วัน' },
  sessions_10: { name: 'เล่นครบ 10 รอบ', hint: 'เล่นให้ครบ 10 รอบ' },
  sessions_50: { name: 'ราชาแห่งการยืด', hint: 'เล่นให้ครบ 50 รอบ' },
  perfect_score: { name: 'ท่าเป๊ะ!', hint: 'ได้ 3 ดาวแบบเป๊ะ ๆ' },
  all_categories: { name: 'ยืดครบทั้งตัว', hint: 'เล่นครบทุกส่วนของร่างกาย' },
};

export function kidsGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'อรุณสวัสดิ์';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

/** Short first name / nickname for speech bubbles */
export function nickname(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] || 'นักผจญภัย';
}
