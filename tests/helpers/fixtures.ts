import type { JointName } from '@prisma/client';
import { db } from '@/lib/db';
import { TERMS_VERSION } from '@/lib/terms';
import { JOINT_FORMULAS, ANGLE_ALGORITHM_VERSION } from '@/lib/joint-formulas';
import { addDays, dateOnly, localDateString } from '@/lib/dates';
import { DEMO_SCENARIOS, generateDemoDays, referenceScenario, type DemoScenario } from '../../prisma/demo-history';
import type { TestUser } from './api';

/**
 * Wipes the TEST database and builds a small clinic:
 *  - doctorA (care team of p1 and p3), doctorB (care team of p2), doctorNew (terms not accepted)
 *  - p1: knee flexion, improving history → on_track
 *  - p2: no history (belongs to doctorB only)
 *  - p3: knee flexion, stalled history → plateau
 *  - refs: 5 discharged (archived) knee-flexion patients → population model reference
 */
export async function resetAndSeed() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url || url !== process.env.TEST_DATABASE_URL || !/test/i.test(new URL(url).pathname)) {
    throw new Error('Refusing to wipe a database that is not the configured TEST_DATABASE_URL');
  }
  await db.$executeRawUnsafe('TRUNCATE TABLE "organizations", "users", "exercises", "exercise_sources" RESTART IDENTITY CASCADE');

  const org = await db.organization.create({ data: { name: 'Test Hospital', type: 'HOSPITAL' } });

  const clinician = async (email: string, acceptedTerms = true) => {
    const c = await db.clinician.create({
      data: {
        title: 'DOCTOR',
        licenseNumber: `LIC-${email}`,
        organization: { connect: { id: org.id } },
        user: {
          create: {
            email,
            name: email,
            role: 'CLINICIAN',
            passwordHash: 'x',
            termsVersion: acceptedTerms ? TERMS_VERSION : null,
            termsAcceptedAt: acceptedTerms ? new Date() : null,
          },
        },
      },
      include: { user: true },
    });
    const user: TestUser = { id: c.userId, name: email, email, role: 'CLINICIAN', clinicianId: c.id, patientId: null, organizationId: org.id };
    return { id: c.id, user };
  };

  const patient = async (email: string, hn: string) => {
    const p = await db.patient.create({
      data: {
        name: `Patient ${hn}`,
        hn,
        organization: { connect: { id: org.id } },
        user: { create: { email, name: `Patient ${hn}`, role: 'PATIENT', passwordHash: 'x', termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() } },
      },
      include: { user: true },
    });
    const user: TestUser = { id: p.userId!, name: p.name, email, role: 'PATIENT', clinicianId: null, patientId: p.id, organizationId: org.id };
    return { id: p.id, user };
  };

  const doctorA = await clinician('a@test.local');
  const doctorB = await clinician('b@test.local');
  const doctorNew = await clinician('new@test.local', false);
  const p1 = await patient('p1@test.local', 'T-001');
  const p2 = await patient('p2@test.local', 'T-002');
  const p3 = await patient('p3@test.local', 'T-003');
  await db.careAssignment.createMany({
    data: [
      { patientId: p1.id, clinicianId: doctorA.id, role: 'PRIMARY' },
      { patientId: p3.id, clinicianId: doctorA.id, role: 'PRIMARY' },
      { patientId: p2.id, clinicianId: doctorB.id, role: 'PRIMARY' },
    ],
  });

  const target = { joint: 'left_knee' as JointName, nameTh: 'เข่าซ้าย', idealAngle: 90, minAngle: 80, maxAngle: 100 };
  const exercise = await db.exercise.create({
    data: {
      slug: 'ex_knee_flexion',
      name: 'Knee Flexion',
      nameTh: 'การงอเข่า',
      category: 'knee' as never,
      bodyPart: 'lower' as never,
      difficulty: 'beginner' as never,
      description: 'test',
      instructions: ['นั่งบนเก้าอี้'],
      status: 'PUBLISHED',
      targets: { create: [{ ...target, isPrimary: true, formula: JOINT_FORMULAS.left_knee, angleBasis: 'DEVELOPER_ESTIMATE' }] },
    },
  });

  const prescribe = async (patientId: string, clinicianId: string, scenario: DemoScenario) => {
    const rx = await db.prescription.create({
      data: {
        title: 'Test plan',
        startDate: dateOnly(addDays(localDateString(), -scenario.daysBack)),
        patient: { connect: { id: patientId } },
        clinician: { connect: { id: clinicianId } },
        items: { create: [{ exerciseId: exercise.id, sets: 1, repsPerSet: 10, restSeconds: 30, daysOfWeek: [] }] },
      },
      include: { items: true },
    });
    const item = rx.items[0];
    const snapshot = { targets: [{ name: 'left_knee', nameTh: target.nameTh, idealAngle: 90, minAngle: 80, maxAngle: 100, isPrimary: true }] };
    for (const d of generateDemoDays(scenario, { name: 'left_knee', idealAngle: 90, minAngle: 80, maxAngle: 100 }, localDateString())) {
      const quest = await db.quest.create({
        data: { prescriptionItemId: item.id, patientId, dueDate: dateOnly(d.day), status: d.done ? 'COMPLETED' : 'MISSED' },
      });
      if (!d.done) continue;
      await db.exerciseSession.create({
        data: {
          patientId,
          exerciseId: exercise.id,
          questId: quest.id,
          prescriptionId: rx.id,
          prescriptionItemId: item.id,
          clinicianId,
          startedAt: d.startedAt!,
          endedAt: new Date(d.startedAt!.getTime() + 300_000),
          status: 'COMPLETED',
          totalReps: d.reps!.length,
          romMinAngle: d.romMinAngle,
          romMaxAngle: d.romMaxAngle,
          primaryJoint: 'left_knee',
          targetSnapshot: snapshot,
          algorithmVersion: ANGLE_ALGORITHM_VERSION,
        },
      });
    }
    return { prescriptionId: rx.id, itemId: item.id };
  };

  await prescribe(p1.id, doctorA.id, DEMO_SCENARIOS.improving);
  await prescribe(p3.id, doctorA.id, DEMO_SCENARIOS.plateau);

  const refs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const ref = await db.patient.create({ data: { name: `Reference ${i}`, organization: { connect: { id: org.id } } } });
    await prescribe(ref.id, doctorA.id, referenceScenario('knee', i));
    await db.patient.update({ where: { id: ref.id }, data: { archivedAt: new Date() } });
    refs.push(ref.id);
  }

  return { org, doctorA, doctorB, doctorNew, p1, p2, p3, exercise, refs };
}

export type Fixtures = Awaited<ReturnType<typeof resetAndSeed>>;
