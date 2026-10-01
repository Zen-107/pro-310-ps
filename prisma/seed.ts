/**
 * Development seed: wipes ALL data and creates demo organizations, users,
 * the exercise library with cited sources, and sample prescriptions.
 *
 *   bun run db:seed        (runs `prisma db seed` → this file)
 *
 * Citations were checked by a developer (not a licensed clinician) on the
 * accessedAt date: each page was opened and confirmed to describe the exercise.
 * None of the sources state target angles — the app's angles are developer
 * estimates (angleBasis = DEVELOPER_ESTIMATE, reasoning in `rationale`) bounded by
 * normative ROM values, until a clinician sets them.
 */
import { PrismaClient, type JointName, type Patient, type ReferenceRelevance } from '@prisma/client';
import { EXERCISES, exerciseIdFromName } from '../src/lib/exercises-data';
import { JOINT_FORMULAS } from '../src/lib/joint-formulas';
import { hashPassword } from '../src/lib/password';

const db = new PrismaClient();

const ACCESSED_AT = new Date('2026-10-01T00:00:00Z');
const VERIFIER_NAME = 'VERIFIED BY DEV';

// ─── Sources (all pages opened and checked on ACCESSED_AT) ──────────
const SOURCES = {
  aaosKnee: {
    title: 'Knee Conditioning Program',
    url: 'https://www.orthoinfo.org/en/recovery/knee-conditioning-program/',
    institution: 'American Academy of Orthopaedic Surgeons (AAOS) — OrthoInfo',
    authors: null,
  },
  aaosHip: {
    title: 'Hip Conditioning Program',
    url: 'https://www.orthoinfo.org/en/recovery/hip-conditioning-program/',
    institution: 'American Academy of Orthopaedic Surgeons (AAOS) — OrthoInfo',
    authors: 'Contributor: Michael J. Alaia, MD, FAAOS',
  },
  aaosSpine: {
    title: 'Spine Conditioning Program',
    url: 'https://www.orthoinfo.org/en/recovery/spine-conditioning-program/',
    institution: 'American Academy of Orthopaedic Surgeons (AAOS) — OrthoInfo',
    authors: 'Contributed/updated by Daniel K. Park, MD, FAAOS; peer-reviewed by Thomas Ward Throckmorton, MD, FAAOS',
  },
  aaosShoulder: {
    title: 'Rotator Cuff and Shoulder Conditioning Program',
    url: 'https://www.orthoinfo.org/en/recovery/rotator-cuff-and-shoulder-conditioning-program/',
    institution: 'American Academy of Orthopaedic Surgeons (AAOS) — OrthoInfo',
    authors: 'Reviewed by the American Shoulder and Elbow Surgeons (ASES)',
  },
  aaosFootAnkle: {
    title: 'Foot and Ankle Conditioning Program',
    url: 'https://www.orthoinfo.org/en/recovery/foot-and-ankle-conditioning-program/',
    institution: 'American Academy of Orthopaedic Surgeons (AAOS) — OrthoInfo',
    authors: 'Contributor: Jordan J. Moen, DPT; peer reviewer: Taylor Beahrs, MD',
  },
  nhsAaaNeck: {
    title: 'Neck Pain Exercises (MSK Patient Portal)',
    url: 'https://www.nhsaaa.net/musculoskeletal-msk-service-patient-portal/neck-msk-patient-portal/neck-pain-exercises-msk-patient-portal/',
    institution: 'NHS Ayrshire & Arran — MSK Physiotherapy',
    authors: null,
  },
  nhsAaaShoulder: {
    title: 'Shoulder Exercises — Stiff and Painful Shoulder (MSK Patient Portal)',
    url: 'https://www.nhsaaa.net/musculoskeletal-msk-service-patient-portal/shoulder-msk-patient-portal/shoulder-exercises-stiff-and-painful-shoulder-msk-patient-portal/',
    institution: 'NHS Ayrshire & Arran — MSK Physiotherapy',
    authors: null,
  },
  cuhKnee: {
    title: 'Knee exercises',
    url: 'https://www.cuh.nhs.uk/patient-information/knee-exercises/',
    institution: 'Cambridge University Hospitals NHS Foundation Trust',
    authors: null,
  },
  southTeesCat: {
    title: 'Cat stretch',
    url: 'https://www.southtees.nhs.uk/resources/cat-stretch/',
    institution: 'South Tees Hospitals NHS Foundation Trust',
    authors: null,
  },
} as const;

type SourceKey = keyof typeof SOURCES;

