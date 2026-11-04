/**
 * Development seed: wipes ALL data and creates a demo school (expert,
 * teachers, parents, classes, kids with login cards — src/lib/demo-accounts.ts),
 * the exercise library with cited sources, class mission sets and a
 * SIMULATED play history (prisma/demo-history.ts) for the forecast demo,
 * plus a SIMULATED cohort of earlier (archived) children that the
 * population model uses as its reference.
 *
 *   bun run db:seed        (runs `prisma db seed` → this file)
 *
 * Citations were checked by a developer (not a licensed clinician) on the
 * accessedAt date: each page was opened and confirmed to describe the exercise.
 * None of the sources state target angles — the app's angles are developer
 * estimates (angleBasis = DEVELOPER_ESTIMATE, reasoning in `rationale`) bounded by
 * normative ROM values, until a clinician sets them.
 */
import { PrismaClient, type JointName, type Patient } from '@prisma/client';
import { EXERCISES, exerciseIdFromName, exerciseMeta, targetsForSide } from '../src/lib/exercises-data';
import { ANGLE_ALGORITHM_VERSION, ANGLE_DEFINITION, JOINT_FORMULAS } from '../src/lib/joint-formulas';
import { ACCESSED_AT, CITATIONS, SOURCES, UNVERIFIED_SOURCES, VERIFIER_NAME, exerciseStatus, type SourceKey, type SourceSeed } from './library';
import { hashPassword } from '../src/lib/password';
import { mergeTargets } from '../src/lib/presenters';
import { addDays, dateOnly, localDateString } from '../src/lib/dates';
import { DEMO_NOTE, DEMO_SCENARIOS, generateDemoDays, referenceScenario, type DemoScenario } from './demo-history';
import { assignToClassroom, createKidInClassroom } from '../src/lib/classrooms';
import { DEMO_ADULT_PIN, DEMO_KIDS } from '../src/lib/demo-accounts';
import { TERMS_VERSION } from '../src/lib/terms';
import { VIDEO_CONSENT_VERSION } from '../src/lib/consent';

