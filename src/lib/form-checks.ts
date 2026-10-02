// Compensation checks evaluated at each rep's best moment.
//
// Measurement names may use `{side}` (side of the counted rep, e.g. "left")
// or `{other}` (the opposite side), so one check works for either leg/arm:
//   { type: 'min', measurement: '{side}_knee', threshold: 160 }  → lifted knee straight
// Checks whose measurement isn't visible are skipped (no fault).

export type FormCheck =
  | {
      id: string;
      type: 'min' | 'max';
      measurement: string;
      threshold: number;
      message: string;
    }
  | {
      id: string;
      type: 'symmetry';
      measurement: string;
      other: string;
      maxDiff: number;
      message: string;
    };

export interface FormFault {
  checkId: string;
  joint: string;
  measuredAngle: number;
  expectedMin: number | null;
  expectedMax: number | null;
  /** Degrees beyond the allowed value */
  deficit: number;
  message: string;
}

/** 'left' | 'right' | null from a measurement name like "left_hip_flexion" */
export function sideOf(measurement: string): 'left' | 'right' | null {
  if (measurement.startsWith('left_')) return 'left';
  if (measurement.startsWith('right_')) return 'right';
  return null;
}

function resolve(template: string, side: 'left' | 'right' | null): string | null {
  if (!template.includes('{side}') && !template.includes('{other}')) return template;
  if (!side) return null;
  const other = side === 'left' ? 'right' : 'left';
  return template.replace('{side}', side).replace('{other}', other);
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function evaluateFormChecks(
  checks: FormCheck[],
  angles: Record<string, number>,
  countedMeasurement: string
): FormFault[] {
  const side = sideOf(countedMeasurement);
  const faults: FormFault[] = [];

  for (const check of checks) {
    const joint = resolve(check.measurement, side);
    if (!joint) continue;
    const value = angles[joint];
    if (value === undefined) continue;

    if (check.type === 'min' && value < check.threshold) {
      faults.push({ checkId: check.id, joint, measuredAngle: round1(value), expectedMin: check.threshold, expectedMax: null, deficit: round1(check.threshold - value), message: check.message });
    } else if (check.type === 'max' && value > check.threshold) {
      faults.push({ checkId: check.id, joint, measuredAngle: round1(value), expectedMin: null, expectedMax: check.threshold, deficit: round1(value - check.threshold), message: check.message });
    } else if (check.type === 'symmetry') {
      const otherJoint = resolve(check.other, side);
      const otherValue = otherJoint ? angles[otherJoint] : undefined;
      if (otherValue === undefined) continue;
      const diff = Math.abs(value - otherValue);
      if (diff > check.maxDiff) {
        faults.push({
          checkId: check.id,
          joint,
          measuredAngle: round1(value),
          expectedMin: round1(otherValue - check.maxDiff),
          expectedMax: round1(otherValue + check.maxDiff),
          deficit: round1(diff - check.maxDiff),
          message: check.message,
        });
      }
    }
  }
  return faults;
}

/** Runtime guard for formChecks stored as JSON */
export function parseFormChecks(value: unknown): FormCheck[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is FormCheck =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as FormCheck).id === 'string' &&
      typeof (c as FormCheck).measurement === 'string' &&
      typeof (c as FormCheck).message === 'string' &&
      (((c as FormCheck).type === 'min' || (c as FormCheck).type === 'max')
        ? typeof (c as { threshold: unknown }).threshold === 'number'
        : (c as FormCheck).type === 'symmetry' &&
          typeof (c as { other: unknown }).other === 'string' &&
          typeof (c as { maxDiff: unknown }).maxDiff === 'number')
  );
}
