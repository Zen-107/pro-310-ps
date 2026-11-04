import { describe, expect, test } from 'bun:test';
import { kidRig } from '@/components/kids/mascot-demo';
import { EXERCISE_DEMOS, angleAt2D, buildSkeleton, type Limb } from '@/lib/exercise-poses';
import { ACTIVE_EXERCISES, exerciseIdFromName } from '@/lib/exercises-data';

// The mascot demo (decision 0003) redraws the rig with shorter limbs. It must
// show the same joint angles the camera checks, and stand on the floor.

const bend = (l: Limb) => angleAt2D(l.root, l.mid, l.end);
const heading = (l: Limb) => Math.atan2(l.mid.y - l.root.y, l.mid.x - l.root.x);

describe('mascot demo (kid rig)', () => {
  for (const ex of ACTIVE_EXERCISES) {
    const slug = exerciseIdFromName(ex.name);
    test(`${slug}: same limb angles, lowest foot on the same floor`, () => {
      const demo = EXERCISE_DEMOS[slug];
      for (const t of [0, 0.5, 1]) {
        const skel = buildSkeleton(demo.pose(t));
        const small = kidRig(skel).skel;
        for (const k of ['armNear', 'armFar', 'legNear', 'legFar'] as const) {
          expect(bend(small[k])).toBeCloseTo(bend(skel[k]), 3);
          expect(heading(small[k])).toBeCloseTo(heading(skel[k]), 5);
        }
        const floor = (s: typeof skel) => Math.max(s.legNear.end.y, s.legFar.end.y);
        expect(floor(small)).toBeCloseTo(floor(skel), 3);
      }
    });
  }
});
