import type { FormCheck } from './form-checks';

export interface TargetJoint {
  name: string;
  nameTh: string;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  unit: string;
  /** Why this target was chosen (stored on ExerciseJointTarget.rationale) */
  rationale?: string;
}

export interface ExerciseData {
  name: string;
  nameTh: string;
  category: string;
  description: string;
  instructions: string[];
  targetJoints: TargetJoint[];
  difficulty: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  icon: string;
  bodyPart: string;
  /** Compensation checks evaluated at each rep's best moment (see form-checks.ts) */
  formChecks?: FormCheck[];
}

export const EXERCISES: ExerciseData[] = [
  {
    name: "Knee Flexion",
    nameTh: "การงอเข่า",
    category: "knee",
    description: "การฝึกงอเข่าเพื่อฟื้นฟูข้อเข่า ช่วยเพิ่ม Range of Motion และเสริมกล้ามเนื้อต้นขา",
    instructions: [
      "นั่งบนเก้าอี้ยาว ขาตรง",
      "ค่อยๆ งอเข่าข้างที่ต้องการฝึก",
      "ยกเท้าขึ้นจนเข่างอเต็มที่",
      "ค้างไว้ 3-5 วินาที",
      "ค่อยๆ กลับมาท่าเดิม",
    ],
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 100,
        unit: "°",
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 100,
        unit: "°",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "Footprints",
    bodyPart: "lower",
    formChecks: [
      {
        "id": "other_leg_straight",
        "type": "min",
        "measurement": "{other}_knee",
        "threshold": 160,
        "message": "Keep the other leg straight on the surface"
      }
    ],
  },
  {
    name: "Shoulder Flexion",
    nameTh: "ยกแขนขึ้นด้านหน้า",
    category: "shoulder",
    description: "การฝึกยกแขนขึ้นด้านหน้าเพื่อฟื้นฟูข้อไหล่ เพิ่ม Range of Motion",
    instructions: [
      "ยืนตรงหรือนั่งตรง",
      "แขนทั้งสองข้างวางข้างลำตัว",
      "ค่อยยกแขนที่ต้องการฝึกขึ้นด้านหน้า",
      "ยกจนแขนชี้ขึ้นเหนือศีรษะ",
      "ค้างไว้ 2-3 วินาที แล้วค่อยลง",
    ],
    targetJoints: [
      {
        name: "left_shoulder",
        nameTh: "ไหล่ซ้าย",
        idealAngle: 180,
        minAngle: 160,
        maxAngle: 180,
        unit: "°",
      },
      {
        name: "right_shoulder",
        nameTh: "ไหล่ขวา",
        idealAngle: 180,
        minAngle: 160,
        maxAngle: 180,
        unit: "°",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 8,
    restSeconds: 30,
    icon: "MoveUp",
    bodyPart: "upper",
    formChecks: [
      {
        "id": "elbow_straight",
        "type": "min",
        "measurement": "{side}_elbow",
        "threshold": 150,
        "message": "Keep your elbow straight"
      },
      {
        "id": "trunk_upright",
        "type": "max",
        "measurement": "trunk_inclination",
        "threshold": 15,
        "message": "Keep your trunk upright — do not lean back"
      }
    ],
  },
  {
    name: "Shoulder Abduction",
    nameTh: "กางแขนข้าง",
    category: "shoulder",
    description: "การฝึกกางแขนออกด้านข้างเพื่อเสริมกล้ามเนื้อ Deltoid และฟื้นฟูข้อไหล่",
    instructions: [
      "ยืนตรงหรือนั่งตรง",
      "แขนทั้งสองข้างวางข้างลำตัว",
      "ค่อยกางแขนที่ต้องการฝึกออกด้านข้าง",
      "กางจนแขนขนานกับพื้น",
      "ค้างไว้ 2-3 วินาที แล้วค่อยลง",
    ],
    targetJoints: [
      {
        name: "left_shoulder",
        nameTh: "ไหล่ซ้าย",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 100,
        unit: "°",
      },
      {
        name: "right_shoulder",
        nameTh: "ไหล่ขวา",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 100,
        unit: "°",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "MoveHorizontal",
    bodyPart: "upper",
    formChecks: [
      {
        "id": "elbow_straight",
        "type": "min",
        "measurement": "{side}_elbow",
        "threshold": 150,
        "message": "Keep your elbow straight"
      },
      {
        "id": "trunk_upright",
        "type": "max",
        "measurement": "trunk_lateral_flexion",
        "threshold": 10,
        "message": "Keep your trunk upright — do not lean sideways"
      }
    ],
  },
  {
    name: "Wall Squat",
    nameTh: "ย่อตัวกับผนัง",
    category: "knee",
    description: "การฝึกย่อตัวพยุงผนัง เสริมกล้ามเนื้อขาและฟื้นฟูข้อเข่า",
    instructions: [
      "ยืนหลังชิดผนัง",
      "เลื่อนลงจนเข่างอประมาณ 90 องศา",
      "เข่าไม่เกินปลายเท้า",
      "ค้างไว้ตามเวลาที่กำหนด",
      "เลื่อนขึ้นท่าเดิม",
    ],
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 90,
        minAngle: 75,
        maxAngle: 100,
        unit: "°",
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 90,
        minAngle: 75,
        maxAngle: 100,
        unit: "°",
      },
    ],
    difficulty: "intermediate",
    sets: 3,
    repsPerSet: 5,
    restSeconds: 45,
    icon: "PersonStanding",
    bodyPart: "lower",
    formChecks: [
      {
        "id": "weight_even",
        "type": "symmetry",
        "measurement": "left_knee",
        "other": "right_knee",
        "maxDiff": 15,
        "message": "Keep your weight even on both legs"
      }
    ],
  },
  {
    name: "Arm Circles",
    nameTh: "หมุนแขนวน",
    category: "shoulder",
    description: "การฝึกหมุนแขนเป็นวงกลม เพื่อฟื้นฟูข้อไหล่และเพิ่มความยืดหยุ่น",
    instructions: [
      "ยืนตรง แขนวางข้างลำตัว",
      "ยกแขนขึ้นขนานพื้น",
      "หมุนแขนเป็นวงกลมเล็กๆ ช้าๆ",
      "ขยายวงใหญ่ขึ้นเรื่อยๆ",
      "ทำ 10 รอบ แล้วหมุนทางกลับ",
    ],
    targetJoints: [
      {
        name: "left_shoulder",
        nameTh: "ไหล่ซ้าย",
        idealAngle: 180,
        minAngle: 150,
        maxAngle: 180,
        unit: "°",
      },
      {
        name: "right_shoulder",
        nameTh: "ไหล่ขวา",
        idealAngle: 180,
        minAngle: 150,
        maxAngle: 180,
        unit: "°",
      },
    ],
    difficulty: "beginner",
    sets: 2,
    repsPerSet: 10,
    restSeconds: 20,
    icon: "RefreshCw",
    bodyPart: "upper",
    formChecks: [
      {
        "id": "elbow_straight",
        "type": "min",
        "measurement": "{side}_elbow",
        "threshold": 150,
        "message": "Keep your elbow straight"
      }
    ],
  },
  {
    name: "Trunk Lateral Flexion",
    nameTh: "เอียงลำตัวด้านข้าง",
    category: "back",
    description: "ยืนแขนเหยียดเหนือศีรษะแล้วเอียงลำตัวไปด้านข้าง เพิ่มความยืดหยุ่นของลำตัวด้านข้าง",
    instructions: [
      "ยืนตรง เท้ากว้างเท่าสะโพก หันหน้าเข้ากล้อง",
      "ยกแขนทั้งสองข้างเหยียดตรงเหนือศีรษะ",
      "ค่อยๆ เอียงลำตัวไปด้านข้าง สะโพกอยู่กับที่",
      "ค้างไว้ 2-3 วินาที แล้วกลับมาตรง",
      "สลับทำอีกข้าง",
    ],
    targetJoints: [
      {
        name: "trunk_lateral_flexion",
        nameTh: "เอียงลำตัวด้านข้าง",
        idealAngle: 25,
        minAngle: 15,
        maxAngle: 35,
        unit: "°",
        rationale:
          "KIMORE Ex2 (lateral tilt of the trunk with the arms extended). Developer estimate bounded by normal thoracolumbar lateral flexion ≈35° (AAOS). Unsigned, so bending to either side counts.",
      },
    ],
    difficulty: "beginner",
    sets: 2,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "StretchHorizontal",
    bodyPart: "upper",
    formChecks: [
      {
        "id": "knees_even",
        "type": "symmetry",
        "measurement": "left_knee",
        "other": "right_knee",
        "maxDiff": 15,
        "message": "Keep both knees straight — bend from the trunk, not the legs"
      },
      {
        "id": "left_arm_overhead",
        "type": "min",
        "measurement": "left_shoulder",
        "threshold": 140,
        "message": "Keep your arms extended overhead"
      },
      {
        "id": "right_arm_overhead",
        "type": "min",
        "measurement": "right_shoulder",
        "threshold": 140,
        "message": "Keep your arms extended overhead"
      }
    ],
  },
  {
    name: "Trunk Rotation",
    nameTh: "บิดลำตัว",
    category: "back",
    description: "บิดลำตัวส่วนบนไปทางซ้ายและขวาโดยสะโพกอยู่กับที่ เพิ่มการเคลื่อนไหวของกระดูกสันหลังส่วนอก",
    instructions: [
      "นั่งหรือยืนตรง หันหน้าเข้ากล้อง",
      "กอดอกหรือยกแขนระดับไหล่",
      "ค่อยๆ บิดลำตัวส่วนบนไปด้านข้าง สะโพกหันหน้าตรง",
      "ค้างไว้ 2 วินาที แล้วกลับมาตรงกลาง",
      "สลับทำอีกข้าง",
    ],
    targetJoints: [
      {
        name: "trunk_rotation",
        nameTh: "บิดลำตัว (ไหล่เทียบสะโพก)",
        idealAngle: 35,
        minAngle: 25,
        maxAngle: 45,
        unit: "°",
        rationale:
          "KIMORE Ex3 (trunk rotation). Developer estimate bounded by normal thoracolumbar rotation ≈45° (AAOS). Needs depth (world landmarks); camera depth is noisy, so the range is wide.",
      },
    ],
    difficulty: "intermediate",
    sets: 2,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "RefreshCw",
    bodyPart: "upper",
    formChecks: [
      {
        "id": "no_side_bend",
        "type": "max",
        "measurement": "trunk_lateral_flexion",
        "threshold": 10,
        "message": "Rotate without bending sideways"
      }
    ],
  },
  {
    name: "Squat",
    nameTh: "สควอท",
    category: "knee",
    description: "ย่อตัวลงโดยไม่พิงผนัง เสริมกล้ามเนื้อต้นขาและสะโพก",
    instructions: [
      "ยืนเท้ากว้างเท่าไหล่ ปลายเท้าชี้ไปด้านหน้า หันด้านข้างเข้ากล้อง",
      "ยื่นแขนไปด้านหน้าเพื่อทรงตัว",
      "ย่อเข่าและดันสะโพกไปด้านหลัง เหมือนนั่งเก้าอี้",
      "ลงจนเข่างอประมาณ 90 องศา หลังตรง",
      "ดันส้นเท้ากลับขึ้นมายืนตรง",
    ],
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 95,
        minAngle: 80,
        maxAngle: 110,
        unit: "°",
        rationale:
          "KIMORE Ex5 / REHAB24-6 Ex6. Developer estimate: a parallel-depth squat ≈90° interior knee angle; the upper bound allows a partial squat for rehabilitation.",
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 95,
        minAngle: 80,
        maxAngle: 110,
        unit: "°",
        rationale: "Same as left side.",
      },
    ],
    difficulty: "intermediate",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 45,
    icon: "PersonStanding",
    bodyPart: "lower",
    formChecks: [
      {
        "id": "weight_even",
        "type": "symmetry",
        "measurement": "left_knee",
        "other": "right_knee",
        "maxDiff": 15,
        "message": "Keep your weight even on both legs"
      },
      {
        "id": "trunk_lean",
        "type": "max",
        "measurement": "trunk_inclination",
        "threshold": 45,
        "message": "Keep your chest up — avoid leaning too far forward"
      },
      {
        "id": "trunk_shift",
        "type": "max",
        "measurement": "trunk_lateral_flexion",
        "threshold": 10,
        "message": "Keep your trunk centred — do not shift to one side"
      }
    ],
  },
  {
    name: "Forward Lunge",
    nameTh: "ก้าวย่อขาด้านหน้า",
    category: "knee",
    description: "ก้าวขาไปด้านหน้าแล้วย่อตัวลง เสริมกล้ามเนื้อขาและการทรงตัว",
    instructions: [
      "ยืนตรง หันด้านข้างเข้ากล้อง",
      "ก้าวขาข้างหนึ่งไปด้านหน้าหนึ่งก้าวยาว",
      "ย่อตัวลงจนเข่าทั้งสองข้างงอประมาณ 90 องศา",
      "ลำตัวตั้งตรง เข่าหน้าอยู่เหนือข้อเท้า",
      "ดันเท้าหน้ากลับสู่ท่ายืน แล้วสลับข้าง",
    ],
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 110,
        unit: "°",
        rationale:
          "REHAB24-6 Ex5 (leg lunge). Developer estimate: front and back knee ≈90° at the bottom of a full lunge; up to 110° allowed for a shallower rehab lunge.",
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 90,
        minAngle: 80,
        maxAngle: 110,
        unit: "°",
        rationale: "Same as left side.",
      },
    ],
    difficulty: "intermediate",
    sets: 3,
    repsPerSet: 8,
    restSeconds: 45,
    icon: "Footprints",
    bodyPart: "lower",
    formChecks: [
      {
        "id": "trunk_upright",
        "type": "max",
        "measurement": "trunk_inclination",
        "threshold": 20,
        "message": "Keep your trunk upright during the lunge"
      },
      {
        "id": "trunk_level",
        "type": "max",
        "measurement": "trunk_lateral_flexion",
        "threshold": 10,
        "message": "Keep your pelvis and trunk level"
      }
    ],
  },
  {
    name: "Side Lunge",
    nameTh: "ก้าวย่อขาด้านข้าง",
    category: "knee",
    description: "ก้าวขาออกด้านข้างแล้วย่อเข่าข้างนั้น อีกขาเหยียดตรง เสริมกล้ามเนื้อต้นขาด้านในและสะโพก",
    instructions: [
      "ยืนตรง หันหน้าเข้ากล้อง",
      "ก้าวขาข้างหนึ่งออกด้านข้างให้กว้าง",
      "ย่อเข่าข้างที่ก้าว ดันสะโพกไปด้านหลัง",
      "ขาอีกข้างเหยียดตรง เท้าวางราบ",
      "ดันกลับสู่ท่ายืน แล้วสลับข้าง",
    ],
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 100,
        minAngle: 85,
        maxAngle: 120,
        unit: "°",
        rationale:
          "Lunge variation (REHAB24-6 Ex5 family). Developer estimate: lunging knee ≈90–120° in a lateral lunge, shallower than a forward lunge.",
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 100,
        minAngle: 85,
        maxAngle: 120,
        unit: "°",
        rationale: "Same as left side.",
      },
    ],
    difficulty: "advanced",
    sets: 2,
    repsPerSet: 8,
    restSeconds: 45,
    icon: "MoveHorizontal",
    bodyPart: "lower",
    formChecks: [
      {
        "id": "other_leg_straight",
        "type": "min",
        "measurement": "{other}_knee",
        "threshold": 160,
        "message": "Keep the other leg straight"
      },
      {
        "id": "trunk_lean",
        "type": "max",
        "measurement": "trunk_inclination",
        "threshold": 40,
        "message": "Keep your chest up — avoid leaning too far forward"
      }
    ],
  },
  {
    name: "Standing Hip Abduction",
    nameTh: "ยืนกางขาออกด้านข้าง",
    category: "hip",
    description: "ยืนแล้วกางขาออกด้านข้างโดยขาเหยียดตรง เสริมกล้ามเนื้อ Gluteus Medius",
    instructions: [
      "ยืนตรง หันหน้าเข้ากล้อง จับพนักเก้าอี้เพื่อทรงตัวได้",
      "เหยียดเข่าข้างที่ฝึกให้ตรง ปลายเท้าชี้ไปด้านหน้า",
      "ค่อยๆ กางขาออกด้านข้าง",
      "ลำตัวตั้งตรง ไม่เอียงไปฝั่งตรงข้าม",
      "ค้างไว้ 2 วินาที แล้วค่อยลง",
    ],
    targetJoints: [
      {
        name: "left_hip_abduction",
        nameTh: "กางสะโพกซ้าย",
        idealAngle: 25,
        minAngle: 20,
        maxAngle: 35,
        unit: "°",
        rationale:
          "REHAB24-6 Ex4 (leg abduction). Developer estimate bounded by normal hip abduction ≈40–45° (AAOS); beyond ~35° standing usually needs trunk lean (compensation).",
      },
      {
        name: "right_hip_abduction",
        nameTh: "กางสะโพกขวา",
        idealAngle: 25,
        minAngle: 20,
        maxAngle: 35,
        unit: "°",
        rationale: "Same as left side.",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "MoveHorizontal",
    bodyPart: "lower",
    formChecks: [
      {
        "id": "trunk_upright",
        "type": "max",
        "measurement": "trunk_lateral_flexion",
        "threshold": 10,
        "message": "Keep your trunk upright — do not lean to the other side"
      },
      {
        "id": "lifted_knee_straight",
        "type": "min",
        "measurement": "{side}_knee",
        "threshold": 160,
        "message": "Keep the lifted knee straight"
      }
    ],
  },
];

export const CATEGORIES = [
  { id: "knee", name: "เข่า", nameEn: "Knee", icon: "Footprints", color: "#10b981" },
  { id: "shoulder", name: "ไหล่", nameEn: "Shoulder", icon: "MoveUp", color: "#f59e0b" },
  { id: "hip", name: "สะโพก", nameEn: "Hip", icon: "Circle", color: "#ef4444" },
  { id: "back", name: "หลัง", nameEn: "Back", icon: "AlignCenterVertical", color: "#8b5cf6" },
  { id: "neck", name: "คอ", nameEn: "Neck", icon: "ArrowUpDown", color: "#06b6d4" },
  { id: "ankle", name: "ข้อเท้า", nameEn: "Ankle", icon: "Footprints", color: "#ec4899" },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.name])
);

