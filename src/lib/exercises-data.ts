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
  },
  {
    name: "Straight Leg Raise",
    nameTh: "ยกขาตรง",
    category: "knee",
    description: "การฝึกยกขาตรงขึ้นขณะนอนหงาย เสริมกล้ามเนื้อ Quadriceps และฟื้นฟูข้อเข่า",
    instructions: [
      "นอนหงายบนพื้นเรียบ",
      "ขาที่ไม่ฝึกให้งอเข่าเล็กน้อย",
      "ขาที่ฝึกให้ตรง ค่อยยกขึ้น",
      "ยกจนขาสูงเท่าขาอีกข้าง",
      "ค้างไว้ 3-5 วินาที แล้วค่อยลง",
    ],
    targetJoints: [
      {
        name: "left_hip_flexion",
        nameTh: "งอสะโพกซ้าย (ยกขา)",
        idealAngle: 35,
        minAngle: 25,
        maxAngle: 45,
        unit: "°",
        rationale:
          "Raise the straight leg to the height of the bent opposite thigh (app instructions; AAOS: 6–10 in off the floor). Developer estimate ≈25–45° hip flexion, well inside normal hip flexion of 100–140° (Physiopedia).",
      },
      {
        name: "right_hip_flexion",
        nameTh: "งอสะโพกขวา (ยกขา)",
        idealAngle: 35,
        minAngle: 25,
        maxAngle: 45,
        unit: "°",
        rationale:
          "Same as left side.",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "ArrowUpFromLine",
    bodyPart: "lower",
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
  },
  {
    name: "Hip Bridge",
    nameTh: "ยกสะโพก",
    category: "hip",
    description: "การฝึกยกสะโพกขณะนอนหงาย เสริมกล้ามเนื้อกล้ามเนื้อ Gluteus และฟื้นฟูสะโพก",
    instructions: [
      "นอนหงาย งอเข่าทั้งสองข้าง",
      "เท้าวางแบนบนพื้น กว้างเท่าไหล่",
      "กดเท้าลงพื้น ค่อยยกสะโพกขึ้น",
      "ยกจนลำตัวเป็นเส้นตรงจากไหล่ถึงเข่า",
      "ค้างไว้ 3-5 วินาที แล้วค่อยลง",
    ],
    targetJoints: [
      {
        name: "left_hip",
        nameTh: "สะโพกซ้าย (ไหล่–สะโพก–เข่า)",
        idealAngle: 175,
        minAngle: 160,
        maxAngle: 180,
        unit: "°",
        rationale:
          "Top of the bridge = shoulder, hip and knee in a straight line (app instructions), i.e. neutral hip extension ≈180°. Hyperextension is not targeted.",
      },
      {
        name: "right_hip",
        nameTh: "สะโพกขวา (ไหล่–สะโพก–เข่า)",
        idealAngle: 175,
        minAngle: 160,
        maxAngle: 180,
        unit: "°",
        rationale:
          "Same as left side.",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 12,
    restSeconds: 30,
    icon: "Mountain",
    bodyPart: "lower",
  },
  {
    name: "Neck Rotation",
    nameTh: "หมุนคอ",
    category: "neck",
    description: "การฝึกหมุนคอเพื่อลดอาการปวดคอ และฟื้นฟูขอบเขตการเคลื่อนไหว",
    instructions: [
      "นั่งตรง มองตรงไปข้างหน้า",
      "ค่อยๆ หมุนหัวไปทางซ้าย",
      "ค้างไว้ 3-5 วินาที",
      "กลับมาท่าเดิม แล้วหมุนไปทางขวา",
      "ค้างไว้ 3-5 วินาที แล้วกลับมา",
    ],
    targetJoints: [
      {
        name: "neck",
        nameTh: "คอ",
        idealAngle: 45,
        minAngle: 35,
        maxAngle: 55,
        unit: "°",
      },
    ],
    difficulty: "beginner",
    sets: 2,
    repsPerSet: 8,
    restSeconds: 20,
    icon: "RotateCcw",
    bodyPart: "upper",
  },
  {
    name: "Ankle Dorsiflexion",
    nameTh: "ดึงข้อเท้าเข้าหาตัว",
    category: "ankle",
    description: "การฝึกดึงข้อเท้าเข้าหาตัวเพื่อฟื้นฟูข้อเท้าหลังบาดเจ็บ",
    instructions: [
      "นั่งบนเก้าอี้ ขาตรง",
      "ค่อยดึงปลายเท้าเข้าหาตัว",
      "ค้างไว้ 3-5 วินาที",
      "ค่อยปล่อยลง",
    ],
    targetJoints: [
      {
        name: "left_ankle",
        nameTh: "ข้อเท้าซ้าย",
        idealAngle: 20,
        minAngle: 15,
        maxAngle: 25,
        unit: "°",
      },
      {
        name: "right_ankle",
        nameTh: "ข้อเท้าขวา",
        idealAngle: 20,
        minAngle: 15,
        maxAngle: 25,
        unit: "°",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 20,
    icon: "Footprints",
    bodyPart: "lower",
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
  },
  {
    name: "Cat-Cow Stretch",
    nameTh: "ท่าแมว-วัว",
    category: "back",
    description: "การฝึกท่าคลายกล้ามเนื้อหลัง เพิ่มความยืดหยุ่นของกระดูกสันหลัง",
    instructions: [
      "คุกเข่า มือวางราบพื้น",
      "หายใจเข้า มองขึ้น โค้งหลังลง",
      "หายใจออก มองลง โค้งหลังขึ้น",
      "ทำช้าๆ ตามลมหายใจ",
    ],
    targetJoints: [
      {
        name: "spine_flexion",
        nameTh: "โค้งหลังขึ้น (ท่าแมว)",
        idealAngle: 45,
        minAngle: 30,
        maxAngle: 60,
        unit: "°",
        rationale:
          "PROXY: head–trunk flexion in four-point kneeling (MediaPipe has no spine landmarks). Normal thoraco-lumbar flexion is 45–50° (Physiopedia); the proxy also includes neck flexion. A rep = round the back (cat), then return or arch (cow, negative values).",
      },
    ],
    difficulty: "beginner",
    sets: 2,
    repsPerSet: 10,
    restSeconds: 20,
    icon: "StretchHorizontal",
    bodyPart: "full",
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
  },
  {
    name: "Clamshell",
    nameTh: "ท่าเปลือกหอย",
    category: "hip",
    description: "การฝึกเปิด-ปิดเข่าขณะนอนข้าง เสริมกล้ามเนื้อ Gluteus Medius",
    instructions: [
      "นอนข้าง เข่างอ 45 องศา",
      "เท้าซ้อนกัน",
      "ค่อยเปิดเข่าข้างบนขึ้น",
      "ค้างไว้ 2-3 วินาที",
      "ค่อยปิดลง",
    ],
    targetJoints: [
      {
        name: "hip_opening",
        nameTh: "มุมเปิดเข่า",
        idealAngle: 40,
        minAngle: 30,
        maxAngle: 50,
        unit: "°",
        rationale:
          "Knee separation while feet stay together; combines hip abduction and external rotation. Developer estimate bounded by normal hip abduction ≈40° (Physiopedia).",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 12,
    restSeconds: 20,
    icon: "Copy",
    bodyPart: "lower",
  },
  {
    name: "Prone Scapular Squeeze",
    nameTh: "หดี่บริเวณกระดูกสะบัก",
    category: "back",
    description: "การฝึกหดกล้ามเนื้อสะบักเพื่อแก้ไขท่าทาง และฟื้นฟูกล้ามเนื้อหลังส่วนบน",
    instructions: [
      "นอนคว่ำบนพื้นเรียบ",
      "แขนวางข้างลำตัว",
      "ค่อยหดีกระดูกสะบักเข้าหากัน",
      "ค้างไว้ 5 วินาที",
      "ค่อยคลาย",
    ],
    targetJoints: [
      {
        name: "left_shoulder_extension",
        nameTh: "ยกแขนซ้ายจากการบีบสะบัก",
        idealAngle: 15,
        minAngle: 8,
        maxAngle: 30,
        unit: "°",
        rationale:
          "PROXY: arm lift above the trunk line while squeezing the shoulder blades lying face down; scapular retraction itself is not visible to MediaPipe. Kept well below normal shoulder hyperextension of 50° (Physiopedia).",
      },
      {
        name: "right_shoulder_extension",
        nameTh: "ยกแขนขวาจากการบีบสะบัก",
        idealAngle: 15,
        minAngle: 8,
        maxAngle: 30,
        unit: "°",
        rationale:
          "Same as left side.",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 20,
    icon: "Compress",
    bodyPart: "upper",
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