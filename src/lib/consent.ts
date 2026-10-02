// Video-recording consent shown to the patient before any video is captured.
// Bump VIDEO_CONSENT_VERSION whenever the text changes: consent given to an
// older version no longer counts, so the patient is asked again.

export const VIDEO_CONSENT_VERSION = 'video-consent-th-v1';

export const VIDEO_CONSENT_TITLE = 'ความยินยอมให้บันทึกวิดีโอการฝึกกายภาพบำบัด';

export const VIDEO_CONSENT_POINTS = [
  'ระบบจะบันทึกวิดีโอจากกล้องระหว่างการฝึก (ไม่บันทึกเสียง) เพื่อให้แพทย์และนักกายภาพบำบัดในทีมผู้ดูแลของคุณตรวจสอบท่าทางย้อนหลัง',
  'วิดีโอเป็นข้อมูลสุขภาพซึ่งเป็นข้อมูลส่วนบุคคลที่มีความอ่อนไหวตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) จะเข้าถึงได้เฉพาะคุณและทีมผู้ดูแลของคุณเท่านั้น และจัดเก็บเป็นส่วนหนึ่งของเวชระเบียน',
  'ระหว่างบันทึกจะมีสัญลักษณ์ REC แสดงบนหน้าจอ และคุณปิดการบันทึกได้ในแต่ละครั้งก่อนเริ่มฝึก',
  'คุณถอนความยินยอมได้ทุกเมื่อ ระบบจะหยุดบันทึกวิดีโอในการฝึกครั้งต่อไปทันที หากต้องการให้ลบวิดีโอที่บันทึกไว้แล้ว ให้ติดต่อทีมผู้ดูแลของคุณ',
  'การไม่ให้ความยินยอมไม่มีผลต่อการรักษา คุณยังฝึกและได้รับการติดตามผลจากข้อมูลมุมข้อต่อได้ตามปกติ',
];

export function hasValidVideoConsent(p: { videoConsentAt: Date | string | null; videoConsentVersion: string | null } | null | undefined): boolean {
  return !!p?.videoConsentAt && p.videoConsentVersion === VIDEO_CONSENT_VERSION;
}
