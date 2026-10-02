// Cleans AI-written clinical summaries for display and printing.
//
// Older summaries (and occasionally new ones) contain things that do not
// belong in a medical record: a self-made header with blank patient fields
// ("ผู้ป่วย: – – –", "[ชื่อผู้ป่วย]"), horizontal rules, engine identifiers
// such as "(มุม left_hip‑left_shoulder‑left_elbow)" and fault codes like
// INCOMPLETE_ROM. The document header already carries the patient data, so
// those parts are removed and identifiers are replaced with Thai terms.
// Markdown tables are kept; they are rendered as real HTML tables (remark-gfm).

const FAULT_TH: Record<string, string> = {
  INCOMPLETE_ROM: 'ทำไม่สุดระยะ',
  COMPENSATION: 'ท่าชดเชย',
  LOW_ACCURACY: 'ความแม่นยำต่ำ',
};

const SIDE_TH: Record<string, string> = { left: 'ซ้าย', right: 'ขวา' };
const PART_TH: Record<string, string> = {
  knee: 'เข่า',
  hip: 'สะโพก',
  hip_flexion: 'งอสะโพก',
  hip_abduction: 'กางสะโพก',
  shoulder: 'ไหล่',
  elbow: 'ศอก',
  wrist: 'ข้อมือ',
  ankle: 'ข้อเท้า',
  hip_opening: 'มุมเปิดเข่า',
  trunk_lateral_flexion: 'เอียงลำตัวด้านข้าง',
  trunk_inclination: 'ลำตัวเอนจากแนวดิ่ง',
  trunk_rotation: 'บิดลำตัว',
};

/** "left_knee" → "เข่าซ้าย"; unknown identifiers are returned unchanged */
export function thaiMeasurementName(key: string, names: Record<string, string> = {}): string {
  if (names[key]) return names[key];
  const m = key.match(/^(left|right)_(.+)$/);
  if (m && PART_TH[m[2]]) return `${PART_TH[m[2]]}${SIDE_TH[m[1]]}`;
  return PART_TH[key] ?? key;
}

// Lines of a self-made report header: "**ผู้ป่วย:** – – –", "**วันที่ตรวจ:** …"
const HEADER_FIELD = /\*\*\s*(ผู้ป่วย|ผู้รับการประเมิน|ชื่อ(?:ผู้ป่วย)?|HN|อายุ|เพศ|วันที่(?:ตรวจ)?|เวลา|ช่วงเวลา|ท่าฝึก|ผู้ประเมิน)\s*:?\s*\*\*/;
const TITLE_LINE = /^\s*(\*\*|#{1,6})?\s*(clinical summary( report)?|รายงานสรุปคลินิก)/i;
const RULE_LINE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
// "(มุม left_hip‑left_shoulder‑left_elbow)", "(right_knee)", "[angle(...)]"
const ID = '[a-z]+(?:_[a-z]+)+';
const TECH_PAREN = new RegExp(`\\s*[(\\[（]\\s*(?:มุม|angle)?\\s*${ID}(?:\\s*[‑\\-–,/]\\s*${ID})*\\s*[)\\]）]`, 'gi');
const FORMULA = /\s*\[?\s*(?:180\s*[−-]\s*)?angle\([^)]*\)\s*\]?/gi;
const SNAKE_ID = new RegExp(`\\b${ID}\\b`, 'g');

export function cleanClinicalSummary(markdown: string, names: Record<string, string> = {}): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const firstHeading = lines.findIndex((l) => /^\s*#{1,6}\s/.test(l));
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (RULE_LINE.test(line)) return;
    if (TITLE_LINE.test(line)) return;
    // Header fields only before the first section heading
    if ((firstHeading === -1 || i < firstHeading) && HEADER_FIELD.test(line)) return;
    out.push(line);
  });

  // A GFM table must start its own block: blank line before the header row
  for (let i = out.length - 2; i > 0; i--) {
    const isHeader = /^\s*\|/.test(out[i]) && /^\s*\|?\s*:?-{3,}/.test(out[i + 1]);
    if (isHeader && out[i - 1].trim() && !/^\s*\|/.test(out[i - 1])) out.splice(i, 0, '');
  }

  let text = out.join('\n');
  text = text.replace(FORMULA, '').replace(TECH_PAREN, '');
  text = text.replace(/\b(INCOMPLETE_ROM|COMPENSATION|LOW_ACCURACY)\b/g, (m) => FAULT_TH[m]);
  text = text.replace(SNAKE_ID, (m) => thaiMeasurementName(m, names));
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
