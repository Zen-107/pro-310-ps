import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { integrationEnabled, json, params, req, signInAs } from '../helpers/api';
import type { Fixtures } from '../helpers/fixtures';

// Route handlers against a real PostgreSQL test database. Only the login is
// stubbed (tests/integration/preload.ts); auth guards, care-team scoping,
// the terms gate and every query run for real.
//
//   TEST_DATABASE_URL=postgresql://…/ai_physio_test bun run test:integration

const enabled = integrationEnabled();
if (!enabled) console.warn('Integration tests skipped: set TEST_DATABASE_URL and run `bun run test:integration`.');

describe.skipIf(!enabled)('API (integration)', () => {
  let f: Fixtures;
  let db: typeof import('@/lib/db').db;
  const route = <T,>(p: Promise<T>) => p;

  beforeAll(async () => {
    ({ db } = await import('@/lib/db'));
    const { resetAndSeed } = await import('../helpers/fixtures');
    f = await resetAndSeed();
  }, 60_000);

  afterAll(async () => {
    signInAs(null);
    await db?.$disconnect();
  });

  describe('authentication and the terms gate', () => {
    test('signed out → 401', async () => {
      const { GET } = await route(import('@/app/api/me/route'));
      signInAs(null);
      expect((await GET()).status).toBe(401);
    });

    test('terms not accepted → every API returns 403 TERMS_REQUIRED, except the terms route', async () => {
      const me = await import('@/app/api/me/route');
      const terms = await import('@/app/api/me/terms/route');
      signInAs(f.doctorNew.user);
      const blocked = await json(await me.GET());
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('TERMS_REQUIRED');
      const status = await json(await terms.GET());
      expect(status.status).toBe(200);
      expect(status.body.accepted).toBe(false);
    });

    test('accepting an outdated version is refused (409); the current version unlocks the API', async () => {
      const me = await import('@/app/api/me/route');
      const terms = await import('@/app/api/me/terms/route');
      signInAs(f.doctorNew.user);
      expect((await terms.POST(req('/api/me/terms', { method: 'POST', body: { accept: true, version: 'terms-old' } }))).status).toBe(409);
      const { version } = (await json(await terms.GET())).body;
      expect((await terms.POST(req('/api/me/terms', { method: 'POST', body: { accept: true, version } }))).status).toBe(200);
      expect((await me.GET()).status).toBe(200);
    });
  });

  describe('roles and care-team scoping', () => {
    test('a clinician sees only patients in their care team', async () => {
      const list = await import('@/app/api/patients/route');
      const detail = await import('@/app/api/patients/[id]/route');
      signInAs(f.doctorA.user);
      const ids = (await json(await list.GET())).body.map((p: { id: string }) => p.id).sort();
      expect(ids).toEqual([f.p1.id, f.p3.id].sort());
      expect((await detail.GET(req(`/api/patients/${f.p1.id}`), params({ id: f.p1.id }))).status).toBe(200);
      // Another clinician's patient: 404, so IDs are not leaked
      expect((await detail.GET(req(`/api/patients/${f.p2.id}`), params({ id: f.p2.id }))).status).toBe(404);
    });

    test('a patient cannot use clinician routes (403)', async () => {
      const list = await import('@/app/api/patients/route');
      signInAs(f.p1.user);
      expect((await list.GET()).status).toBe(403);
    });
  });

  describe('sessions', () => {
    test('free practice is disabled: a session needs a quest', async () => {
      const sessions = await import('@/app/api/sessions/route');
      signInAs(f.p1.user);
      expect((await sessions.POST(req('/api/sessions', { method: 'POST', body: { exerciseId: f.exercise.id } }))).status).toBe(403);
      expect((await sessions.POST(req('/api/sessions', { method: 'POST', body: {} }))).status).toBe(400);
    });

    test('today’s quest can be started; the session snapshots its targets', async () => {
      const today = await import('@/app/api/quests/today/route');
      const sessions = await import('@/app/api/sessions/route');
      signInAs(f.p1.user);
      const quests = (await json(await today.GET())).body.quests as { id: string }[];
      expect(quests.length).toBeGreaterThan(0);
      const started = await json(await sessions.POST(req('/api/sessions', { method: 'POST', body: { questId: quests[0].id } })));
      expect(started.status).toBe(201);
      const row = await db.exerciseSession.findUniqueOrThrow({ where: { id: started.body.id } });
      expect((row.targetSnapshot as { targets: unknown[] }).targets.length).toBeGreaterThan(0);
      expect(row.algorithmVersion).toMatch(/^angle-utils@/);
    });

    test('video upload is refused without the patient’s video consent', async () => {
      const video = await import('@/app/api/sessions/[id]/video/route');
      const session = await db.exerciseSession.findFirstOrThrow({ where: { patientId: f.p1.id, status: 'IN_PROGRESS' } });
      signInAs(f.p1.user);
      const res = await video.POST(
        req(`/api/sessions/${session.id}/video?seq=0&startedAt=${Date.now()}`, { method: 'POST', body: new Uint8Array([1, 2, 3]), headers: { 'Content-Type': 'video/webm' } }),
        params({ id: session.id })
      );
      expect(res.status).toBe(403);
    });
  });

  describe('safety', () => {
    test('red-flag symptoms get the fixed escalation reply without calling the AI', async () => {
      const assistant = await import('@/app/api/messages/assistant/route');
      signInAs(f.p1.user);
      const res = await json(await assistant.POST(req('/api/messages/assistant', { method: 'POST', body: { body: 'เจ็บหน้าอกมากหลังออกกำลัง' } })));
      expect(res.status).toBe(201);
      expect(res.body.escalated).toBe(true);
      expect(JSON.stringify(res.body.messages)).toContain('1669');
    });

    test('server TTS can be switched off (503)', async () => {
      const tts = await import('@/app/api/tts/route');
      signInAs(f.p1.user);
      expect((await tts.GET(req('/api/tts?text=' + encodeURIComponent('ทดสอบ')))).status).toBe(503);
    });
  });

  describe('recovery forecast', () => {
    test('per-exercise forecasts in the insights endpoint', async () => {
      const insights = await import('@/app/api/patients/[id]/ai-insights/route');
      signInAs(f.doctorA.user);
      const p1 = (await json(await insights.GET(req('/'), params({ id: f.p1.id })))).body;
      expect(p1.forecasts[0].forecast.status).toBe('on_track');
      expect(p1.forecasts[0].forecast.etaDays).toHaveLength(3);
      expect(p1.forecasts[0].adherence).toBeGreaterThan(50);
      const p3 = (await json(await insights.GET(req('/'), params({ id: f.p3.id })))).body;
      expect(p3.forecasts[0].forecast.status).toBe('plateau');
    });

    test('forecasts are clinician-only and care-team scoped', async () => {
      const insights = await import('@/app/api/patients/[id]/ai-insights/route');
      signInAs(f.p1.user);
      expect((await insights.GET(req('/'), params({ id: f.p1.id }))).status).toBe(403);
      signInAs(f.doctorB.user);
      expect((await insights.GET(req('/'), params({ id: f.p1.id }))).status).toBe(404);
    });

    test('clinician summary lists plateaued patients and pending reviews', async () => {
      const summary = await import('@/app/api/clinician/summary/route');
      signInAs(f.doctorA.user);
      const s = (await json(await summary.GET())).body;
      expect(s.recoveryAlerts.map((a: { patientId: string }) => a.patientId)).toEqual([f.p3.id]);
      expect(s.recoveryAlerts[0].status).toBe('plateau');
      expect(s.pendingReviews).toBeGreaterThan(0);
      expect(s.redFlags.map((r: { patientId: string }) => r.patientId)).toContain(f.p1.id);
    });
  });
});