export function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] || id;
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "เริ่มต้น",
  intermediate: "ปานกลาง",
  advanced: "ขั้นสูง",
};

export const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

/** Stable exercise ID used by the seed route, e.g. "Knee Flexion" → "ex_knee_flexion" */
export function exerciseIdFromName(name: string): string {
  return `ex_${name.toLowerCase().replace(/\s+/g, "_")}`;
}

export const BADGES = [
  { id: "first_session", name: "เซสชันแรก", description: "ทำกายภาพบำบัดครั้งแรก", icon: "Star", requirement: 1 },
  { id: "streak_3", name: "ติดต่อกัน 3 วัน", description: "ทำกายภาพติดต่อกัน 3 วัน", icon: "Flame", requirement: 3 },
  { id: "streak_7", name: "สัปดาห์ทอง", description: "ทำกายภาพติดต่อกัน 7 วัน", icon: "Trophy", requirement: 7 },
  { id: "streak_30", name: "นักรบ 30 วัน", description: "ทำกายภาพติดต่อกัน 30 วัน", icon: "Medal", requirement: 30 },
  { id: "sessions_10", name: "มือโปร", description: "ทำกายภาพครบ 10 เซสชัน", icon: "Award", requirement: 10 },
  { id: "sessions_50", name: "รุ่นพี่", description: "ทำกายภาพครบ 50 เซสชัน", icon: "Crown", requirement: 50 },
  { id: "perfect_score", name: "ท่าสมบูรณ์", description: "ทำท่าได้ถูกต้อง 100%", icon: "CheckCircle", requirement: 100 },
  { id: "all_categories", name: "ครบทุกส่วน", description: "ทำท่าในทุกหมวดหมู่", icon: "LayoutGrid", requirement: 6 },
];