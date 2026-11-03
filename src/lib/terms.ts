import type { UserRole } from '@prisma/client';

// Terms of use and PDPA consent shown in the blocking popup on first entry.
// Bump TERMS_VERSION whenever the text changes: every user must accept again.
// Video recording has its own, separate consent (lib/consent.ts).

// Kids branch: adults accept for themselves; a child never sees legal text —
// a parent accepts on the child's behalf (Patient.consentVersion), or the
// school records paper consent (Patient.schoolConsentAt).
export const TERMS_VERSION = 'terms-kids-th-v1';

export const TERMS_TITLE = 'ข้อตกลงการใช้งานและการยินยอมให้ประมวลผลข้อมูลส่วนบุคคล';

export interface TermsSection {
  heading: string;
  points: string[];
}

const COMMON: TermsSection[] = [
  {
    heading: 'วัตถุประสงค์ของระบบ',
    points: [
      'ระบบนี้ช่วยให้เด็กยืดเหยียดและขยับร่างกายเป็นประจำ เพื่อดูแลและป้องกันปัญหาท่าทางและความตึงของกล้ามเนื้อ ภายใต้การดูแลของคุณครูและผู้ปกครอง',
      'ระบบนี้ไม่ใช่การรักษาหรือการวินิจฉัยโรค หากเด็กมีอาการเจ็บปวดหรือบาดเจ็บ ควรพบแพทย์หรือนักกายภาพบำบัด',
      'ผลการวัดท่าทางจากกล้องและคำแนะนำจากผู้ช่วย AI เป็นข้อมูลประกอบเท่านั้น',
    ],
  },
  {
    heading: 'ข้อมูลที่เก็บและการประมวลผล',
    points: [
      'ชื่อเล่น ชั้นเรียน ภารกิจที่ได้รับ ผลการเล่น (จำนวนครั้ง ดาว มุมข้อต่อ) และข้อความระหว่างผู้ปกครอง คุณครู และผู้เชี่ยวชาญ',
      'ภาพจากกล้องถูกประมวลผลบนอุปกรณ์เพื่อหาตำแหน่งข้อต่อ ระบบบันทึกเฉพาะพิกัดข้อต่อ ส่วนวิดีโอจะบันทึกเฉพาะเมื่อผู้ปกครองให้ความยินยอมแยกต่างหาก',
      'ข้อความสำหรับคำแนะนำและเสียงพูดอาจถูกส่งไปประมวลผลยังผู้ให้บริการ AI และบริการแปลงข้อความเป็นเสียงภายนอก โดยไม่ส่งชื่อของเด็ก',
      'ข้อมูลของเด็กเข้าถึงได้เฉพาะผู้ปกครองที่เชื่อมบัญชี คุณครูประจำชั้น และผู้เชี่ยวชาญที่ได้รับมอบหมายเท่านั้น',
    ],
  },
  {
    heading: 'สิทธิของเจ้าของข้อมูล (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562)',
    points: [
      'ผู้ปกครองมีสิทธิขอเข้าถึง ขอสำเนา ขอแก้ไข ขอลบ หรือคัดค้านการประมวลผลข้อมูลของเด็ก และถอนความยินยอมได้ตลอดเวลาโดยติดต่อโรงเรียน',
      'การถอนความยินยอมไม่กระทบการประมวลผลที่ทำไปแล้วก่อนการถอน แต่เด็กจะไม่สามารถใช้งานระบบต่อได้',
    ],
  },
];

const PARENT: TermsSection = {
  heading: 'ผู้ปกครองให้ความยินยอมแทนเด็ก',
  points: [
    'ท่านเป็นบิดา มารดา หรือผู้ปกครองตามกฎหมายของเด็กที่เชื่อมกับบัญชีนี้ และให้ความยินยอมแทนเด็กตามมาตรา 20 พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล',
    'ให้เด็กเล่นในพื้นที่ปลอดภัย มีพื้นที่ว่างรอบตัว และมีผู้ใหญ่อยู่ใกล้ ๆ',
    'ให้เด็กหยุดทันทีหากเจ็บ เวียนศีรษะ หรือหายใจลำบาก กรณีฉุกเฉินโทร 1669',
  ],
};

const TEACHER: TermsSection = {
  heading: 'หน้าที่ของคุณครู',
  points: [
    'ใช้ข้อมูลของนักเรียนเฉพาะเพื่อการดูแลกิจกรรมยืดเหยียดของนักเรียนในชั้นของท่าน',
    'ให้นักเรียนเล่นเฉพาะเมื่อผู้ปกครองให้ความยินยอมแล้ว หรือโรงเรียนได้รับหนังสือยินยอมเป็นกระดาษ',
    'ไม่เปิดเผยหรือส่งต่อข้อมูลของนักเรียนนอกเหนือจากที่จำเป็น',
  ],
};

const EXPERT: TermsSection = {
  heading: 'หน้าที่ของผู้เชี่ยวชาญ',
  points: [
    'ดูแลคลังท่าและตรวจผลการเล่นที่ระบบแจ้งเตือน เพื่อให้คำแนะนำแก่คุณครูและผู้ปกครอง',
    'ตรวจสอบผลการวัดและสรุปที่ร่างโดย AI ก่อนนำไปใช้ให้คำแนะนำ',
    'รักษาความลับของข้อมูลเด็กตามจรรยาบรรณวิชาชีพ',
  ],
};

const ROLE_SECTION: Partial<Record<UserRole, TermsSection>> = {
  PARENT,
  TEACHER,
  CLINICIAN: EXPERT,
  PATIENT: PARENT, // children never see the popup; kept for completeness
};

export function termsFor(role: UserRole): TermsSection[] {
  const own = ROLE_SECTION[role];
  return own ? [COMMON[0], own, ...COMMON.slice(1)] : COMMON;
}

export const TERMS_ACCEPT_LABEL =
  'ข้าพเจ้าได้อ่านและเข้าใจข้อตกลงข้างต้นแล้ว และยินยอมให้ประมวลผลข้อมูลส่วนบุคคลตามวัตถุประสงค์ที่ระบุ';

/** A child may use the app when a parent accepted the current terms for them, or the school has paper consent */
export const childHasConsent = (p: { consentVersion: string | null; schoolConsentAt: Date | null } | null | undefined) =>
  !!p && (p.consentVersion === TERMS_VERSION || p.schoolConsentAt !== null);

export const hasAcceptedTerms = (u: { termsVersion: string | null } | null | undefined) =>
  u?.termsVersion === TERMS_VERSION;
