// The exercise library's sources, citations and status rules, shared by the
// seed (prisma/seed.ts) and the online-demo deploy step (scripts/deploy-db.ts).
import type { ExerciseStatus, ReferenceRelevance, SourceType } from '@prisma/client';
import { exerciseIdFromName, type ExerciseData } from '../src/lib/exercises-data';
import { JOINT_FORMULAS } from '../src/lib/joint-formulas';

export const ACCESSED_AT = new Date('2026-10-01T00:00:00Z');
export const ACCESSED_AT_2 = new Date('2026-10-08T00:00:00Z'); // sources added with the 2026-10 exercise revision
export const ACCESSED_AT_3 = new Date('2026-11-04T00:00:00Z'); // sources added for the kids' 5-exercise library (decision 0002)
export const VERIFIER_NAME = 'VERIFIED BY DEV';

export interface SourceSeed {
  title: string;
  url: string;
  institution: string;
  authors: string | null;
  sourceType?: SourceType;
  language?: string;
  publishedAt?: Date;
  accessedAt?: Date;
  /** Overrides the default verification note */
  note?: string;
}

// ─── Sources (all pages opened and checked on their accessedAt date) ──
export const SOURCES = {
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
  mahidolShoulder: {
    title: 'ท่าบริหาร หัวไหล่ติด (Frozen Shoulder)',
    url: 'https://www.gj.mahidol.ac.th/main/frozenshoulder/',
    institution: 'ศูนย์การแพทย์กาญจนาภิเษก คณะแพทยศาสตร์ศิริราชพยาบาล มหาวิทยาลัยมหิดล (Golden Jubilee Medical Center, Mahidol University)',
    authors: null,
    language: 'th',
    publishedAt: new Date('2020-04-08T00:00:00Z'),
    accessedAt: ACCESSED_AT_2,
  },
  powellArmCircles: {
    title: 'Physical Therapy Moves You Can Do At Home to Reduce Your Pain',
    url: 'https://www.powellortho.net/blog/physical-therapy-moves-you-can-do-at-home-to-reduce-your-pain',
    institution: 'Powell Orthopedics and Sports Medicine',
    authors: null,
    accessedAt: ACCESSED_AT_2,
  },
  // Videos: title and channel confirmed (YouTube oEmbed) on ACCESSED_AT_2; the
  // video content itself has not been reviewed, so they are seeded PENDING.
  nhsAaaWallSquatVideo: {
    title: 'Wall squats (video)',
    url: 'https://www.youtube.com/watch?v=t6KeIiQAOkA',
    institution: 'NHS Ayrshire & Arran',
    authors: null,
    sourceType: 'VIDEO',
    accessedAt: ACCESSED_AT_2,
    note: 'Video: title and channel confirmed on YouTube; content not yet reviewed by a person.',
  },
  fitnessBlenderArmCircles: {
    title: 'Arm Circles (Lv 1) (video)',
    url: 'https://www.youtube.com/watch?v=140RTNMciH8',
    institution: 'FitnessBlender (fitness channel, not a clinical source)',
    authors: null,
    sourceType: 'VIDEO',
    accessedAt: ACCESSED_AT_2,
    note: 'Video: title and channel confirmed on YouTube; content not yet reviewed by a person. Fitness channel, not a clinical source.',
  },
  // Added for the kids' library (decision 0002): opened and read on ACCESSED_AT_3
  leedsSideBend: {
    title: 'NASS home exercises for axial spondyloarthritis (Physiotec sheet, exercise 13 "Side Bend in Standing")',
    url: 'https://www.leedsth.nhs.uk/wp-content/uploads/2023/08/Exercise-NASS-Home-exercises-for-axSpA_AS-v2.pdf',
    institution: 'Leeds Teaching Hospitals NHS Trust — Physiotherapy Department',
    authors: null,
    accessedAt: ACCESSED_AT_3,
    note: 'Developer-verified citation (not clinically reviewed). Exercise 13: standing tall, both arms overhead, side bend the trunk to one side, back to the middle, then the other side. Written for adults with axSpA; no target angle.',
  },
  uhbHipStanding: {
    title: 'Hip exercises following hip fracture surgery (standing exercises)',
    url: 'https://www.uhb.nhs.uk/services/trauma-and-orthopaedics/hip-fracture-surgery-hospital-stay-and-recovery/hip-exercises-standing/',
    institution: 'University Hospitals Birmingham NHS Foundation Trust',
    authors: null,
    accessedAt: ACCESSED_AT_3,
    note: 'Developer-verified citation (not clinically reviewed). Standing hip abduction: stand side-on holding a counter or firm chair, lift the leg out to the side with the upper body still, hold, lower. Written for adults after hip surgery; no target angle.',
  },
  // Telerehabilitation datasets: they describe the movements, not target angles.
  // Seeded PENDING (see UNVERIFIED_SOURCES) until a developer or clinician checks them.
  kimore: {
    title: 'The KIMORE Dataset: KInematic Assessment of MOvement and Clinical Scores for Remote Monitoring of Physical REhabilitation (IEEE TNSRE, 2019)',
    // DOI (stable). The lab page https://vrai.dii.univpm.it/content/kimore-dataset returned 403 Forbidden on 2026-10-07.
    url: 'https://doi.org/10.1109/TNSRE.2019.2923060',
    institution: 'Università Politecnica delle Marche — VRAI Lab',
    authors: 'Capecci M., Ceravolo M. G., Ferracuti F., Iarlori S., Monteriù A., Romeo L., Verdini F.',
  },
  rehab24: {
    title: 'REHAB24-6: A multi-modal dataset of physical rehabilitation exercises',
    url: 'https://zenodo.org/records/13305826',
    institution: 'Masaryk University — Faculty of Informatics',
    authors: 'Černek A., Sedmidubsky J., Budikova P., Jánošová M., Katzer L., Procházka M.',
  },
} satisfies Record<string, SourceSeed>;

