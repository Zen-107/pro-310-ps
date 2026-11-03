import type { PictureId } from '@/lib/kid-codes';

// Demo accounts created by prisma/seed.ts. Listed on the login page in
// development only. Adult password: SEED_DEMO_PASSWORD (.env).

export const DEMO_ADULT_PIN = '1234';

export const DEMO_ADULTS = [
  { label: 'ผู้เชี่ยวชาญ', email: 'pt@demo.aiphysio.local' },
  { label: 'คุณครู ป.3/1', email: 'teacher1@demo.aiphysio.local' },
  { label: 'คุณครู ป.5/2', email: 'teacher2@demo.aiphysio.local' },
  { label: 'ผู้ปกครอง (ลูก 2 คน)', email: 'parent1@demo.aiphysio.local' },
  { label: 'ผู้ปกครอง', email: 'parent2@demo.aiphysio.local' },
] as const;

export const DEMO_KIDS: {
  nickname: string;
  name: string;
  classroom: 1 | 2;
  kidCode: string;
  parentLinkCode: string;
  pictures: readonly [PictureId, PictureId, PictureId];
  avatar: string;
  dob: string;
  gender: 'MALE' | 'FEMALE';
}[] = [
  { nickname: 'มะลิ', name: 'ด.ญ.มะลิ ใจสดใส', classroom: 1, kidCode: 'MEW234', parentLinkCode: 'MEWHAPPY', pictures: ['cat', 'dog', 'fish'], avatar: 'peach', dob: '2017-05-12', gender: 'FEMALE' },
  { nickname: 'ข้าวหอม', name: 'ด.ญ.ข้าวหอม มีสุข', classroom: 1, kidCode: 'KAEW23', parentLinkCode: 'KAEWBEST', pictures: ['rabbit', 'rabbit', 'bear'], avatar: 'sun', dob: '2017-09-03', gender: 'FEMALE' },
  { nickname: 'ปุยฝ้าย', name: 'ด.ญ.ปุยฝ้าย นุ่มนวล', classroom: 1, kidCode: 'PUNCH2', parentLinkCode: 'PUYFAYGA', pictures: ['bird', 'frog', 'cat'], avatar: 'grape', dob: '2017-02-20', gender: 'FEMALE' },
  { nickname: 'ต้นกล้า', name: 'ด.ช.ต้นกล้า เติบโต', classroom: 2, kidCode: 'TAN345', parentLinkCode: 'TAKRAGRU', pictures: ['elephant', 'turtle', 'dog'], avatar: 'mint', dob: '2015-11-08', gender: 'MALE' },
  { nickname: 'ภูผา', name: 'ด.ช.ภูผา แข็งแรง', classroom: 2, kidCode: 'BEAM45', parentLinkCode: 'PHUPHA22', pictures: ['bear', 'fish', 'bird'], avatar: 'sky', dob: '2015-06-25', gender: 'MALE' },
  { nickname: 'ใบเตย', name: 'ด.ญ.ใบเตย หอมหวาน', classroom: 2, kidCode: 'NUNA34', parentLinkCode: 'BAYTEY22', pictures: ['frog', 'frog', 'frog'], avatar: 'coral', dob: '2016-01-14', gender: 'FEMALE' },
];
