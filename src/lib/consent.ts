// Video-recording consent, given by a parent for their child before any
// video is captured (POST /api/kids/[id]/consent { video }).
// Bump VIDEO_CONSENT_VERSION whenever the text changes: consent given to an
// older version no longer counts, so the parent is asked again.

export const VIDEO_CONSENT_VERSION = 'video-consent-kids-th-v1';

export const VIDEO_CONSENT_TITLE = 'ความยินยอมให้บันทึกวิดีโอขณะเด็กเล่น';

export const VIDEO_CONSENT_POINTS = [
  'ระบบจะบันทึกวิดีโอจากกล้องระหว่างที่เด็กเล่น (ไม่บันทึกเสียง) เพื่อให้คุณครูและผู้เชี่ยวชาญดูท่าทางย้อนหลังและให้คำแนะนำได้ถูกต้อง',
  'วิดีโอของเด็กเป็นข้อมูลส่วนบุคคลที่ต้องดูแลเป็นพิเศษ เข้าถึงได้เฉพาะผู้ปกครอง คุณครูประจำชั้น และผู้เชี่ยวชาญที่ได้รับมอบหมายเท่านั้น',
  'ระหว่างบันทึกจะมีสัญลักษณ์ REC แสดงบนหน้าจอ',
  'ผู้ปกครองถอนความยินยอมได้ทุกเมื่อ เมื่อถอนแล้วระบบจะลบวิดีโอที่บันทึกไว้ทั้งหมดอย่างถาวร',
  'ถ้าไม่ยินยอม เด็กยังเล่นได้ตามปกติ ระบบใช้เฉพาะตำแหน่งข้อต่อจากกล้อง (ไม่มีภาพ) ในการนับและตรวจท่า',
];

export function hasValidVideoConsent(p: { videoConsentAt: Date | string | null; videoConsentVersion: string | null } | null | undefined): boolean {
  return !!p?.videoConsentAt && p.videoConsentVersion === VIDEO_CONSENT_VERSION;
}