interface Citation {
  source: SourceKey;
  relevance: ReferenceRelevance;
  sourceExerciseName: string;
  note?: string;
}

// ─── Exercise → citations (keyed by slug) ───────────────────────────
const CITATIONS: Record<string, Citation[]> = {
  ex_knee_flexion: [
    { source: 'cuhKnee', relevance: 'CLOSE', sourceExerciseName: 'Heel slides', note: 'Knee flexion by sliding the heel toward the buttocks; matches the long-sitting variant used in the app.' },
    { source: 'aaosKnee', relevance: 'PARTIAL', sourceExerciseName: 'Hamstring Curls', note: 'Knee flexion performed standing rather than sitting.' },
  ],
  ex_straight_leg_raise: [
    { source: 'aaosKnee', relevance: 'EXACT', sourceExerciseName: 'Straight-Leg Raises' },
    { source: 'cuhKnee', relevance: 'EXACT', sourceExerciseName: 'Straight Leg Raise' },
  ],
  ex_shoulder_flexion: [
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Assisted Flexion', note: 'Stick-assisted flexion lying on the back; the app uses active standing flexion.' },
  ],
  ex_shoulder_abduction: [
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Assisted Abduction', note: 'Assisted by the other arm; the app uses active abduction.' },
  ],
  ex_hip_bridge: [{ source: 'aaosSpine', relevance: 'EXACT', sourceExerciseName: 'Hip Bridge' }],
  ex_neck_rotation: [{ source: 'nhsAaaNeck', relevance: 'EXACT', sourceExerciseName: 'Active Rotations' }],
  ex_ankle_dorsiflexion: [
    { source: 'aaosFootAnkle', relevance: 'EXACT', sourceExerciseName: 'Ankle Dorsiflexion/Plantar Flexion', note: 'Source uses an elastic band for resistance.' },
  ],
  ex_wall_squat: [
    { source: 'aaosKnee', relevance: 'PARTIAL', sourceExerciseName: 'Half Squats', note: 'Free-standing half squat, not against a wall.' },
    { source: 'cuhKnee', relevance: 'PARTIAL', sourceExerciseName: 'Squat', note: 'Mid-stage squat, not against a wall.' },
  ],
  'ex_cat-cow_stretch': [{ source: 'southTeesCat', relevance: 'EXACT', sourceExerciseName: 'Cat stretch' }],
  ex_arm_circles: [
    { source: 'aaosShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Pendulum', note: 'Pendulum circles with the arm hanging, not standing arm circles at shoulder height.' },
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Pendular Exercises', note: 'Pendulum circles with the arm hanging.' },
  ],
  ex_clamshell: [{ source: 'aaosHip', relevance: 'EXACT', sourceExerciseName: 'Clamshell' }],
  ex_prone_scapular_squeeze: [
    { source: 'aaosShoulder', relevance: 'CLOSE', sourceExerciseName: 'Scapula Setting', note: 'Performed lying face down, squeezing the shoulder blades together.' },
  ],
};