const db = new PrismaClient();

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
  for (const [key, s] of Object.entries(SOURCES) as [SourceKey, SourceSeed][]) {
    const verified = !UNVERIFIED_SOURCES.has(key);
    const accessedAt = s.accessedAt ?? ACCESSED_AT;
    const created = await db.exerciseSource.create({
      data: {
        sourceType: s.sourceType ?? (verified ? 'PATIENT_EDUCATION' : 'JOURNAL_ARTICLE'),
        title: s.title,
        url: s.url,
        institution: s.institution,
        authors: s.authors,
        language: s.language ?? 'en',
        publishedAt: s.publishedAt ?? null,
        accessedAt,
        ...(verified
          ? {
              verificationStatus: 'VERIFIED' as const,
              verifiedByType: 'DEVELOPER' as const,
              verifiedByName: VERIFIER_NAME,
              verifiedAt: accessedAt,
              notes: s.note ?? 'Developer-verified citation (not clinically reviewed). Source does not specify target angles.',
            }
          : {
              verificationStatus: 'PENDING' as const,
              notes: s.note ?? 'Research dataset: describes the exercise movements, not target angles. Pending verification.',
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
    const { status, statusNote } = exerciseStatus(ex);

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
        status,
        statusNote,
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

  const item = (slug: string, sets: number, reps: number, rest: number, daysOfWeek: number[] = [], sortOrder = 0) => {
    if (!exerciseIds[slug]) throw new Error(`Unknown exercise ${slug}`);
    return { exerciseId: exerciseIds[slug], sets, repsPerSet: reps, restSeconds: rest, daysOfWeek, sortOrder };
  };

  // ─── School ───────────────────────────────────────────────────────
  const school = await db.organization.create({
    data: {
      name: 'โรงเรียนสาธิตยืดยืด (Demo School)',
      type: 'SCHOOL',
      address: '123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กรุงเทพมหานคร 10000',
      phone: '02-000-0000',
    },
  });

  // ─── Adults ───────────────────────────────────────────────────────
  // Adult profiles are Clinician rows (expert / teacher / parent), see schema.prisma
  const password = process.env.SEED_DEMO_PASSWORD || 'physio-demo-2026';
  const passwordHash = await hashPassword(password);
  const pinHash = await hashPassword(DEMO_ADULT_PIN);

  await db.user.create({
    data: { email: 'admin@demo.aiphysio.local', name: 'ผู้ดูแลระบบ', role: 'ADMIN', passwordHash },
  });

  const adult = (
    email: string,
    name: string,
    role: 'CLINICIAN' | 'TEACHER' | 'PARENT',
    title: 'PHYSIOTHERAPIST' | 'TEACHER' | 'PARENT',
    extra: { licenseNumber?: string; specialty?: string; pin?: boolean } = {}
  ) =>
    db.clinician.create({
      data: {
        title,
        licenseNumber: extra.licenseNumber ?? null,
        specialty: extra.specialty ?? null,
        organization: { connect: { id: school.id } },
        user: { create: { email, name, role, passwordHash, adultPinHash: extra.pin ? pinHash : null } },
      },
    });

  const expert = await adult('pt@demo.aiphysio.local', 'อ.กภ.สุดา ใจดี', 'CLINICIAN', 'PHYSIOTHERAPIST', {
    licenseNumber: 'DEMO-PT-001',
    specialty: 'กายภาพบำบัดเด็ก',
  });
  const teacher1 = await adult('teacher1@demo.aiphysio.local', 'ครูมาลี สอนดี', 'TEACHER', 'TEACHER', { pin: true });
  const teacher2 = await adult('teacher2@demo.aiphysio.local', 'ครูวิทย์ ใฝ่รู้', 'TEACHER', 'TEACHER', { pin: true });
  const parent1 = await adult('parent1@demo.aiphysio.local', 'คุณแม่น้ำฝน รักลูก', 'PARENT', 'PARENT', { pin: true });
  const parent2 = await adult('parent2@demo.aiphysio.local', 'คุณพ่อสมศักดิ์ ใจเย็น', 'PARENT', 'PARENT', { pin: true });
  const parent3 = await adult('parent3@demo.aiphysio.local', 'คุณแม่พิมพ์ใจ ยิ้มแย้ม', 'PARENT', 'PARENT');

  // ─── Classes, class mission sets and kids ─────────────────────────
  const class1 = await db.classroom.create({
    data: { name: 'ป.3/1', gradeLabel: 'ประถมศึกษาปีที่ 3', organizationId: school.id, teacherId: teacher1.id },
  });
  const class2 = await db.classroom.create({
    data: { name: 'ป.5/2', gradeLabel: 'ประถมศึกษาปีที่ 5', organizationId: school.id, teacherId: teacher2.id },
  });

  // Class sets use PUBLISHED exercises only: drafts never become quests.
  // Kids first, then the class sets (assignToClassroom gives every member a copy)
  const kids: Record<string, Patient> = {};
  for (const k of DEMO_KIDS) {
    const classroom = k.classroom === 1 ? class1 : class2;
    const card = await createKidInClassroom(db, classroom, { name: k.name, nickname: k.nickname, avatar: k.avatar, pictures: [...k.pictures] });
    kids[k.nickname] = await db.patient.update({
      where: { id: card.id },
      data: { kidCode: k.kidCode, parentLinkCode: k.parentLinkCode, dateOfBirth: new Date(k.dob), gender: k.gender },
    });
  }

  const startDate = addDays(localDateString(), -DEMO_SCENARIOS.improving.daysBack - 1);
  const planItem = (slug: string, sets: number, reps: number, daysOfWeek: number[] = []) => item(slug, sets, reps, 20, daysOfWeek);
  await assignToClassroom(db, class1, {
    title: 'ยืดเหยียดยามเช้า',
    notes: 'ทำก่อนเข้าแถวหรือหลังพักกลางวัน',
    startDate,
    endDate: null,
    items: [planItem('ex_arm_circles', 2, 8), planItem('ex_shoulder_abduction', 2, 6, [1, 3, 5]), planItem('ex_trunk_lateral_flexion', 1, 6, [2, 4])],
  });
  await assignToClassroom(db, class2, {
    title: 'ขาแข็งแรง หลังตรง',
    notes: 'เน้นหลังตรงทุกท่า',
    startDate,
    endDate: null,
    items: [planItem('ex_squat', 2, 8), planItem('ex_standing_hip_abduction', 1, 6), planItem('ex_arm_circles', 2, 8, [1, 3, 5])],
  });

  // Parents (parent1 has two children in different classes)
  const guardians: [string, string][] = [
    [parent1.id, 'มะลิ'],
    [parent1.id, 'ต้นกล้า'],
    [parent2.id, 'ภูผา'],
    [parent3.id, 'ใบเตย'],
  ];
  await db.careAssignment.createMany({
    data: guardians.map(([clinicianId, nick]) => ({ clinicianId, patientId: kids[nick].id, role: 'GUARDIAN' as const })),
  });
  // The expert advises both classes
  await db.careAssignment.createMany({
    data: Object.values(kids).map((k) => ({ clinicianId: expert.id, patientId: k.id, role: 'SUPPORTING' as const })),
  });

  // Consent: parents accepted for most kids; one has school paper consent only; one has none yet
  const consentAt = new Date(Date.now() - 45 * 86_400_000);
  for (const nick of ['มะลิ', 'ต้นกล้า', 'ภูผา', 'ใบเตย']) {
    await db.patient.update({ where: { id: kids[nick].id }, data: { consentVersion: TERMS_VERSION, consentAt } });
  }
  await db.patient.update({ where: { id: kids['มะลิ'].id }, data: { videoConsentAt: consentAt, videoConsentVersion: VIDEO_CONSENT_VERSION } });
  await db.patient.update({ where: { id: kids['ข้าวหอม'].id }, data: { schoolConsentAt: consentAt } });
  // 'ปุยฝ้าย' has no consent yet: the teacher screen shows "waiting for a parent"

  // ─── Simulated history (demo only) ─────────────────────────────────
  await seedDemoHistory({ patientId: kids['มะลิ'].id, slug: 'ex_arm_circles', scenario: DEMO_SCENARIOS.improving, reviewerId: expert.id });
  await seedDemoHistory({ patientId: kids['ต้นกล้า'].id, slug: 'ex_squat', scenario: DEMO_SCENARIOS.plateau, reviewerId: expert.id });
  await seedDemoHistory({ patientId: kids['ภูผา'].id, slug: 'ex_squat', scenario: DEMO_SCENARIOS.improving, reviewerId: expert.id });
  await seedDemoHistory({ patientId: kids['ข้าวหอม'].id, slug: 'ex_arm_circles', scenario: DEMO_SCENARIOS.newPatient, reviewerId: expert.id });
  for (const k of Object.values(kids)) {
    await db.patient.update({ where: { id: k.id }, data: { clinicalNotes: `${DEMO_NOTE}: ประวัติการเล่นย้อนหลังสร้างขึ้นเพื่อสาธิต` } });
  }

  // ─── Simulated reference cohort (population model demo) ─────────────
  // Earlier children (archived, so hidden from every list) whose measured
  // progress the population model compares current children with.
  const REFERENCE_COHORT = [
    { kind: 'knee' as const, slug: 'ex_squat', count: 8, clinicianId: teacher1.id },
    { kind: 'shoulder' as const, slug: 'ex_shoulder_abduction', count: 6, clinicianId: teacher1.id },
  ];
  for (const group of REFERENCE_COHORT) {
    for (let i = 0; i < group.count; i++) {
      const scenario = referenceScenario(group.kind, i);
      const code = `${group.kind === 'knee' ? 'K' : 'S'}${String(i + 1).padStart(2, '0')}`;
      const finalDeficit = scenario.deficit(scenario.daysBack - (scenario.endDaysAgo ?? 1));
      const ref = await db.patient.create({
        data: {
          name: `เด็กจำลอง (อ้างอิง) ${code}`,
          hn: `SIM-${code}`,
          gender: i % 2 ? 'FEMALE' : 'MALE',
          dateOfBirth: new Date(Date.UTC(2014 + (i % 5), i % 12, 1)),
          organization: { connect: { id: school.id } },
          clinicalNotes: `${DEMO_NOTE}: เด็กอ้างอิงสำหรับแบบจำลองประชากร`,
          archivedAt: new Date(Date.now() - ((scenario.endDaysAgo ?? 1) - 1) * 86_400_000),
        },
      });
      await db.prescription.create({
        data: {
          title: `${DEMO_NOTE} — ${group.slug}`,
          startDate: dateOnly(addDays(localDateString(), -scenario.daysBack)),
          endDate: dateOnly(addDays(localDateString(), -(scenario.endDaysAgo ?? 1))),
          status: 'COMPLETED',
          outcome: finalDeficit <= 3 ? 'GOAL_MET' : 'PARTIAL',
          outcomeAt: new Date(Date.now() - (scenario.endDaysAgo ?? 1) * 86_400_000),
          patient: { connect: { id: ref.id } },
          clinician: { connect: { id: group.clinicianId } },
          items: { create: [item(group.slug, 2, 10, 30, scenario.daysOfWeek)] },
        },
      });
      await seedDemoHistory({ patientId: ref.id, slug: group.slug, scenario, reviewerId: expert.id });
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────
  const [published, draft, retiredCount] = await Promise.all([
    db.exercise.count({ where: { status: 'PUBLISHED' } }),
    db.exercise.count({ where: { status: 'DRAFT' } }),
    db.exercise.count({ where: { status: 'RETIRED' } }),
  ]);
  console.log(`Seeded: 1 school, 1 expert, 2 teachers, 3 parents, 2 classes, ${DEMO_KIDS.length} kids, ${Object.keys(SOURCES).length} sources`);
  console.log(`Simulated reference cohort: ${REFERENCE_COHORT.reduce((n, g) => n + g.count, 0)} archived children (population model)`);
  console.log(`Exercises: ${published} published, ${draft} draft, ${retiredCount} retired (see statusNote)`);
  console.log(`Simulated history: ${await db.exerciseSession.count({ where: { notes: DEMO_NOTE } })} sessions (marked "${DEMO_NOTE}")`);
  console.log(`Demo password for adult accounts: ${password} · adult PIN: ${DEMO_ADULT_PIN}`);
  console.log('Adults: pt@ (expert) / teacher1@ / teacher2@ / parent1@ / parent2@ / parent3@ demo.aiphysio.local');
  console.log(`Kids: ${DEMO_KIDS.map((k) => `${k.nickname} ${k.kidCode} [${k.pictures.join(' ')}]`).join(' · ')}`);
}

// ─── Simulated training history (prisma/demo-history.ts) ──────────────
// Past quests + completed sessions so the recovery forecast, trends and
// reports have data in a fresh demo database. Every session is marked with
// DEMO_NOTE; sessions older than 3 days are already reviewed.
async function seedDemoHistory(opts: { patientId: string; slug: string; scenario: DemoScenario; reviewerId: string }) {
  const item = await db.prescriptionItem.findFirst({
    where: { prescription: { patientId: opts.patientId }, exercise: { slug: opts.slug } },
    include: { exercise: { include: { targets: true } }, targetOverrides: true, prescription: true },
  });
  if (!item) throw new Error(`No prescription item for ${opts.slug}`);

  // One-side-at-a-time exercises are simulated on the left side (Somying: left shoulder)
  const meta = exerciseMeta(item.exercise.slug);
  const side = meta.unilateral ? ('left' as const) : null;
  const merged = mergeTargets(item.exercise.targets, item.targetOverrides);
  const targets = side ? targetsForSide(merged, side) : merged;
  const primary = targets.find((t) => t.isPrimary) ?? targets[0];
  const snapshot = {
    exerciseSlug: item.exercise.slug,
    exerciseName: item.exercise.name,
    sets: item.sets,
    repsPerSet: item.repsPerSet,
    restSeconds: item.restSeconds,
    holdSeconds: meta.holdSeconds,
    side,
    angleDefinition: ANGLE_DEFINITION,
    targets,
    formChecks: item.exercise.formChecks,
  };
  const today = localDateString();
  const recentCutoff = addDays(today, -3);

  for (const d of generateDemoDays(opts.scenario, primary, today)) {
    const quest = await db.quest.create({
      data: {
        prescriptionItemId: item.id,
        patientId: opts.patientId,
        dueDate: dateOnly(d.day),
        status: d.done ? 'COMPLETED' : 'MISSED',
        completedAt: d.done ? new Date(d.startedAt!.getTime() + 5 * 60_000) : null,
      },
    });
    if (!d.done) continue;

    const reps = d.reps!;
    const startedAt = d.startedAt!;
    const session = await db.exerciseSession.create({
      data: {
        patientId: opts.patientId,
        exerciseId: item.exerciseId,
        questId: quest.id,
        prescriptionId: item.prescriptionId,
        prescriptionItemId: item.id,
        clinicianId: item.prescription.clinicianId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + 5 * 60_000),
        status: 'COMPLETED',
        totalReps: reps.length,
        avgAccuracy: reps.length ? Math.round(reps.reduce((a, r) => a + r.accuracy, 0) / reps.length) : 0,
        romMinAngle: d.romMinAngle,
        romMaxAngle: d.romMaxAngle,
        romDegrees: Math.round((d.romMaxAngle! - d.romMinAngle!) * 10) / 10,
        primaryJoint: primary.name as JointName,
        targetSnapshot: snapshot as never,
        algorithmVersion: ANGLE_ALGORITHM_VERSION,
        notes: DEMO_NOTE,
      },
    });

    const createdReps = reps.length
      ? await db.sessionRep.createManyAndReturn({
          data: reps.map((r, i) => ({
            sessionId: session.id,
            setNumber: Math.floor(i / item.repsPerSet) + 1,
            repNumber: i + 1,
            enteredAt: new Date(startedAt.getTime() + (i + 1) * 15_000),
            durationMs: 1200,
            bestAngle: r.bestAngle,
            accuracy: r.accuracy,
            isCorrect: r.accuracy >= 60,
          })),
        })
      : [];
    if (createdReps.length) {
      await db.jointAngleLog.createMany({
        data: createdReps.map((r) => ({
          sessionId: session.id,
          repId: r.id,
          joint: primary.name as JointName,
          angle: r.bestAngle,
          idealAngle: primary.idealAngle,
          minAngle: primary.minAngle,
          maxAngle: primary.maxAngle,
          deviation: Math.round(Math.abs(r.bestAngle - primary.idealAngle) * 10) / 10,
          isCorrect: r.accuracy >= 60,
          timestamp: r.enteredAt,
        })),
      });
    }
    if (d.incomplete!.length) {
      await db.sessionFault.createMany({
        data: d.incomplete!.map((f, i) => ({
          sessionId: session.id,
          type: 'INCOMPLETE_ROM' as const,
          joint: primary.name as JointName,
          measuredAngle: f.measuredAngle,
          expectedMin: primary.minAngle,
          expectedMax: primary.maxAngle,
          deficit: f.deficit,
          message: `Range not reached — ${f.deficit}° short of the target`,
          occurredAt: new Date(startedAt.getTime() + (i + 1) * 15_000),
        })),
      });
    }
    if (d.day < recentCutoff) {
      await db.sessionReview.create({
        data: { sessionId: session.id, clinicianId: opts.reviewerId, status: 'APPROVED', reviewedAt: new Date(startedAt.getTime() + 86_400_000) },
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
