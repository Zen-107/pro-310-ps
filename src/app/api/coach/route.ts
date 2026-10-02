import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-guard';
import { complete } from '@/lib/ai-agent';

const SYSTEM_PROMPT = `คุณคือ AI Physio Coach — นักกายภาพบำบัด AI ที่เป็นมิตรและเป็นกันเอง
คุณมีหน้าที่:
1. วิเคราะห์มุมข้อต่อที่ผู้ใช้ทำและเปรียบเทียบกับมุมเป้าหมาย
2. ให้ Feedback แบบสั้น กระชับ เป็นภาษาไทยที่เข้าใจง่าย
3. แนะนำการปรับท่าทางที่ถูกต้อง
4. ให้กำลังใจผู้ใช้

กฎ:
- พูดสั้น ไม่เกิน 2-3 ประโยค
- ใช้ภาษาสุภาพ แบบเป็นกันเอง (ไม่ใช้คำว่า "คุณ")
- เน้นที่การแก้ไขท่าทางที่ผิด
- ถ้าท่าถูกต้อง ให้ชม
- ห้ามให้คำแนะนำทางการแพทย์โดยตรง
- ห้ามเปลี่ยนแผนการรักษา

ตัวอย่างคำตอบ:
- "เข่าขวางอได้ดีมากครับ! แต่ลองงออีกนิดนะ ประมาณ 5 องศา"
- "ท่านี้ถูกต้องแล้วครับ ทำได้เยี่ยม!"
- "ไหล่ซ้ายยกสูงเกินไปนิดหน่อย ลองลดลงประมาณ 10 องศาครับ"
- "สม่ำเสมอดีมากเลย! อีก 3 ครั้งก็ครบเซ็ตแล้ว"`;

export async function POST(req: NextRequest) {
  // Paid AI service: only signed-in patients during a session
  const auth = await requireApiUser(['PATIENT']);
  if ('response' in auth) return auth.response;

  try {
    const { exerciseName, currentAngles, targetJoints, repCount, setCount } = await req.json();

    const angleInfo = Object.entries(currentAngles || {})
      .map(([joint, angle]) => {
        const target = (targetJoints || []).find(
          (t: { name: string }) => t.name === joint
        );
        if (!target) return null;
        return `• ${joint}: ปัจจุบัน ${angle}° (เป้าหมาย: ${target.idealAngle}°, ช่วงที่ยอมรับ: ${target.minAngle}°-${target.maxAngle}°)`;
      })
      .filter(Boolean)
      .join('\n');

    const userMessage = `ท่าทาง: ${exerciseName || 'ไม่ระบุ'}
เซ็ตที่: ${setCount || 1}, ซ้ำที่: ${repCount || 1}

มุมข้อต่อปัจจุบัน:
${angleInfo || 'ไม่มีข้อมูลมุมข้อต่อ'}

กรุณาวิเคราะห์และให้ feedback สั้นๆ`;

    const { content } = await complete(SYSTEM_PROMPT, userMessage);
    const feedback = content || 'ทำดีมากครับ! ทำต่อไปเลย';

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Coach API error:', error);
    return NextResponse.json(
      { feedback: 'ทำดีมากครับ! ทำต่อไปเลย', error: 'AI coach temporarily unavailable' },
      { status: 200 }
    );
  }
}