// An exercise is PUBLISHED only if it has a verified citation AND every target
// joint has a formula in the angle engine; otherwise it is seeded as DRAFT.
function draftReason(slug: string, joints: string[]): string | null {
  if (!CITATIONS[slug]?.length) return 'No verified source cited.';
  const unmeasurable = joints.filter((j) => !JOINT_FORMULAS[j]);
  if (unmeasurable.length) return `No angle formula for: ${unmeasurable.join(', ')}.`;
  return null;
}

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error('Refusing to wipe a production database. Set SEED_ALLOW_PRODUCTION=true to override.');
  }

  console.log('Wiping existing data…');
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "organizations", "users", "exercises", "exercise_sources" RESTART IDENTITY CASCADE'
  );

  // ─── Sources ──────────────────────────────────────────────────────
  const sourceIds = {} as Record<SourceKey, string>;
  for (const [key, s] of Object.entries(SOURCES) as [SourceKey, (typeof SOURCES)[SourceKey]][]) {
    const created = await db.exerciseSource.create({
      data: {
        sourceType: 'PATIENT_EDUCATION',
        title: s.title,
        url: s.url,
        institution: s.institution,
        authors: s.authors,
        accessedAt: ACCESSED_AT,
        verificationStatus: 'VERIFIED',
        verifiedByType: 'DEVELOPER',
        verifiedByName: VERIFIER_NAME,
        verifiedAt: ACCESSED_AT,
        notes: 'Developer-verified citation (not clinically reviewed). Source does not specify target angles.',
      },
    });
    sourceIds[key] = created.id;
  }

  // ─── Exercises, joint targets, references ─────────────────────────
  const knownSlugs = new Set(EXERCISES.map((e) => exerciseIdFromName(e.name)));
  for (const slug of Object.keys(CITATIONS)) {
    if (!knownSlugs.has(slug)) throw new Error(`Citation refers to unknown exercise slug: ${slug}`);
  }

  const exerciseIds: Record<string, string> = {};
  for (const ex of EXERCISES) {
    const slug = exerciseIdFromName(ex.name);
    const citations = CITATIONS[slug] ?? [];
    const reason = draftReason(slug, ex.targetJoints.map((tj) => tj.name));

    const created = await db.exercise.create({
      data: {
        slug,
        name: ex.name,
        nameTh: ex.nameTh,
        category: ex.category as never,
        bodyPart: ex.bodyPart as never,
        difficulty: ex.difficulty as never,
        description: ex.description,
        instructions: ex.instructions,
        defaultSets: ex.sets,
        defaultReps: ex.repsPerSet,
        defaultRestSeconds: ex.restSeconds,
        icon: ex.icon,
        status: reason ? 'DRAFT' : 'PUBLISHED',
        statusNote: reason,
        targets: {
          create: ex.targetJoints.map((tj, i) => ({
            joint: tj.name as JointName,
            nameTh: tj.nameTh,
            idealAngle: tj.idealAngle,
            minAngle: tj.minAngle,
            maxAngle: tj.maxAngle,
            isPrimary: i === 0,
            formula: JOINT_FORMULAS[tj.name] ?? null,
            angleBasis: 'DEVELOPER_ESTIMATE',
            rationale: tj.rationale ?? null,
          })),
        },
        references: {
          create: citations.map((c) => ({
            sourceId: sourceIds[c.source],
            relevance: c.relevance,
            sourceExerciseName: c.sourceExerciseName,
            note: c.note ?? null,
          })),
        },
      },
    });
    exerciseIds[slug] = created.id;
  }

  // ─── Organizations ────────────────────────────────────────────────
  const hospital = await db.organization.create({
    data: { name: 'โรงพยาบาลสาธิต AI Physio (Demo Hospital)', type: 'HOSPITAL', phone: '02-000-0000' },
  });
  const clinic = await db.organization.create({
    data: { name: 'คลินิกกายภาพบำบัดสาธิต (Demo PT Clinic)', type: 'CLINIC', phone: '02-000-0001' },
  });

  // ─── Users ────────────────────────────────────────────────────────
  const password = process.env.SEED_DEMO_PASSWORD || 'physio-demo-2026';
  const passwordHash = await hashPassword(password);

  await db.user.create({
    data: { email: 'admin@demo.aiphysio.local', name: 'ผู้ดูแลระบบ', role: 'ADMIN', passwordHash },
  });

  const doctor = await db.clinician.create({
    data: {
      title: 'DOCTOR',
      specialty: 'Orthopaedics',
      licenseNumber: 'DEMO-MD-001',
      organization: { connect: { id: hospital.id } },
      user: { create: { email: 'doctor@demo.aiphysio.local', name: 'นพ.ประเสริฐ ตัวอย่าง', role: 'CLINICIAN', passwordHash } },
    },
  });
  const physio = await db.clinician.create({
    data: {
      title: 'PHYSIOTHERAPIST',
      specialty: 'Musculoskeletal physiotherapy',
      licenseNumber: 'DEMO-PT-001',
      organization: { connect: { id: hospital.id } },
      user: { create: { email: 'pt@demo.aiphysio.local', name: 'กภ.สุดา ตัวอย่าง', role: 'CLINICIAN', passwordHash } },
    },
  });
  await db.clinician.create({
    data: {
      title: 'PHYSIOTHERAPIST',
      licenseNumber: 'DEMO-PT-002',
      organization: { connect: { id: clinic.id } },
      user: { create: { email: 'pt2@demo.aiphysio.local', name: 'กภ.อนันต์ ตัวอย่าง', role: 'CLINICIAN', passwordHash } },
    },
  });

  const patientSeeds = [
    { email: 'patient1@demo.aiphysio.local', name: 'คุณสมชาย ใจดี', dob: '1971-03-15', gender: 'MALE', condition: 'ปวดเข่าเรื้อรัง OA Grade 2' },
    { email: 'patient2@demo.aiphysio.local', name: 'คุณสมหญิง รักเรียน', dob: '1984-07-02', gender: 'FEMALE', condition: 'บาดเจ็บไหล่ซ้าย rotator cuff' },
    { email: 'patient3@demo.aiphysio.local', name: 'คุณวิชัย กล้าหาญ', dob: '1966-11-20', gender: 'MALE', condition: 'ท่าเดินผิดปกติ หลังผ่าตัดเข่า' },
  ] as const;

  const patients: Patient[] = [];
  for (const p of patientSeeds) {
    patients.push(
      await db.patient.create({
        data: {
          name: p.name,
          dateOfBirth: new Date(p.dob),
          gender: p.gender,
          condition: p.condition,
          organization: { connect: { id: hospital.id } },
          user: { create: { email: p.email, name: p.name, role: 'PATIENT', passwordHash } },
        },
      })
    );
  }
  const [somchai, somying, wichai] = patients;

  // ─── Care team ────────────────────────────────────────────────────
  await db.careAssignment.createMany({
    data: [
      { patientId: somchai.id, clinicianId: doctor.id, role: 'PRIMARY' },
      { patientId: somying.id, clinicianId: physio.id, role: 'PRIMARY' },
      { patientId: wichai.id, clinicianId: doctor.id, role: 'PRIMARY' },
      { patientId: wichai.id, clinicianId: physio.id, role: 'SUPPORTING' },
    ],
  });

  // ─── Prescriptions (published exercises only) ─────────────────────
  const today = new Date(new Date().toISOString().slice(0, 10));
  const item = (slug: string, sets: number, reps: number, rest: number, daysOfWeek: number[] = [], sortOrder = 0) => {
    if (!exerciseIds[slug]) throw new Error(`Unknown exercise ${slug}`);
    return { exerciseId: exerciseIds[slug], sets, repsPerSet: reps, restSeconds: rest, daysOfWeek, sortOrder };
  };

  await db.prescription.create({
    data: {
      title: 'โปรแกรมฟื้นฟูเข่า OA ระยะที่ 1',
      notes: 'ทำทุกวัน หยุดถ้าปวดเกินระดับ 5/10',
      startDate: today,
      patient: { connect: { id: somchai.id } },
      clinician: { connect: { id: doctor.id } },
      items: {
        create: [
          item('ex_knee_flexion', 3, 10, 30, [], 0),
          item('ex_wall_squat', 2, 8, 45, [1, 3, 5], 1),
          item('ex_ankle_dorsiflexion', 3, 10, 20, [], 2),
        ],
      },
    },
  });

  await db.prescription.create({
    data: {
      title: 'โปรแกรมเพิ่มองศาการเคลื่อนไหวไหล่',
      startDate: today,
      patient: { connect: { id: somying.id } },
      clinician: { connect: { id: physio.id } },
      items: {
        create: [
          item('ex_shoulder_flexion', 3, 10, 30, [1, 3, 5], 0),
          item('ex_shoulder_abduction', 3, 10, 30, [1, 3, 5], 1),
          item('ex_neck_rotation', 2, 8, 20, [], 2),
        ],
      },
    },
  });

  // Post-op patient: knee flexion target lowered by the doctor (override)
  await db.prescription.create({
    data: {
      title: 'ฟื้นฟูหลังผ่าตัดเข่า — สัปดาห์ที่ 2–4',
      notes: 'จำกัดการงอเข่าไม่เกิน 90° ในช่วงนี้',
      startDate: today,
      patient: { connect: { id: wichai.id } },
      clinician: { connect: { id: doctor.id } },
      items: {
        create: [
          {
            ...item('ex_knee_flexion', 2, 10, 45, [], 0),
            targetOverrides: {
              create: [
                { joint: 'left_knee', idealAngle: 100, minAngle: 90, maxAngle: 110 },
                { joint: 'right_knee', idealAngle: 100, minAngle: 90, maxAngle: 110 },
              ],
            },
          },
          item('ex_ankle_dorsiflexion', 3, 10, 20, [], 1),
        ],
      },
    },
  });

  // ─── Summary ──────────────────────────────────────────────────────
  const [published, draft] = await Promise.all([
    db.exercise.count({ where: { status: 'PUBLISHED' } }),
    db.exercise.count({ where: { status: 'DRAFT' } }),
  ]);
  console.log(`Seeded: 2 organizations, 3 clinicians, 3 patients, ${Object.keys(SOURCES).length} sources`);
  console.log(`Exercises: ${published} published, ${draft} draft (see statusNote)`);
  console.log(`Demo password for all accounts: ${password}`);
  console.log('Accounts: admin@ / doctor@ / pt@ / pt2@ / patient1@ / patient2@ / patient3@ demo.aiphysio.local');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