export type SourceKey = keyof typeof SOURCES;

// Sources not yet opened and checked by a person: seeded PENDING, so they
// never make an exercise PUBLISHED on their own.
export const UNVERIFIED_SOURCES = new Set<SourceKey>(['kimore', 'rehab24', 'nhsAaaWallSquatVideo', 'fitnessBlenderArmCircles']);

export interface Citation {
  source: SourceKey;
  relevance: ReferenceRelevance;
  sourceExerciseName: string;
  note?: string;
}

// ─── Exercise → citations (keyed by slug) ───────────────────────────
export const CITATIONS: Record<string, Citation[]> = {
  ex_seated_heel_slides: [
    { source: 'cuhKnee', relevance: 'EXACT', sourceExerciseName: 'Heel slides', note: 'Lying on the back, legs straight, slide the heel towards the buttocks and back; 3 sets of 15. Wording supplied by the project team; the app name "Seated Heel Slides" was requested by the team.' },
  ],
  ex_cross_body_shoulder_stretch: [
    {
      source: 'mahidolShoulder',
      relevance: 'PARTIAL',
      sourceExerciseName: 'ท่าเอื้อมมือ (reach across to the opposite shoulder)',
      note: 'Cross-body stretch with the hand on the opposite shoulder and the other hand pushing the elbow. The app follows the exercise sheet supplied by the project team: straight arm held in by the other forearm, 10 s hold.',
    },
  ],
  ex_shoulder_abduction: [
    { source: 'nhsAaaShoulder', relevance: 'PARTIAL', sourceExerciseName: 'Assisted Abduction', note: 'Assisted by the other arm; the app uses active abduction.' },
  ],
  ex_wall_squat: [
    { source: 'nhsAaaWallSquatVideo', relevance: 'EXACT', sourceExerciseName: 'Wall squats' },
    { source: 'aaosKnee', relevance: 'PARTIAL', sourceExerciseName: 'Half Squats', note: 'Free-standing half squat, not against a wall.' },
    { source: 'cuhKnee', relevance: 'PARTIAL', sourceExerciseName: 'Squat', note: 'Mid-stage squat, not against a wall.' },
  ],
  ex_arm_circles: [
    { source: 'powellArmCircles', relevance: 'EXACT', sourceExerciseName: 'Arm Circles', note: 'Arms out at shoulder height, tiny circles growing larger, about 10 s, then reverse.' },
    { source: 'fitnessBlenderArmCircles', relevance: 'EXACT', sourceExerciseName: 'Arm Circles (Lv 1)' },
  ],
  ex_trunk_lateral_flexion: [
    { source: 'leedsSideBend', relevance: 'EXACT', sourceExerciseName: 'Side Bend in Standing (exercise 13)', note: 'Same movement; the source is an adult axSpA programme, used here for healthy children as a stretch.' },
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
  ex_standing_hip_abduction: [
    { source: 'uhbHipStanding', relevance: 'PARTIAL', sourceExerciseName: 'Standing hip abduction', note: 'Same movement; the source is post-surgery rehabilitation for adults. The app holds briefly instead of 5 s and lets children hold a chair at their side.' },
    { source: 'rehab24', relevance: 'CLOSE', sourceExerciseName: 'Leg abduction (Ex4)' },
  ],
};

// An exercise is PUBLISHED only if it has a verified citation AND every target
// joint has a formula in the angle engine; otherwise it is seeded as DRAFT.
export function draftReason(slug: string, joints: string[]): string | null {
  if (!CITATIONS[slug]?.some((c) => !UNVERIFIED_SOURCES.has(c.source))) {
    return CITATIONS[slug]?.length ? 'Cited sources are pending verification.' : 'No verified source cited.';
  }
  const unmeasurable = joints.filter((j) => !JOINT_FORMULAS[j]);
  if (unmeasurable.length) return `No angle formula for: ${unmeasurable.join(', ')}.`;
  return null;
}

/** Status the seed gives a catalogue exercise, with the note shown to adults */
export function exerciseStatus(ex: ExerciseData): { status: ExerciseStatus; statusNote: string | null } {
  if (ex.retired) return { status: 'RETIRED', statusNote: ex.retired };
  const reason = draftReason(exerciseIdFromName(ex.name), ex.targetJoints.map((tj) => tj.name));
  return { status: reason ? 'DRAFT' : 'PUBLISHED', statusNote: reason };
}
