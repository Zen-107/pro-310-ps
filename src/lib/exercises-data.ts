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
  /** Seconds the target position must be held for a rep to count (default: a brief pause) */
  holdSeconds?: number;
  /** Static (isometric) hold: the joint barely moves, so after each hold and a short relax the next hold starts in place */
  isometric?: boolean;
  /** One side at a time: the patient picks left or right and each side is recorded as its own session */
  unilateral?: boolean;
  /** Body position required before reps count (e.g. lying down), with the spoken hint when it is not met */
  posture?: PostureGate & { hintTh: string };
}

/** A measurement range the body must be in for reps to count */
export interface PostureGate {
  measurement: string;
  min?: number;
  max?: number;
}

export const EXERCISES: ExerciseData[] = [
  {
    name: "Static Quads",
    nameTh: "เกร็งต้นขาด้านหน้า",
    category: "knee",
    description: "นอนหงาย เกร็งกล้ามเนื้อต้นขาด้านหน้าเพื่อกดหลังเข่าลงกับพื้น ช่วยให้ต้นขาแข็งแรงและเหยียดเข่าได้สุด",
    instructions: [
      "วางกล้องไว้ด้านข้าง ระดับพื้น ให้เห็นทั้งตัว",
      "นอนหงาย ชันเข่าข้างหนึ่ง เท้าวางราบ อีกข้างเหยียดตรง",
      "กระดกปลายเท้าข้างที่เหยียดขึ้นหาตัว",
      "เกร็งต้นขาด้านหน้า กดหลังเข่าลงกับพื้น",
      "ค้างไว้ 5 วินาที แล้วผ่อนแรง",
    ],
    targetJoints: [
      {
        name: "left_knee",
        nameTh: "เข่าซ้าย",
        idealAngle: 175,
        minAngle: 170,
        maxAngle: 180,
        unit: "°",
        rationale:
          "CUH 'Static quads' (lying, the straight knee pressed into the floor). Developer estimate: a fully straight knee reads ≈170–180° from a side-view camera. The camera sees the straight knee and the hold time, not the muscle tension itself. The source gives no hold time (\"Hold for seconds\"); 5 s is a team default.",
      },
      {
        name: "right_knee",
        nameTh: "เข่าขวา",
        idealAngle: 175,
        minAngle: 170,
        maxAngle: 180,
        unit: "°",
        rationale: "Same as left side.",
      },
    ],
    difficulty: "beginner",
    sets: 3,
    repsPerSet: 10,
    restSeconds: 30,
    icon: "Footprints",
    bodyPart: "lower",
    holdSeconds: 5,
    isometric: true,
    // A standing knee is straight too: count only while lying (trunk ≈ 90° from vertical)
    posture: { measurement: "trunk_inclination", min: 60, hintTh: "นอนหงายราบกับพื้น ให้กล้องเห็นด้านข้างลำตัวก่อนนะครับ" },
    formChecks: [
      {
        "id": "other_knee_bent",
        "type": "max",
        "measurement": "{other}_knee",
        "threshold": 140,
        "message": "Keep the other knee bent with the foot flat"
      }
    ],
  },
  {
    name: "Cross-Body Shoulder Stretch",
    nameTh: "ยืดไหล่ข้ามลำตัว",
    category: "shoulder",
    description: "นำแขนพาดผ่านหน้าลำตัวแล้วใช้แขนอีกข้างช่วยดึง ยืดกล้ามเนื้อไหล่ด้านหลัง ลดอาการไหล่ตึง",
    instructions: [
      "ยืนหรือนั่งตรง หันหน้าเข้ากล้อง",
      "นำแขนข้างที่ฝึกพาดผ่านหน้าลำตัว แขนเหยียดตรง",
      "แขนอีกข้างงอศอก พับแขนเข้าหาลำตัวเพื่อช่วยดึง",
      "รู้สึกตึงแล้วค้างไว้ 10 วินาที โดยไม่กลั้นหายใจ",
      "ทำครบแล้วสลับทำแขนอีกข้าง",
    ],
    targetJoints: [
      {
        name: "left_shoulder",
        nameTh: "ไหล่ซ้าย",
        idealAngle: 90,
        minAngle: 70,
        maxAngle: 110,
        unit: "°",
        rationale:
          "Cross-body stretch (Golden Jubilee Medical Center, Mahidol University). Developer estimate: an arm held across the chest at shoulder height reads ≈80–100° between trunk and upper arm from the front. How far the arm crosses the body (horizontal adduction) needs depth and is not measured.",
      },
      {
        name: "right_shoulder",
        nameTh: "ไหล่ขวา",
        idealAngle: 90,
        minAngle: 70,
        maxAngle: 110,
        unit: "°",
        rationale: "Same as left side.",
      },
    ],
    difficulty: "beginner",
    sets: 2,
    repsPerSet: 5,
    restSeconds: 20,
    icon: "MoveHorizontal",
    bodyPart: "upper",
    holdSeconds: 10,
    unilateral: true,
    formChecks: [
      {
        "id": "elbow_straight",
        "type": "min",
        "measurement": "{side}_elbow",
        "threshold": 140,
        "message": "Keep the stretched arm straight"
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
    name: "Shoulder Abduction",
    nameTh: "กางแขนข้าง",
    category: "shoulder",
    description: "การฝึกกางแขนออกด้านข้างเพื่อเสริมกล้ามเนื้อ Deltoid และฟื้นฟูข้อไหล่",
    instructions: [
      "ยืนหรือนั่งตรง หันหน้าเข้ากล้อง แขนวางข้างลำตัว",
      "ค่อยๆ กางแขนข้างที่ฝึกออกด้านข้าง แขนเหยียดตรง",
      "กางจนแขนขนานกับพื้น",
      "ค้างไว้ 2-3 วินาที แล้วค่อยลง",
      "ทำครบแล้วสลับทำแขนอีกข้าง",
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
    unilateral: true,
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
    description: "กางแขนระดับไหล่แล้วหมุนแขนเป็นวงกลม จากวงเล็กขยายเป็นวงใหญ่ เพื่อเพิ่มการเคลื่อนไหวและความยืดหยุ่นของข้อไหล่",
    instructions: [
      "ยืนตรง หันหน้าเข้ากล้อง",
      "กางแขนทั้งสองข้างออกด้านข้าง ให้ขนานกับพื้น แขนเหยียดตรง",
      "หมุนแขนเป็นวงกลมเล็กๆ แล้วค่อยๆ ขยายวงให้ใหญ่ขึ้น จนรู้สึกตึงที่ต้นแขน",
      "หมุนประมาณ 10 วินาที แล้วหมุนกลับทิศทาง",
    ],
    targetJoints: [
      {
        name: "left_shoulder",
        nameTh: "ไหล่ซ้าย",
        idealAngle: 120,
        minAngle: 110,
        maxAngle: 140,
        unit: "°",
        rationale:
          "Powell Orthopedics arm circles (arms out at shoulder height, circles growing from tiny to large). Developer estimate: a level arm reads ≈95–100° from the front (hips are narrower than shoulders); a circle passing over the top reaches ≈110–140°, so one counted rep = one circle that rises ≥10–15° above the level arm.",
      },
      {
        name: "right_shoulder",
        nameTh: "ไหล่ขวา",
        idealAngle: 120,
        minAngle: 110,
        maxAngle: 140,
        unit: "°",
        rationale: "Same as left side.",
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

/** Stable exercise ID used by the seed route, e.g. "Static Quads" → "ex_static_quads" */
export function exerciseIdFromName(name: string): string {
  return `ex_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

export interface ExerciseMeta {
  holdSeconds: number | null;
  isometric: boolean;
  unilateral: boolean;
  posture: (PostureGate & { hintTh: string }) | null;
}

const META_BY_SLUG: Record<string, ExerciseMeta> = Object.fromEntries(
  EXERCISES.map((e) => [
    exerciseIdFromName(e.name),
    { holdSeconds: e.holdSeconds ?? null, isometric: !!e.isometric, unilateral: !!e.unilateral, posture: e.posture ?? null },
  ])
);

/** Hold time and one-side-at-a-time behaviour of a catalogue exercise (defaults for unknown slugs) */
export function exerciseMeta(slug: string): ExerciseMeta {
  return META_BY_SLUG[slug] ?? { holdSeconds: null, isometric: false, unilateral: false, posture: null };
}

export type Side = "left" | "right";

export const SIDE_LABELS: Record<Side, string> = { left: "ซ้าย", right: "ขวา" };

export const isSide = (v: unknown): v is Side => v === "left" || v === "right";

/** Side recorded in a session's targetSnapshot (one-side-at-a-time exercises), else null */
export function snapshotSide(snapshot: unknown): Side | null {
  const side = (snapshot as { side?: unknown } | null)?.side;
  return isSide(side) ? side : null;
}

/** Targets for one side of a unilateral exercise: the other side's joints are dropped and the chosen side becomes primary */
export function targetsForSide<T extends { name: string; isPrimary?: boolean }>(targets: T[], side: Side): T[] {
  const other = side === "left" ? "right_" : "left_";
  const kept = targets.filter((t) => !t.name.startsWith(other));
  const primary = kept.find((t) => t.name.startsWith(`${side}_`)) ?? kept[0];
  return kept.map((t) => ({ ...t, isPrimary: t === primary }));
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