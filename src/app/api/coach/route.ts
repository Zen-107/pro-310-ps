import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-guard';
import { complete } from '@/lib/ai-agent';
import { describeCue, isSpeakable, jointCues, localCue, type CueTarget } from '@/lib/coach-cues';
import { cleanText } from '@/lib/text-safe';

// Live coaching cue (spoken by the browser). The model only sees qualitative
// joint states — never angle numbers — and its reply is rejected if it
// contains degree values, falling back to a deterministic cue.
const SYSTEM_PROMPT = `คุณคือนักกายภาพบำบัดที่ยืนอยู่ข้างๆ ผู้ป่วยระหว่างฝึก และพูดให้กำลังใจเป็นภาษาไทยแบบธรรมชาติ
หน้าที่: ให้คำแนะนำสั้นๆ หนึ่งเรื่องที่สำคัญที่สุดในตอนนี้ ให้ผู้ป่วยฟังแล้วทำตามได้ทันที

วิธีพูด:
- พูดเหมือนนักกายภาพจริงๆ เป็นกันเอง สุภาพ ลงท้ายด้วย "ครับ"
- 1 ประโยค (ไม่เกิน 2 ประโยคสั้นๆ) ไม่เกินประมาณ 20 คำ เพราะจะถูกอ่านออกเสียง
- บอกเป็นการกระทำของร่างกาย เช่น "ยกแขนขึ้นอีกนิดครับ", "กางแขนกว้างขึ้นอีกนิดครับ", "เกร็งไหล่ไว้ แล้วค่อยๆ ลดแขนลงช้าๆ", "หลังตรงไว้นะครับ"
- ห้ามพูดตัวเลของศา เปอร์เซ็นต์ หรือคำว่า "องศา" เด็ดขาด และไม่ใช้ศัพท์เทคนิค
- ถ้ามีท่าชดเชย ให้แก้ท่าชดเชยก่อน ถ้าท่าถูกต้องแล้ว ให้ชมและเตือนให้เคลื่อนไหวช้าๆ หรือหายใจสม่ำเสมอ
- ห้ามวินิจฉัย ห้ามเปลี่ยนแผนการฝึก
- ตอบเฉพาะประโยคที่จะพูด ไม่ต้องมีคำอธิบายหรือเครื่องหมายคำพูด`;

const asTargets = (v: unknown): CueTarget[] =>
  Array.isArray(v)
    ? v.filter(
        (t): t is CueTarget =>
          !!t && typeof t.name === 'string' && typeof t.nameTh === 'string' && [t.minAngle, t.maxAngle, t.idealAngle].every((n) => typeof n === 'number')
      )
    : [];

export async function POST(req: NextRequest) {
  // Paid AI service: only signed-in patients during a session
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;

  let fallback = 'ทำได้ดีครับ ค่อยๆ ทำต่อไปนะครับ';
  try {
    const body = await req.json();
    const slug = typeof body.exerciseSlug === 'string' ? body.exerciseSlug : undefined;
    const targets = asTargets(body.targetJoints);
    const angles: Record<string, number> =
      body.currentAngles && typeof body.currentAngles === 'object' ? body.currentAngles : {};
    const formCue = cleanText(body.formCue, 200);
    const repCount = Number(body.repCount) || 0;
    const repsPerSet = Number(body.repsPerSet) || 0;

    const cues = jointCues(slug, targets, angles);
    fallback = localCue(slug, targets, angles);
    if (!cues.length) return NextResponse.json({ feedback: fallback, source: 'local' });

    const remaining = repsPerSet > repCount ? repsPerSet - repCount : 0;
    const userMessage = `ท่าที่กำลังฝึก: ${cleanText(body.exerciseNameTh, 80) ?? cleanText(body.exerciseName, 80) ?? 'ไม่ระบุ'}
สถานะข้อต่อตอนนี้:
${cues.map(describeCue).join('\n')}
${formCue ? `ท่าชดเชยที่ระบบตรวจพบล่าสุด (ภาษาอังกฤษ ให้พูดเป็นภาษาไทย): ${formCue}` : 'ไม่พบท่าชดเชย'}
${remaining ? `เหลืออีก ${remaining} ครั้งในเซ็ตนี้ (พูดถึงได้ถ้าเหมาะสม)` : ''}

พูดคำแนะนำหนึ่งประโยค`;

    const { content } = await complete(SYSTEM_PROMPT, userMessage);
    const feedback = content.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    if (!isSpeakable(feedback)) return NextResponse.json({ feedback: fallback, source: 'local' });
    return NextResponse.json({ feedback, source: 'ai' });
  } catch (error) {
    console.error('Coach API error:', error);
    return NextResponse.json({ feedback: fallback, source: 'local' });
  }
}
