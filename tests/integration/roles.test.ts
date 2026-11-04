import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { integrationEnabled, json, params, req, signInAs, type TestUser } from '../helpers/api';
import type { Fixtures } from '../helpers/fixtures';

// Kids-branch roles end to end against the test database: a teacher builds a
// class, a parent registers with the card's link code and consents, the
// teacher assigns missions, the child signs in (code + pictures, or an adult
// switches to them) and plays. Login providers are called directly.

const enabled = integrationEnabled();

describe.skipIf(!enabled)('Kids roles (integration)', () => {
  let f: Fixtures;
  let db: typeof import('@/lib/db').db;
  let teacher: TestUser;
  let teacher2: TestUser;
  let classroomId: string;
  let card: { id: string; kidCode: string; pictures: string[]; parentLinkCode: string };
  let otherKid: { id: string };
  let parent: TestUser;
  let kid: TestUser;

  /** next-auth Credentials provider's authorize() by provider id */
  const authorize = async (id: string, credentials: Record<string, string>) => {
    const { authOptions } = await import('@/lib/auth');
    // Before next-auth merges them, a custom provider id lives in `options.id`
    type Provider = { id: string; options: { id?: string; authorize: (c: Record<string, string>) => Promise<unknown> } };
    const p = (authOptions.providers as unknown as Provider[]).find((x) => (x.options.id ?? x.id) === id)!;
    return p.options.authorize(credentials) as Promise<{ id: string; role: string; patientId: string | null; returnUserId: string | null } | null>;
  };

  beforeAll(async () => {
    ({ db } = await import('@/lib/db'));
    const { resetAndSeed } = await import('../helpers/fixtures');
    const { hashPassword } = await import('@/lib/password');
    const { TERMS_VERSION } = await import('@/lib/terms');
    f = await resetAndSeed();

    const makeTeacher = async (email: string) => {
      const c = await db.clinician.create({
        data: {
          title: 'TEACHER',
          organization: { connect: { id: f.org.id } },
          user: { create: { email, name: email, role: 'TEACHER', passwordHash: await hashPassword('teacher-pass'), termsVersion: TERMS_VERSION } },
        },
      });
      return { id: c.userId, name: email, email, role: 'TEACHER', clinicianId: c.id, patientId: null, organizationId: f.org.id } as TestUser;
    };
    teacher = await makeTeacher('teacher@test.local');
    teacher2 = await makeTeacher('teacher2@test.local');
  }, 60_000);

  afterAll(async () => {
    signInAs(null);
    await db?.$disconnect();
  });

  describe('teacher builds a class', () => {
    test('only a teacher can create a class', async () => {
      const route = await import('@/app/api/classrooms/route');
      signInAs(f.doctorA.user);
      expect((await route.POST(req('/api/classrooms', { method: 'POST', body: { name: 'ป.1/1' } }))).status).toBe(403);
      signInAs(teacher);
      const created = await json(await route.POST(req('/api/classrooms', { method: 'POST', body: { name: 'ป.3/1', gradeLabel: 'ป.3' } })));
      expect(created.status).toBe(201);
      classroomId = created.body.id;
    });

    test('adding students returns printable cards with codes and pictures', async () => {
      const route = await import('@/app/api/classrooms/[id]/students/route');
      signInAs(teacher);
      const res = await json(
        await route.POST(req('/x', { method: 'POST', body: { students: [{ name: 'ด.ญ.มะลิ', nickname: 'มะลิ' }, { name: 'ด.ช.ภู' }] } }), params({ id: classroomId }))
      );
      expect(res.status).toBe(201);
      expect(res.body.cards).toHaveLength(2);
      card = res.body.cards[0];
      otherKid = res.body.cards[1];
      expect(card.kidCode).toMatch(/^[A-Z2-9]{6}$/);
      expect(card.pictures).toHaveLength(3);
      expect(card.parentLinkCode).toHaveLength(8);
    });

    test("another teacher cannot see or change the class (404)", async () => {
      const detail = await import('@/app/api/classrooms/[id]/route');
      const students = await import('@/app/api/classrooms/[id]/students/route');
      signInAs(teacher2);
      expect((await detail.GET(req('/x'), params({ id: classroomId }))).status).toBe(404);
      expect((await students.POST(req('/x', { method: 'POST', body: { students: [{ name: 'x' }] } }), params({ id: classroomId }))).status).toBe(404);
    });

    test('only a teacher assigns class sets; the class set reaches every child', async () => {
      const plans = await import('@/app/api/classrooms/[id]/plans/route');
      const body = { title: 'ยืดเช้า', items: [{ exerciseId: f.exercise.id, sets: 1, repsPerSet: 5 }] };
      signInAs(f.doctorA.user);
      expect((await plans.POST(req('/x', { method: 'POST', body }), params({ id: classroomId }))).status).toBe(403);
      signInAs(teacher);
      const res = await json(await plans.POST(req('/x', { method: 'POST', body }), params({ id: classroomId })));
      expect(res.status).toBe(201);
      expect(res.body.kids).toBe(2);
      expect((await plans.POST(req('/x', { method: 'POST', body }), params({ id: classroomId }))).status).toBe(409);
    });

    // Decision 0005: the expert gives one child missions, but never changes a class set
    test("the expert gives one child missions but cannot change the class set", async () => {
      const rx = await import('@/app/api/prescriptions/route');
      const one = await import('@/app/api/prescriptions/[id]/route');
      const items = await import('@/app/api/prescriptions/[id]/items/route');
      const item = { exerciseId: f.exercise.id, sets: 1, repsPerSet: 5 };
      signInAs(f.doctorA.user);
      const made = await json(await rx.POST(req('/api/prescriptions', { method: 'POST', body: { patientId: f.p1.id, title: 'เพิ่มจากผู้เชี่ยวชาญ', items: [item] } })));
      expect(made.status).toBe(201);
      expect(made.body.classroomId).toBeNull();
      expect((await items.POST(req('/x', { method: 'POST', body: item }), params({ id: made.body.id }))).status).toBe(201);
      expect((await one.DELETE(req('/x', { method: 'DELETE' }), params({ id: made.body.id }))).status).toBe(200);

      const classSet = await db.prescription.findFirstOrThrow({ where: { classroomId, status: 'ACTIVE' } });
      // The expert advises this child too, so a refusal is about the class set, not access
      await db.careAssignment.create({ data: { clinicianId: f.doctorA.id, patientId: classSet.patientId, role: 'SUPPORTING' } });
      expect((await items.POST(req('/x', { method: 'POST', body: item }), params({ id: classSet.id }))).status).toBe(403);
      expect((await one.DELETE(req('/x', { method: 'DELETE' }), params({ id: classSet.id }))).status).toBe(403);
      expect((await one.PATCH(req('/x', { method: 'PATCH', body: { title: 'x' } }), params({ id: classSet.id }))).status).toBe(403);
      await db.careAssignment.deleteMany({ where: { clinicianId: f.doctorA.id, patientId: classSet.patientId } });
    });

    test('a child added later gets the active class set', async () => {
      const students = await import('@/app/api/classrooms/[id]/students/route');
      signInAs(teacher);
      const res = await json(await students.POST(req('/x', { method: 'POST', body: { students: [{ name: 'ด.ญ.ใหม่' }] } }), params({ id: classroomId })));
      const late = res.body.cards[0].id;
      expect(await db.prescription.count({ where: { patientId: late, classroomId, status: 'ACTIVE' } })).toBe(1);
    });

    test('class page shows today, consent and codes to the teacher only', async () => {
      const detail = await import('@/app/api/classrooms/[id]/route');
      signInAs(teacher);
      const res = await json(await detail.GET(req('/x'), params({ id: classroomId })));
      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(3);
      expect(res.body.plans).toEqual([expect.objectContaining({ title: 'ยืดเช้า', kids: 3 })]);
      const s = res.body.students.find((x: { id: string }) => x.id === card.id);
      expect(s.kidCode).toBe(card.kidCode);
      expect(s.hasConsent).toBe(false);
    });
  });

  describe('parent links and consents', () => {
    test('parent registers with the link code and becomes guardian', async () => {
      const route = await import('@/app/api/parent/register/route');
      const bad = await route.POST(req('/x', { method: 'POST', body: { linkCode: 'ZZZZZZZZ', name: 'แม่', email: 'mom@test.local', password: 'mom-password' } }));
      expect(bad.status).toBe(404);
      const res = await json(
        await route.POST(req('/x', { method: 'POST', body: { linkCode: card.parentLinkCode.toLowerCase(), name: 'แม่มะลิ', email: 'mom@test.local', password: 'mom-password' } }))
      );
      expect(res.status).toBe(201);
      const u = await db.user.findUniqueOrThrow({ where: { email: 'mom@test.local' }, include: { clinician: true } });
      const { TERMS_VERSION } = await import('@/lib/terms');
      await db.user.update({ where: { id: u.id }, data: { termsVersion: TERMS_VERSION } });
      parent = { id: u.id, name: u.name, email: u.email, role: 'PARENT', clinicianId: u.clinician!.id, patientId: null, organizationId: f.org.id };
    });

    test("a parent sees only their own child", async () => {
      const list = await import('@/app/api/parent/children/route');
      const detail = await import('@/app/api/patients/[id]/route');
      signInAs(parent);
      const kids = (await json(await list.GET())).body;
      expect(kids.map((k: { id: string }) => k.id)).toEqual([card.id]);
      expect((await detail.GET(req('/x'), params({ id: otherKid.id }))).status).toBe(404);
      expect((await detail.GET(req('/x'), params({ id: f.p1.id }))).status).toBe(404);
    });

    test('a child without consent cannot use the app; the parent consent unlocks it', async () => {
      const quests = await import('@/app/api/quests/today/route');
      const consent = await import('@/app/api/kids/[id]/consent/route');
      const { TERMS_VERSION } = await import('@/lib/terms');
      const p = await db.patient.findUniqueOrThrow({ where: { id: card.id } });
      kid = { id: p.userId!, name: 'มะลิ', email: 'kid', role: 'PATIENT', clinicianId: null, patientId: p.id, organizationId: f.org.id };

      signInAs(kid);
      const blocked = await json(await quests.GET());
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('TERMS_REQUIRED');

      signInAs(teacher);
      expect((await consent.POST(req('/x', { method: 'POST', body: { terms: true, version: TERMS_VERSION } }), params({ id: card.id }))).status).toBe(403);

      signInAs(parent);
      const res = await json(await consent.POST(req('/x', { method: 'POST', body: { terms: true, version: TERMS_VERSION, video: false } }), params({ id: card.id })));
      expect(res.status).toBe(200);
      expect(res.body.canPlay).toBe(true);

      signInAs(kid);
      const ok = await json(await quests.GET());
      expect(ok.status).toBe(200);
      expect(ok.body.total).toBe(1);
      expect(ok.body.quests[0].exercise.kidName).toBeString();
    });

    test('withdrawing the terms also withdraws video consent and erases every video', async () => {
      const consent = await import('@/app/api/kids/[id]/consent/route');
      const videoRoute = await import('@/app/api/sessions/[id]/video/route');
      const { appendChunk, videoPath } = await import('@/lib/video-storage');
      const { existsSync } = await import('node:fs');
      const { TERMS_VERSION } = await import('@/lib/terms');

      signInAs(parent);
      expect((await json(await consent.POST(req('/x', { method: 'POST', body: { video: true } }), params({ id: card.id })))).body.video).toBe(true);
      const session = await db.exerciseSession.create({
        data: { patientId: card.id, exerciseId: f.exercise.id, status: 'COMPLETED', targetSnapshot: {}, algorithmVersion: 'test' },
      });
      const storageKey = `${session.id}.webm`;
      await appendChunk(storageKey, new Uint8Array([1, 2, 3]), true);
      await db.sessionVideo.create({
        data: { sessionId: session.id, storageKey, mimeType: 'video/webm', sizeBytes: 3, chunkCount: 1, recordStartAt: new Date(), consentVersion: 'x', completedAt: new Date() },
      });
      expect((await videoRoute.GET(req(`/x?meta=1`), params({ id: session.id }))).status).toBe(200);

      const res = await json(await consent.POST(req('/x', { method: 'POST', body: { terms: false } }), params({ id: card.id })));
      expect(res.status).toBe(200);
      expect(res.body.canPlay).toBe(false);
      expect(res.body.video).toBe(false);
      expect(res.body.videosDeleted).toBe(1);
      expect(await db.sessionVideo.count({ where: { session: { patientId: card.id } } })).toBe(0);
      expect(existsSync(videoPath(storageKey))).toBe(false);
      expect((await videoRoute.GET(req(`/x?meta=1`), params({ id: session.id }))).status).toBe(404);

      // Consent again so the child can keep playing in the tests below
      await db.exerciseSession.delete({ where: { id: session.id } });
      await consent.POST(req('/x', { method: 'POST', body: { terms: true, version: TERMS_VERSION } }), params({ id: card.id }));
    });

    test('school paper consent (teacher) also lets a child play', async () => {
      const consent = await import('@/app/api/kids/[id]/consent/route');
      signInAs(teacher);
      const res = await json(await consent.POST(req('/x', { method: 'POST', body: { schoolConsent: true } }), params({ id: otherKid.id })));
      expect(res.body.canPlay).toBe(true);
    });
  });

  describe('kid login', () => {
    test('code + pictures signs the child in; wrong pictures lock the code', async () => {
      const ok = await authorize('kid-code', { code: card.kidCode, pictures: JSON.stringify(card.pictures) });
      expect(ok?.patientId).toBe(card.id);
      expect(ok?.role).toBe('PATIENT');

      const wrong = card.pictures[0] === 'cat' ? ['dog', 'dog', 'dog'] : ['cat', 'cat', 'cat'];
      for (let i = 0; i < 5; i++) {
        expect(await authorize('kid-code', { code: card.kidCode, pictures: JSON.stringify(wrong) })).toBeNull();
      }
      // Locked for a while, even with the right pictures
      expect(await authorize('kid-code', { code: card.kidCode, pictures: JSON.stringify(card.pictures) })).toBeNull();
      await db.patient.update({ where: { id: card.id }, data: { pinLockedUntil: null } });
    });

    test('teacher can reset the pictures; the old ones stop working', async () => {
      const codes = await import('@/app/api/kids/[id]/codes/route');
      signInAs(teacher);
      const res = await json(await codes.POST(req('/x', { method: 'POST', body: { reset: 'pictures', pictures: ['turtle', 'turtle', 'cat'] } }), params({ id: card.id })));
      expect(res.body.pictures).toEqual(['turtle', 'turtle', 'cat']);
      expect(await authorize('kid-code', { code: card.kidCode, pictures: JSON.stringify(card.pictures) })).toBeNull();
      expect(await authorize('kid-code', { code: card.kidCode, pictures: JSON.stringify(['turtle', 'turtle', 'cat']) })).not.toBeNull();
    });
  });

  describe('play as child and back', () => {
    test('switching needs the adult PIN to be set first', async () => {
      const sw = await import('@/app/api/me/switch/route');
      const pin = await import('@/app/api/me/pin/route');
      signInAs(teacher);
      const first = await json(await sw.POST(req('/x', { method: 'POST', body: { patientId: card.id } })));
      expect(first.status).toBe(409);
      expect(first.body.code).toBe('PIN_REQUIRED');
      expect((await pin.POST(req('/x', { method: 'POST', body: { pin: '1234', password: 'wrong' } }))).status).toBe(403);
      expect((await pin.POST(req('/x', { method: 'POST', body: { pin: '1234', password: 'teacher-pass' } }))).status).toBe(200);
    });

    test('ticket signs in as the child once; return needs the right PIN', async () => {
      const sw = await import('@/app/api/me/switch/route');
      const back = await import('@/app/api/me/return/route');
      signInAs(teacher);
      const { ticket } = (await json(await sw.POST(req('/x', { method: 'POST', body: { patientId: card.id } })))).body;
      const asKid = await authorize('ticket', { ticket });
      expect(asKid?.patientId).toBe(card.id);
      expect(asKid?.returnUserId).toBe(teacher.id);
      // Single use
      expect(await authorize('ticket', { ticket })).toBeNull();

      signInAs({ ...kid, returnUserId: teacher.id, returnName: teacher.name });
      expect((await back.POST(req('/x', { method: 'POST', body: { pin: '9999' } }))).status).toBe(403);
      const ret = await json(await back.POST(req('/x', { method: 'POST', body: { pin: '1234' } })));
      expect(ret.status).toBe(200);
      const asAdult = await authorize('ticket', { ticket: ret.body.ticket });
      expect(asAdult?.id).toBe(teacher.id);
      expect(asAdult?.returnUserId).toBeNull();
    });

    test('a tampered ticket is refused', async () => {
      const { createTicket } = await import('@/lib/kid-login');
      const t = createTicket({ userId: teacher.id });
      const [payload, mac] = t.split('.');
      const forged = Buffer.from(JSON.stringify({ userId: f.doctorA.user.id, exp: Date.now() + 60_000, nonce: 'x' })).toString('base64url');
      expect(await authorize('ticket', { ticket: `${forged}.${mac}` })).toBeNull();
      expect(payload).toBeString();
    });

    test('a parent cannot switch to a child who is not theirs', async () => {
      const sw = await import('@/app/api/me/switch/route');
      signInAs(parent);
      expect((await sw.POST(req('/x', { method: 'POST', body: { patientId: otherKid.id } }))).status).toBe(404);
    });
  });

  describe('chat is between the expert and parents', () => {
    test('teachers and kids have no chat; the parent and the expert see who is in it', async () => {
      const threads = await import('@/app/api/messages/threads/route');
      const messages = await import('@/app/api/messages/route');
      // An expert looks after the child
      await db.careAssignment.create({ data: { patientId: card.id, clinicianId: f.doctorA.id, role: 'PRIMARY' } });

      signInAs(teacher);
      expect((await threads.GET()).status).toBe(403);
      expect((await messages.POST(req('/x', { method: 'POST', body: { patientId: card.id, body: 'hi' } }))).status).toBe(403);
      signInAs(kid);
      expect((await threads.GET()).status).toBe(403);

      signInAs(parent);
      const mine = await json(await threads.GET());
      expect(mine.status).toBe(200);
      const t = mine.body.threads.find((x: { patientId: string }) => x.patientId === card.id);
      expect(t.parents.map((p: { id: string; me: boolean }) => [p.id, p.me])).toEqual([[parent.id, true]]);
      expect(t.experts.map((p: { id: string }) => p.id)).toEqual([f.doctorA.user.id]);
      expect(t.classroom.name).toBeString();
      expect((await messages.POST(req('/x', { method: 'POST', body: { patientId: card.id, body: 'สวัสดีค่ะ' } }))).status).toBe(201);

      signInAs(f.doctorA.user);
      const expert = await json(await threads.GET());
      const et = expert.body.threads.find((x: { patientId: string }) => x.patientId === card.id);
      expect(et.parents[0].email).toBe(parent.email);
      expect(et.unread).toBe(1);
    });
  });

  describe('the child dresses their mascot', () => {
    test('a valid, unlocked look is saved; locked or broken looks are refused', async () => {
      const avatar = await import('@/app/api/me/avatar/route');
      signInAs(kid);
      expect((await avatar.PUT(req('/x', { method: 'PUT', body: { avatar: 'sky' } }))).status).toBe(400);
      const locked = await json(await avatar.PUT(req('/x', { method: 'PUT', body: { avatar: 'sky.shiny.cat.crown.none.none' } })));
      expect(locked.status).toBe(403);
      expect(locked.body.locked).toEqual(['hat']);
      const ok = await json(await avatar.PUT(req('/x', { method: 'PUT', body: { avatar: 'grape.smile.tongue.bow.scarf.round' } })));
      expect(ok.status).toBe(200);
      expect((await db.patient.findUniqueOrThrow({ where: { id: card.id } })).avatar).toBe('grape.smile.tongue.bow.scarf.round');
      signInAs(parent);
      expect((await avatar.PUT(req('/x', { method: 'PUT', body: { avatar: 'grape.smile.tongue.bow.scarf.round' } }))).status).toBe(403);
    });
  });
});
