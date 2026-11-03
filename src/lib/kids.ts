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

/** Mascot colours a child can have as their avatar (Patient.avatar) */
export const AVATARS = [
  { id: 'peach', body: '#FFB38A', belly: '#FFE7D6' },
  { id: 'sky', body: '#8CCBFF', belly: '#E3F2FF' },
  { id: 'mint', body: '#8EDDB4', belly: '#E4F8EC' },
  { id: 'grape', body: '#C3A8F5', belly: '#F1EAFF' },
  { id: 'sun', body: '#FFD66B', belly: '#FFF5D1' },
  { id: 'coral', body: '#FF9C94', belly: '#FFE6E3' },
] as const;
export type AvatarId = (typeof AVATARS)[number]['id'];
export const avatarColors = (id: string | null | undefined) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];

/**
 * Child-facing name and steps per catalogue exercise (slug). The clinical
 * name, description and full instructions stay for adults. `forKids: false`
 * hides an exercise from the teacher's library (lying-down rehab moves).
 */
export const KID_EXERCISES: Record<string, { name: string; steps: string[]; forKids?: false }> = {
  ex_seated_heel_slides: { name: 'ไถส้นเท้า', steps: ['นอนหงาย ขาเหยียดตรง', 'ไถส้นเท้าเข้าหาก้น', 'ไถกลับไปขาตรง'], forKids: false },
  ex_cross_body_shoulder_stretch: { name: 'กอดแขนยืดไหล่', steps: ['ยืนตรง หันหน้าหากล้อง', 'พาดแขนข้ามหน้าอก แขนอีกข้างช่วยกอด', 'นับ 1 ถึง 10 แล้วสลับข้าง'] },
  ex_shoulder_abduction: { name: 'กางปีกนกอินทรี', steps: ['ยืนตรง แขนแนบตัว', 'กางแขนออกช้า ๆ จนตรงกับไหล่', 'ค้างไว้นิดนึง แล้วหุบปีกลง'] },
  ex_wall_squat: { name: 'นั่งเก้าอี้ล่องหน', steps: ['ยืนหลังชิดผนัง', 'ไถตัวลงเหมือนนั่งเก้าอี้', 'ค้างไว้ แล้วไถขึ้นช้า ๆ'] },
  ex_arm_circles: { name: 'หมุนแขนกังหัน', steps: ['กางแขนสองข้างตรงกับไหล่', 'หมุนแขนวงเล็ก แล้วค่อย ๆ วงใหญ่', 'หมุนกลับอีกทาง'] },
  ex_trunk_lateral_flexion: { name: 'ต้นไม้เอนลม', steps: ['ยืนเท้าห่างกันนิดนึง ชูแขนขึ้นฟ้า', 'เอนตัวไปข้าง ๆ เหมือนต้นไม้โดนลม', 'กลับมาตรง แล้วเอนอีกข้าง'] },
  ex_trunk_rotation: { name: 'บิดตัวหมุนเกลียว', steps: ['ยืนตรง กอดอก', 'บิดตัวไปข้าง ๆ สะโพกอยู่กับที่', 'กลับมาตรงกลาง แล้วบิดอีกข้าง'] },
  ex_squat: { name: 'ย่อตัวกบน้อย', steps: ['ยืนเท้ากว้างเท่าไหล่ หันข้างให้กล้อง', 'ยื่นแขนไปข้างหน้า ย่อตัวลงเหมือนนั่ง', 'ดันตัวขึ้นยืนตรง'] },
  ex_forward_lunge: { name: 'ก้าวยาวอัศวิน', steps: ['ยืนตรง หันข้างให้กล้อง', 'ก้าวขาไปข้างหน้ายาว ๆ แล้วย่อลง', 'ดันกลับมายืน แล้วสลับขา'] },
  ex_side_lunge: { name: 'ปูเดินข้าง', steps: ['ยืนตรง หันหน้าหากล้อง', 'ก้าวขาออกข้าง ๆ แล้วย่อเข่าข้างนั้น', 'ดันกลับมายืน แล้วสลับข้าง'] },
  ex_standing_hip_abduction: { name: 'เตะขานักเต้น', steps: ['ยืนตรง จับเก้าอี้ไว้ได้', 'กางขาออกข้าง ๆ ขาเหยียดตรง', 'ค้างไว้นิดนึง แล้วค่อย ๆ ลง'] },
};

/** Child-facing name and steps of an exercise, falling back to the catalogue text */
export function kidExercise(slug: string, fallback: { nameTh: string; instructions: string[] }) {
  const k = KID_EXERCISES[slug];
  return { name: k?.name ?? fallback.nameTh, steps: k?.steps ?? fallback.instructions.slice(0, 3), forKids: k?.forKids ?? true };
}
