import type { Landmark } from '@/lib/angle-utils';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export type PoseLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => {
    landmarks?: Array<Array<{ x: number; y: number; z: number; visibility?: number; presence?: number }>>;
  };
  close: () => void;
};

export async function createPoseLandmarker(): Promise<PoseLandmarkerInstance> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');

  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  let landmarker: PoseLandmarkerInstance;
  try {
    landmarker = (await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })) as PoseLandmarkerInstance;
  } catch {
    landmarker = (await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })) as PoseLandmarkerInstance;
  }

  return landmarker;
}

export function landmarksFromResult(
  result: ReturnType<PoseLandmarkerInstance['detectForVideo']>
): Landmark[] | null {
  const raw = result.landmarks?.[0];
  if (!raw || raw.length < 29) return null;

  return raw.map((lm) => ({
    x: lm.x,
    y: lm.y,
    z: lm.z,
    visibility: lm.visibility ?? lm.presence ?? 1,
  }));
}
