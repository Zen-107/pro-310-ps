-- Data migration: the catalogue replaced "Static Quads" with "Seated Heel Slides"
-- (src/lib/exercises-data.ts). Databases seeded before that change still list
-- ex_static_quads, which has no demo. Convert the row in place so existing
-- prescriptions and sessions stay linked (sessions keep their own targetSnapshot).
-- No-op on a freshly seeded database.

UPDATE "exercises" SET
  "slug" = 'ex_seated_heel_slides',
  "name" = 'Seated Heel Slides',
  "nameTh" = 'ไถส้นเท้างอเข่า',
  "description" = 'นอนหงาย ขาเหยียดตรง งอเข่าโดยไถส้นเท้าเข้าหาก้น แล้วไถกลับสู่ท่าเริ่มต้น ช่วยเพิ่มองศาการงอเข่า',
  "instructions" = '["วางกล้องไว้ด้านข้าง ระดับพื้น ให้เห็นทั้งตัว","นอนหงาย ขาทั้งสองข้างเหยียดตรง","งอเข่าโดยไถส้นเท้าไปตามพื้นเข้าหาก้น","ไถส้นเท้ากลับไปเหยียดขาตรงในท่าเริ่มต้น","ทำ 3 เซ็ต เซ็ตละ 15 ครั้ง"]'::jsonb,
  "defaultReps" = 15,
  "formChecks" = '[{"id":"other_leg_straight","type":"min","measurement":"{other}_knee","threshold":150,"message":"Keep the other leg straight on the floor"}]'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'ex_static_quads'
  AND NOT EXISTS (SELECT 1 FROM "exercises" WHERE "slug" = 'ex_seated_heel_slides');

UPDATE "exercise_joint_targets" t SET
  "idealAngle" = 80,
  "minAngle" = 50,
  "maxAngle" = 100,
  "rationale" = CASE WHEN t."joint" = 'left_knee'
    THEN 'Heel slides (lying on the back, legs straight; slide the heel towards the buttocks and back; 3 sets of 15), wording supplied by the project team. The source gives no angle. Developer estimate: a heel slid well towards the buttocks reads ≈50–100° interior knee angle from a side-view camera; the wide range lets early-stage patients count reps.'
    ELSE 'Same as left side.' END
FROM "exercises" e
WHERE e."id" = t."exerciseId" AND e."slug" = 'ex_seated_heel_slides' AND t."idealAngle" = 175;

UPDATE "exercise_references" r SET
  "sourceExerciseName" = 'Heel slides',
  "note" = 'Lying on the back, legs straight, slide the heel towards the buttocks and back; 3 sets of 15. Wording supplied by the project team; the app name "Seated Heel Slides" was requested by the team.'
FROM "exercises" e
WHERE e."id" = r."exerciseId" AND e."slug" = 'ex_seated_heel_slides' AND r."sourceExerciseName" = 'Static quads';
