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
  // Telerehabilitation datasets: they describe the movements, not target angles.
  // Seeded PENDING (see UNVERIFIED_SOURCES) until a developer or clinician checks them.
  kimore: {
    title: 'The KIMORE Dataset: KInematic Assessment of MOvement and Clinical Scores for Remote Monitoring of Physical REhabilitation (IEEE TNSRE, 2019)',
    url: 'https://vrai.dii.univpm.it/content/kimore-dataset',
    institution: 'Università Politecnica delle Marche — VRAI Lab',
    authors: 'Capecci M., Ceravolo M. G., Ferracuti F., Iarlori S., Monteriù A., Romeo L., Verdini F.',
  },
  rehab24: {
    title: 'REHAB24-6: A multi-modal dataset of physical rehabilitation exercises',
    url: 'https://zenodo.org/records/13305826',
    institution: 'Masaryk University — Faculty of Informatics',
    authors: 'Černek A., Sedmidubsky J., Budikova P., Jánošová M., Katzer L., Procházka M.',
  },
} as const;

type SourceKey = keyof typeof SOURCES;

// Sources not yet opened and checked by a person: seeded PENDING, so they
// never make an exercise PUBLISHED on their own.
const UNVERIFIED_SOURCES = new Set<SourceKey>(['kimore', 'rehab24']);

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
  ex_shoulder_flexion: [
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Assisted Flexion', note: 'Stick-assisted flexion lying on the back; the app uses active standing flexion.' },
  ],
  ex_shoulder_abduction: [
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Assisted Abduction', note: 'Assisted by the other arm; the app uses active abduction.' },
  ],
  ex_wall_squat: [
    { source: 'aaosKnee', relevance: 'PARTIAL', sourceExerciseName: 'Half Squats', note: 'Free-standing half squat, not against a wall.' },
    { source: 'cuhKnee', relevance: 'PARTIAL', sourceExerciseName: 'Squat', note: 'Mid-stage squat, not against a wall.' },
  ],
  ex_arm_circles: [
    { source: 'aaosShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Pendulum', note: 'Pendulum circles with the arm hanging, not standing arm circles at shoulder height.' },
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Pendular Exercises', note: 'Pendulum circles with the arm hanging.' },
  ],
  ex_trunk_lateral_flexion: [
    { source: 'kimore', relevance: 'CLOSE', sourceExerciseName: 'Lateral tilt of the trunk with the arms in extension (Ex2)' },
  ],
  ex_trunk_rotation: [{ source: 'kimore', relevance: 'CLOSE', sourceExerciseName: 'Trunk rotation (Ex3)' }],
  ex_squat: [
    { source: 'kimore', relevance: 'CLOSE', sourceExerciseName: 'Squatting (Ex5)' },
    { source: 'rehab24', relevance: 'EXACT', sourceExerciseName: 'Squats (Ex6)' },
    { source: 'aaosKnee', relevance: 'CLOSE', sourceExerciseName: 'Half Squats', note: 'Partial-depth squat; the app allows up to a parallel squat.' },
  ],
  ex_forward_lunge: [{ source: 'rehab24', relevance: 'CLOSE', sourceExerciseName: 'Leg lunge (Ex5)' }],
  ex_side_lunge: [
    { source: 'rehab24', relevance: 'PARTIAL', sourceExerciseName: 'Leg lunge (Ex5)', note: 'Lateral variation of the dataset lunge.' },
  ],
  ex_standing_hip_abduction: [{ source: 'rehab24', relevance: 'CLOSE', sourceExerciseName: 'Leg abduction (Ex4)' }],
};

// An exercise is PUBLISHED only if it has a verified citation AND every target
// joint has a formula in the angle engine; otherwise it is seeded as DRAFT.
function draftReason(slug: string, joints: string[]): string | null {
  if (!CITATIONS[slug]?.some((c) => !UNVERIFIED_SOURCES.has(c.source))) {
    return CITATIONS[slug]?.length ? 'Cited sources are pending verification.' : 'No verified source cited.';
  }
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
    const verified = !UNVERIFIED_SOURCES.has(key);
    const created = await db.exerciseSource.create({
      data: {
        sourceType: verified ? 'PATIENT_EDUCATION' : 'JOURNAL_ARTICLE',
        title: s.title,
        url: s.url,
        institution: s.institution,
        authors: s.authors,
        accessedAt: ACCESSED_AT,
        ...(verified
          ? {
              verificationStatus: 'VERIFIED' as const,
              verifiedByType: 'DEVELOPER' as const,
              verifiedByName: VERIFIER_NAME,
              verifiedAt: ACCESSED_AT,
              notes: 'Developer-verified citation (not clinically reviewed). Source does not specify target angles.',
            }
          : {
              verificationStatus: 'PENDING' as const,
              notes: 'Research dataset: describes the exercise movements, not target angles. Pending verification.',
            }),
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
        formChecks: (ex.formChecks ?? []) as never,
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
    data: {
      name: 'โรงพยาบาลสาธิต AI Physio (Demo Hospital)',
      type: 'HOSPITAL',
      address: 'กลุ่มงานเวชศาสตร์ฟื้นฟู 123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10000',
      phone: '02-000-0000',
    },
  });
  const clinic = await db.organization.create({
    data: {
      name: 'คลินิกกายภาพบำบัดสาธิต (Demo PT Clinic)',
      type: 'CLINIC',
      address: '45 ถนนตัวอย่าง ตำบลตัวอย่าง อำเภอเมือง จังหวัดตัวอย่าง 50000',
      phone: '02-000-0001',
    },
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
    { hn: '69-00001', email: 'patient1@demo.aiphysio.local', name: 'คุณสมชาย ใจดี', dob: '1971-03-15', gender: 'MALE', condition: 'ปวดเข่าเรื้อรัง OA Grade 2' },
    { hn: '69-00002', email: 'patient2@demo.aiphysio.local', name: 'คุณสมหญิง รักเรียน', dob: '1984-07-02', gender: 'FEMALE', condition: 'บาดเจ็บไหล่ซ้าย rotator cuff' },
    { hn: '69-00003', email: 'patient3@demo.aiphysio.local', name: 'คุณวิชัย กล้าหาญ', dob: '1966-11-20', gender: 'MALE', condition: 'ท่าเดินผิดปกติ หลังผ่าตัดเข่า' },
  ] as const;

  const patients: Patient[] = [];
  for (const p of patientSeeds) {
    patients.push(
      await db.patient.create({
        data: {
          name: p.name,
          hn: p.hn,
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
          item('ex_squat', 2, 8, 45, [2, 4, 6], 2),
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
          item('ex_arm_circles', 2, 10, 30, [], 2),
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
