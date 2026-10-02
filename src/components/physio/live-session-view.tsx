'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  CameraOff,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Activity,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  RotateCcw,
  Footprints,
  ArrowUpFromLine,
  MoveUp,
  MoveHorizontal,
  Mountain,
  RotateCcw as RotateCcwIcon,
  RefreshCw,
  Copy,
  Minimize2,
  PersonStanding,
  StretchHorizontal,
  Loader2,
  ChevronDown,
  ChevronUp,
  Video,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { RepCounter, REP_DEFAULTS, type IncompleteAttempt, type MotionState, type RepCompletion } from '@/lib/rep-counter';
import { CueGate, FaultPersistence, type CueKind } from '@/lib/cue-gate';
import { LandmarkSmoother } from '@/lib/landmark-smoother';
import { evaluateFormChecks, type FormCheck } from '@/lib/form-checks';
import { ExerciseDemo } from '@/components/physio/exercise-demo';
import { encodeFrame, REPLAY_CHUNK_FRAMES, REPLAY_FRAME_MS, type ReplayFrame } from '@/lib/replay';
import { SessionVideoRecorder, pickRecorderMime } from '@/lib/session-video-recorder';
import { pickThaiVoice, speakThai, stopSpeech, unlockAudio, type SpeechPriority } from '@/lib/speech';
import { compensationCue, cueState, localCue, phraseForState } from '@/lib/coach-cues';
import { VIDEO_CONSENT_POINTS, VIDEO_CONSENT_TITLE } from '@/lib/consent';
import {
  calculateAllAngles,
  isAngleCorrect,
  isVisible,
  formatAngle,
  getAngleStatus,
  getAngleStatusColor,
  ANGLE_STATUS_HEX,
  LANDMARKS,
  SKELETON_CONNECTIONS,
  type Landmark,
} from '@/lib/angle-utils';
import {
  CATEGORIES,
  DIFFICULTY_LABELS,
  type TargetJoint,
} from '@/lib/exercises-data';

// ─── Icon map for exercises ────────────────────────────────────────────
const exerciseIconMap: Record<string, React.ReactNode> = {
  Footprints: <Footprints className="h-5 w-5" />,
  ArrowUpFromLine: <ArrowUpFromLine className="h-5 w-5" />,
  MoveUp: <MoveUp className="h-5 w-5" />,
  MoveHorizontal: <MoveHorizontal className="h-5 w-5" />,
  Mountain: <Mountain className="h-5 w-5" />,
  RotateCcw: <RotateCcwIcon className="h-5 w-5" />,
  RefreshCw: <RefreshCw className="h-5 w-5" />,
  Copy: <Copy className="h-5 w-5" />,
  Compress: <Minimize2 className="h-5 w-5" />,
  PersonStanding: <PersonStanding className="h-5 w-5" />,
  StretchHorizontal: <StretchHorizontal className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />,
};

// ─── Difficulty badge config ───────────────────────────────────────────
const difficultyConfig: Record<string, { label: string; className: string }> = {
  beginner: { label: DIFFICULTY_LABELS.beginner, className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  intermediate: { label: DIFFICULTY_LABELS.intermediate, className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  advanced: { label: DIFFICULTY_LABELS.advanced, className: 'bg-red-500/15 text-red-600 border-red-500/30' },
};

const bodyPartLabels: Record<string, string> = {
  lower: 'ร่างกายล่าง',
  upper: 'ร่างกายบน',
  full: 'ทั้งตัว',
};

// ─── MediaPipe source (CDN) ────────────────────────────────────────────
// The loader script and its WASM/model files (via locateFile) must come from
// the same pinned version, otherwise the blob worker's importScripts() fails.
const POSE_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
const POSE_SCRIPT = `${POSE_BASE_URL}pose.js`;

// ─── Pipeline tuning ───────────────────────────────────────────────────
const ANGLE_UI_INTERVAL_MS = 100; // push live angles to the UI at ~10 Hz
const COACH_INTERVAL_MS = 8000; // min gap between AI coach calls
const IDLE_PROMPT_MS = 15000; // at rest, the coach only speaks after this much silence
const DEFERRED_CUE_MS = 3000; // a cue waiting for the return phase to end expires after this
const LOG_FLUSH_SIZE = 20; // flush buffered joint logs at this many rows
const LOG_FLUSH_INTERVAL_MS = 5000; // ...or this often
const LOG_BATCH_MAX = 200; // rows per request (matches the API cap)
const LOG_BUFFER_MAX = 500; // drop oldest rows beyond this if the API is down
const FRAME_BUFFER_MAX = 1200; // replay frames kept while the API is down (~2 min)

// Target joint name → landmark index used for coloring
const JOINT_INDEX: Record<string, number> = {
  left_shoulder: LANDMARKS.LEFT_SHOULDER,
  right_shoulder: LANDMARKS.RIGHT_SHOULDER,
  left_elbow: LANDMARKS.LEFT_ELBOW,
  right_elbow: LANDMARKS.RIGHT_ELBOW,
  left_hip: LANDMARKS.LEFT_HIP,
  right_hip: LANDMARKS.RIGHT_HIP,
  left_knee: LANDMARKS.LEFT_KNEE,
  right_knee: LANDMARKS.RIGHT_KNEE,
  left_ankle: LANDMARKS.LEFT_ANKLE,
  right_ankle: LANDMARKS.RIGHT_ANKLE,
  left_hip_flexion: LANDMARKS.LEFT_HIP,
  right_hip_flexion: LANDMARKS.RIGHT_HIP,
  left_shoulder_extension: LANDMARKS.LEFT_SHOULDER,
  right_shoulder_extension: LANDMARKS.RIGHT_SHOULDER,
  spine_flexion: LANDMARKS.LEFT_SHOULDER,
  left_hip_abduction: LANDMARKS.LEFT_HIP,
  right_hip_abduction: LANDMARKS.RIGHT_HIP,
};

// Measurements with no single vertex landmark are colored on several joints
const JOINT_INDEX_EXTRA: Record<string, number[]> = {
  hip_opening: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
  spine_flexion: [LANDMARKS.RIGHT_SHOULDER],
  trunk_lateral_flexion: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  trunk_inclination: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
  trunk_rotation: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
};

const KEY_INDICES = [
  LANDMARKS.LEFT_SHOULDER,
  LANDMARKS.RIGHT_SHOULDER,
  LANDMARKS.LEFT_ELBOW,
  LANDMARKS.RIGHT_ELBOW,
  LANDMARKS.LEFT_WRIST,
  LANDMARKS.RIGHT_WRIST,
  LANDMARKS.LEFT_HIP,
  LANDMARKS.RIGHT_HIP,
  LANDMARKS.LEFT_KNEE,
  LANDMARKS.RIGHT_KNEE,
  LANDMARKS.LEFT_ANKLE,
  LANDMARKS.RIGHT_ANKLE,
];

// ─── Helper: load script (with timeout + retry) ────────────────────────
function loadScript(src: string, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    // Reuse a tag that is still loading; failed tags are removed below, so a
    // retry always gets a fresh <script> that actually re-requests the file.
    const s = existing ?? document.createElement('script');
    // IMPORTANT: do NOT set crossOrigin here. The MediaPipe loader creates a
    // same-origin Blob worker that importScripts() these CDN files; adding
    // crossorigin can trigger opaque-response failures in some browsers.
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      s.remove();
      reject(new Error(message));
    };
    const timer = setTimeout(() => fail(`Timeout loading: ${src}`), timeoutMs);
    s.addEventListener('load', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      s.dataset.loaded = 'true';
      resolve();
    });
    s.addEventListener('error', () => fail(`Failed to load: ${src}`));
    if (!existing) {
      s.src = src;
      document.head.appendChild(s);
    }
  });
}

async function loadScriptWithRetry(src: string, attempts = 2): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await loadScript(src);
      return;
    } catch (err) {
      if (i >= attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

// ─── Helper: format time MM:SS ────────────────────────────────────────
/**
 * Skeleton overlay. NOTE: selfieMode is OFF, so landmark x are raw
 * (unmirrored); <video> and <canvas> are flipped by the same CSS, so raw
 * coordinates line up with the mirrored preview.
 */
function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: Landmark[],
  colors: Record<number, string>
) {
  const scale = Math.max(1, width / 640);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3 * scale;
  for (const [i, j] of SKELETON_CONNECTIONS) {
    const a = landmarks[i];
    const b = landmarks[j];
    if (!isVisible(a) || !isVisible(b)) continue;
    const ca = colors[i];
    const cb = colors[j];
    ctx.strokeStyle =
      ca === ANGLE_STATUS_HEX.bad || cb === ANGLE_STATUS_HEX.bad
        ? ANGLE_STATUS_HEX.bad
        : ca === ANGLE_STATUS_HEX.warn || cb === ANGLE_STATUS_HEX.warn
          ? ANGLE_STATUS_HEX.warn
          : ANGLE_STATUS_HEX.good;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = '#ffffff';
  for (const idx of KEY_INDICES) {
    const lm = landmarks[idx];
    if (!isVisible(lm)) continue;
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 6 * scale, 0, 2 * Math.PI);
    ctx.fillStyle = colors[idx] || ANGLE_STATUS_HEX.good;
    ctx.fill();
    ctx.stroke();
  }
}

function readPref(key: string, fallback = false): boolean {
  try {
    if (typeof window === 'undefined') return fallback;
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Types ─────────────────────────────────────────────────────────────
type TargetFromAPI = TargetJoint & { isPrimary?: boolean; formula?: string | null; overridden?: boolean };

interface ExerciseFromAPI {
  id: string;
  slug: string;
  formChecks?: FormCheck[];
  name: string;
  nameTh: string;
  category: string;
  description: string;
  instructions: string[];
  targetJoints: TargetFromAPI[];
  difficulty: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  icon: string;
  bodyPart: string;
}

interface QuestFromAPI {
  id: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED';
  prescription: { title: string; clinicianName: string };
  exercise: ExerciseFromAPI;
}


type SessionPhase = 'pre-session' | 'active' | 'summary';

interface PoseInstance {
  setOptions: (opts: Record<string, unknown>) => Promise<void>;
  onResults: (cb: (results: unknown) => void) => void;
  initialize: () => Promise<void>;
  close: () => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
}

interface PendingLog {
  repNumber: number;
  joint: string;
  angle: number;
  idealAngle: number;
  minAngle: number;
  maxAngle: number;
  deviation: number;
  isCorrect: boolean;
}

interface PendingRep {
  setNumber: number;
  repNumber: number;
  enteredAt: number;
  durationMs: number;
  bestAngle: number;
  accuracy: number;
  isCorrect: boolean;
}

interface PendingFault {
  repNumber?: number;
  type: 'INCOMPLETE_ROM' | 'COMPENSATION' | 'LOW_ACCURACY';
  checkId?: string;
  joint: string;
  measuredAngle: number;
  expectedMin: number | null;
  expectedMax: number | null;
  deficit: number | null;
  message: string;
  occurredAt: number;
}

// A counted rep below this accuracy is logged as LOW_ACCURACY (incorrect rep)
const LOW_ACCURACY_THRESHOLD = 60;
const FORM_CUE_MS = 3500; // how long a form cue stays on screen


// close() on an already-closed graph can throw, so track what we closed
const closedPoses = new WeakSet<PoseInstance>();
function closePose(pose: PoseInstance | null) {
  if (!pose || closedPoses.has(pose)) return;
  closedPoses.add(pose);
  try {
    pose.close();
  } catch {
    // already closed
  }
}

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export function LiveSessionView() {
  // ─── Store ──────────────────────────────────────────────────────────
  // Per-field selectors so only what's rendered triggers re-renders. The
  // per-frame pipeline reads/writes through useAppStore.getState() instead.
  const liveAngles = useAppStore((s) => s.liveAngles);
  const currentRep = useAppStore((s) => s.currentRep);
  const currentSet = useAppStore((s) => s.currentSet);
  const sessionAccuracy = useAppStore((s) => s.sessionAccuracy);
  const aiFeedback = useAppStore((s) => s.aiFeedback);
  const selectedQuestId = useAppStore((s) => s.selectedQuestId);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  // ─── Local State ────────────────────────────────────────────────────
  const [phase, setPhase] = useState<SessionPhase>('pre-session');
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [quests, setQuests] = useState<QuestFromAPI[]>([]);
  const [formCue, setFormCue] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseFromAPI | null>(null);
  // Remembered per-device preferences. Only the active-session screen reads
  // them (never server-rendered), so the lazy localStorage read is hydration-safe.
  const [ttsEnabled, setTtsEnabled] = useState(() => readPref('physio.ttsEnabled', true)); // coach voice on unless muted
  const [panelCollapsed, setPanelCollapsed] = useState(() => readPref('physio.panelCollapsed'));
  const [demoOpen, setDemoOpen] = useState(true);
  // Video recording (PDPA): consent is per patient, recording can be turned off per session
  const [videoConsent, setVideoConsent] = useState<{ consented: boolean; consentedAt: string | null } | null>(null);
  const [recordVideo, setRecordVideo] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mediaPipeLoaded, setMediaPipeLoaded] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false); // true once landmarks arrive
  const [personVisible, setPersonVisible] = useState(false);
  const [mediaPipeError, setMediaPipeError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    totalReps: number;
    avgAccuracy: number;
    totalTime: number;
    perRepAccuracy: number[];
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  // ─── Refs ───────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<PoseInstance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef<boolean>(false); // true while pose.send() is in flight
  const lastFrameTimeRef = useRef<number>(0); // watchdog: timestamp of last processed frame
  const lastAngleUiRef = useRef<number>(0); // throttle for setLiveAngles
  const repCounterRef = useRef<RepCounter | null>(null); // rep state per side + ROM
  const pendingLogsRef = useRef<PendingLog[]>([]);
  const pendingRepsRef = useRef<PendingRep[]>([]);
  const pendingFaultsRef = useRef<PendingFault[]>([]);
  const pendingFramesRef = useRef<ReplayFrame[]>([]); // pose frames for clinical replay
  const frameSeqRef = useRef<number>(0); // next replay chunk number
  const lastFrameRecRef = useRef<number>(0);
  const smootherRef = useRef(new LandmarkSmoother()); // One Euro + visibility hysteresis
  const formCueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef<boolean>(false); // finalize the session exactly once
  const lastCoachCallRef = useRef<number>(0);
  const coachAbortRef = useRef<AbortController | null>(null);
  // ── Latest-value refs for the pose pipeline ──────────────────────────
  // pose.onResults is registered ONCE per session, so values that change
  // over time are mirrored into refs and read from there.
  const handlePoseResultsRef = useRef<(results: unknown) => void>(() => {});
  const selectedExerciseRef = useRef<ExerciseFromAPI | null>(null);
  const isPausedRef = useRef<boolean>(false);
  const ttsEnabledRef = useRef<boolean>(readPref('physio.ttsEnabled', true));
  const thaiVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // Latest skeleton to draw; written by pose results, painted by the rAF render loop
  const overlayRef = useRef<{ landmarks: Landmark[]; colors: Record<number, string> } | null>(null);
  const overlayVersionRef = useRef(0);
  const formCueRef = useRef<string | null>(null); // latest compensation cue, for the coach
  // Spoken-cue gating: movement phase, cooldowns, persistent posture faults
  const motionRef = useRef<MotionState>({ phase: 'rest', target: null, since: 0 });
  const cueGateRef = useRef(new CueGate());
  const faultPersistRef = useRef(new FaultPersistence());
  const deferredCueRef = useRef<{ text: string; key: string; kind: CueKind; expires: number } | null>(null);
  const videoRecorderRef = useRef<SessionVideoRecorder | null>(null);
  const recordVideoRef = useRef<boolean>(false); // consent && per-session toggle, read at camera start
  const elapsedRef = useRef<number>(0);
  const detectionActiveRef = useRef<boolean>(false); // one-shot guard for setDetectionActive
  const personVisibleRef = useRef<boolean>(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
  }, [selectedExercise]);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
  }, [ttsEnabled]);

  // Thai voice for speech feedback (voices load asynchronously)
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    // Best installed Thai voice (neural/online voices first), see lib/speech.ts
    const pick = () => {
      thaiVoiceRef.current = pickThaiVoice(window.speechSynthesis.getVoices());
    };
    pick();
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', pick);
  }, []);

  useEffect(() => {
    recordVideoRef.current = !!videoConsent?.consented && recordVideo;
  }, [videoConsent, recordVideo]);

  // Patient's video-recording consent
  useEffect(() => {
    fetch('/api/me/video-consent')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setVideoConsent({ consented: d.consented, consentedAt: d.consentedAt }))
      .catch(() => {});
  }, []);

  // Pause/resume the video together with the session; silence speech on pause
  useEffect(() => {
    if (isPaused) videoRecorderRef.current?.pause();
    else videoRecorderRef.current?.resume();
    if (isPaused) stopSpeech();
  }, [isPaused]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  // ─── Fetch today's quests (patients only perform prescribed exercises) ──
  useEffect(() => {
    if (phase !== 'pre-session') return;
    let cancelled = false;
    async function load() {
      try {
        const questRes = await fetch('/api/quests/today');
        if (!questRes.ok) throw new Error('Failed to fetch');
        const questData = await questRes.json();
        if (cancelled) return;
        setQuests(Array.isArray(questData?.quests) ? questData.quests : []);
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoadingExercises(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // ─── Timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'active' && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, isPaused]);

  // ─── Session helpers (refs + store snapshot only → stable) ──────────
  const releaseMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    closePose(poseRef.current);
    poseRef.current = null;
  }, []);

  const getSessionMetrics = useCallback(() => {
    const accuracies = useAppStore.getState().sessionAccuracy;
    return {
      // One accuracy entry per completed rep, across all sets
      totalReps: accuracies.length,
      avgAccuracy:
        accuracies.length > 0
          ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
          : 0,
      // ROM of the side (left/right) that moved the most
      ...(repCounterRef.current?.romSummary() ?? { primaryJoint: null, romMinAngle: null, romMaxAngle: null }),
    };
  }, []);

  // Upload recorded pose frames for clinical replay, REPLAY_CHUNK_FRAMES per
  // chunk. Each chunk has a sequence number, so a retried upload is idempotent.
  const flushFrames = useCallback(async (keepalive = false) => {
    const sessionId = useAppStore.getState().currentSessionId;
    const frames = pendingFramesRef.current;
    if (!sessionId || frames.length === 0) return;
    pendingFramesRef.current = [];
    const chunks: { seq: number; frames: ReplayFrame[] }[] = [];
    for (let i = 0; i < frames.length; i += REPLAY_CHUNK_FRAMES) {
      chunks.push({ seq: frameSeqRef.current++, frames: frames.slice(i, i + REPLAY_CHUNK_FRAMES) });
    }
    const send = (chunk: (typeof chunks)[number]) =>
      fetch(`/api/sessions/${sessionId}/frames`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
        keepalive,
      }).then((res) => {
        if (!res.ok) throw new Error(`Frame upload failed: ${res.status}`);
      });
    if (keepalive) {
      chunks.forEach((c) => send(c).catch(() => {}));
      return;
    }
    for (let i = 0; i < chunks.length; i++) {
      try {
        await send(chunks[i]);
      } catch {
        // Requeue unsent frames; they get new sequence numbers next time
        pendingFramesRef.current = [...chunks.slice(i).flatMap((c) => c.frames), ...pendingFramesRef.current].slice(-FRAME_BUFFER_MAX);
        return;
      }
    }
  }, []);

  // Send buffered SessionRep + JointAngleLog rows in batches (reps first, so
  // logs can be linked to them). keepalive lets it survive page unload.
  const flushLogs = useCallback(async (keepalive = false) => {
    await flushFrames(keepalive);
    const sessionId = useAppStore.getState().currentSessionId;
    const reps = pendingRepsRef.current;
    const logs = pendingLogsRef.current;
    const faults = pendingFaultsRef.current;
    if (!sessionId || reps.length + logs.length + faults.length === 0) return;
    pendingRepsRef.current = [];
    pendingLogsRef.current = [];
    pendingFaultsRef.current = [];

    type Batch = { reps: PendingRep[]; logs: PendingLog[]; faults: PendingFault[] };
    const batches: Batch[] = [];
    let current: Batch = { reps: [], logs: [], faults: [] };
    const push = (add: (b: Batch) => void) => {
      if (current.reps.length + current.logs.length + current.faults.length >= LOG_BATCH_MAX) {
        batches.push(current);
        current = { reps: [], logs: [], faults: [] };
      }
      add(current);
    };
    reps.forEach((r) => push((b) => b.reps.push(r)));
    logs.forEach((l) => push((b) => b.logs.push(l)));
    faults.forEach((f) => push((b) => b.faults.push(f)));
    batches.push(current);

    const send = (batch: Batch) =>
      fetch(`/api/sessions/${sessionId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
        keepalive,
      }).then((res) => {
        if (!res.ok) throw new Error(`Log flush failed: ${res.status}`);
      });

    if (keepalive) {
      batches.forEach((b) => send(b).catch(() => {}));
      return;
    }
    for (let i = 0; i < batches.length; i++) {
      try {
        await send(batches[i]);
      } catch {
        // Requeue the unsent rows for the next flush, bounded in size
        const rest = batches.slice(i);
        pendingRepsRef.current = [...rest.flatMap((b) => b.reps), ...pendingRepsRef.current].slice(-LOG_BUFFER_MAX);
        pendingLogsRef.current = [...rest.flatMap((b) => b.logs), ...pendingLogsRef.current].slice(-LOG_BUFFER_MAX);
        pendingFaultsRef.current = [...rest.flatMap((b) => b.faults), ...pendingFaultsRef.current].slice(-LOG_BUFFER_MAX);
        return;
      }
    }
  }, [flushFrames]);

  // Periodic log flush while a session is active
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => flushLogs(), LOG_FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase, flushLogs]);

  // ─── Abandoned session (unmount / tab close) ────────────────────────
  // Saves what we have as "cancelled" instead of leaving it in_progress.
  useEffect(() => {
    const abandonSession = () => {
      const st = useAppStore.getState();
      const sessionId = st.currentSessionId;
      if (!sessionId || stoppingRef.current) return;
      stoppingRef.current = true;
      flushLogs(true);
      void videoRecorderRef.current?.stop(); // partial video stays incomplete
      videoRecorderRef.current = null;
      fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED', ...getSessionMetrics() }),
        keepalive: true,
      }).catch(() => {});
      st.setIsSessionActive(false);
      st.setCurrentSessionId(null);
    };

    window.addEventListener('pagehide', abandonSession);
    return () => {
      window.removeEventListener('pagehide', abandonSession);
      abandonSession();
      if (timerRef.current) clearInterval(timerRef.current);
      coachAbortRef.current?.abort();
      if (formCueTimerRef.current) clearTimeout(formCueTimerRef.current);
      releaseMedia();
    };
  }, [flushLogs, getSessionMetrics, releaseMedia]);

  // ─── TTS helper ─────────────────────────────────────────────────────
  // Coach voice (lib/speech.ts speakThai): server Thai TTS first, so it works
  // on devices with no Thai voice installed; then the browser's Thai voice;
  // a chime only when neither can speak (told once per device).
  const notifyNoVoice = useCallback(() => {
    let shown = false;
    try {
      shown = localStorage.getItem('physio.noThaiVoiceNotice') === '1';
      localStorage.setItem('physio.noThaiVoiceNotice', '1');
    } catch {
      // ignore
    }
    if (!shown) {
      toast('ไม่สามารถเล่นเสียงพูดได้ในขณะนี้', {
        description: 'ระบบจะใช้เสียงสัญญาณแทนเมื่อมีคำแนะนำใหม่ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        duration: 6000,
        closeButton: true,
      });
    }
  }, []);

  const say = useCallback(
    (text: string, priority: SpeechPriority = 'normal') => {
      if (typeof window === 'undefined') return;
      void speakThai(text, thaiVoiceRef.current, priority).then((out) => {
        if (out === 'chime') notifyNoVoice();
      });
    },
    [notifyNoVoice]
  );

  const speakText = useCallback(
    (text: string, priority: SpeechPriority = 'normal') => {
      if (!ttsEnabledRef.current) return;
      // Don't start talking after the session has ended
      if (!useAppStore.getState().isSessionActive) return;
      say(text, priority);
    },
    [say]
  );

  // Every spoken cue during exercise goes through the gate (lib/cue-gate.ts):
  // posture corrections only while the rep is performed, nothing while the
  // patient returns to the start position, minimum spacing and per-cue
  // cooldown. Corrections are high priority (they flush anything playing).
  const cue = useCallback(
    (text: string, kind: CueKind, key: string = text): boolean => {
      if (!cueGateRef.current.allow(key, kind, motionRef.current.phase, Date.now())) return false;
      speakText(text, kind === 'posture' || kind === 'rom' ? 'high' : 'normal');
      return true;
    },
    [speakText]
  );

  // Mute / unmute. Turning sound on speaks immediately, inside the click,
  // which also unlocks audio in browsers that require a user gesture.
  const toggleTts = useCallback(() => {
    const next = !ttsEnabledRef.current;
    ttsEnabledRef.current = next;
    setTtsEnabled(next);
    try {
      localStorage.setItem('physio.ttsEnabled', next ? '1' : '0');
    } catch {
      // ignore
    }
    if (!next) {
      stopSpeech();
      return;
    }
    unlockAudio();
    say('เปิดเสียงโค้ชแล้วครับ');
  }, [say]);

  const togglePanel = useCallback(() => {
    setPanelCollapsed((c) => {
      try {
        localStorage.setItem('physio.panelCollapsed', c ? '0' : '1');
      } catch {
        // ignore
      }
      return !c;
    });
  }, []);

  const saveVideoConsent = useCallback(async (consent: boolean) => {
    setSavingConsent(true);
    try {
      const res = await fetch('/api/me/video-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setVideoConsent({ consented: d.consented, consentedAt: d.consentedAt });
      setConsentOpen(false);
      setConsentChecked(false);
      toast.success(consent ? 'บันทึกความยินยอมแล้ว' : 'ถอนความยินยอมแล้ว — จะไม่บันทึกวิดีโออีก');
    } catch {
      toast.error('บันทึกความยินยอมไม่สำเร็จ');
    } finally {
      setSavingConsent(false);
    }
  }, []);

  // ─── AI Coach call (throttled, one request in flight) ───────────────
  const callCoach = useCallback(
    (angles: Record<string, number>) => {
      const exercise = selectedExerciseRef.current;
      if (!exercise || coachAbortRef.current) return;
      const now = Date.now();
      if (now - lastCoachCallRef.current < COACH_INTERVAL_MS) return;
      // Coach only during the movement, or at rest after a long silence (prompt
      // to continue) - never while returning, so no stale corrections
      const { phase } = motionRef.current;
      if (!cueGateRef.current.phaseAllows('coach', phase, now)) return;
      if (phase === 'rest' && cueGateRef.current.msSinceLastCue(now) < IDLE_PROMPT_MS) return;

      // Only send angles for visible target joints
      const currentAngles: Record<string, number> = {};
      exercise.targetJoints.forEach((tj) => {
        if (angles[tj.name] !== undefined) currentAngles[tj.name] = angles[tj.name];
      });
      if (Object.keys(currentAngles).length === 0) return;
      lastCoachCallRef.current = now;

      const controller = new AbortController();
      coachAbortRef.current = controller;
      const { currentRep: repCount, currentSet: setCount } = useAppStore.getState();
      setCoachLoading(true);
      fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseName: exercise.name,
          exerciseNameTh: exercise.nameTh,
          exerciseSlug: exercise.slug,
          currentAngles,
          targetJoints: exercise.targetJoints,
          formCue: formCueRef.current,
          repCount,
          repsPerSet: exercise.repsPerSet,
          setCount,
        }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Coach failed: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          const fb = data.feedback || 'ทำได้ดีครับ ค่อยๆ ทำต่อไปนะครับ';
          useAppStore.getState().setAiFeedback(fb);
          cue(fb, 'coach'); // re-checked now: dropped if the patient is already returning
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          // Coach unreachable: deterministic Thai cue, still spoken
          const fb = localCue(exercise.slug, exercise.targetJoints, currentAngles);
          useAppStore.getState().setAiFeedback(fb);
          cue(fb, 'coach');
        })
        .finally(() => {
          if (coachAbortRef.current === controller) coachAbortRef.current = null;
          setCoachLoading(false);
        });
    },
    [cue]
  );

  // ─── Start exercise ─────────────────────────────────────────────────
  // Start from a prescribed quest ({ questId }) or as free practice ({ exerciseId }).
  // The server returns the exercise with the prescription's dose and angle
  // overrides applied; the session runs on those merged targets.
  const handleStartExercise = useCallback(async (start: { questId: string }) => {
    // Runs inside the click: unlocks speech + Web Audio for the whole session
    if (ttsEnabledRef.current) unlockAudio();
    setConnecting(true);
    try {
      const st = useAppStore.getState();
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(start),
      });
      const sessionData = await sessionRes.json().catch(() => null);
      if (!sessionRes.ok || !sessionData?.id || !sessionData.exercise) {
        toast.error(sessionData?.error === 'This quest is not due today'
          ? 'ภารกิจนี้ไม่ได้กำหนดไว้สำหรับวันนี้'
          : 'ไม่สามารถเริ่มเซสชันได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }
      const exercise = sessionData.exercise as ExerciseFromAPI;

      st.clearSessionData();
      st.setSelectedExerciseId(exercise.id);
      st.setSelectedQuestId(null);
      st.setIsSessionActive(true);
      st.setCurrentSessionId(sessionData.id);

      stoppingRef.current = false;
      repCounterRef.current = new RepCounter(exercise.targetJoints, REP_DEFAULTS);
      pendingLogsRef.current = [];
      pendingRepsRef.current = [];
      pendingFaultsRef.current = [];
      pendingFramesRef.current = [];
      frameSeqRef.current = 0;
      lastFrameRecRef.current = 0;
      smootherRef.current.reset();
      motionRef.current = { phase: 'rest', target: null, since: 0 };
      cueGateRef.current.reset();
      faultPersistRef.current.reset();
      deferredCueRef.current = null;
      setFormCue(null);
      lastCoachCallRef.current = 0;
      lastAngleUiRef.current = 0;
      detectionActiveRef.current = false;
      personVisibleRef.current = false;

      setSelectedExercise(exercise);
      setMediaPipeError(null);
      setCameraError(null);
      setDetectionActive(false);
      setPersonVisible(false);
      setIsPaused(false);
      setElapsedSeconds(0);
      setPhase('active');
      lastCoachCallRef.current = Date.now(); // first coach cue after the greeting
      cueGateRef.current.allow('greeting', 'info', 'rest', Date.now());
      speakText(`เริ่มท่า${exercise.nameTh}กันเลยครับ จัดตัวให้กล้องเห็นทั้งตัวนะครับ`);
    } catch {
      toast.error('ไม่สามารถเริ่มเซสชันได้ กรุณาตรวจสอบการเชื่อมต่อ');
    } finally {
      setConnecting(false);
    }
  }, [speakText]);

  // ─── Stop session ───────────────────────────────────────────────────
  const handleStopSession = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    coachAbortRef.current?.abort();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    // Stop recording before the camera tracks end; the last chunk keeps uploading
    void videoRecorderRef.current?.stop();
    videoRecorderRef.current = null;
    setIsRecording(false);
    releaseMedia();
    setMediaPipeLoaded(false);
    setDetectionActive(false);
    detectionActiveRef.current = false;

    const st = useAppStore.getState();
    const metrics = getSessionMetrics();

    if (st.currentSessionId) {
      await flushLogs();
      try {
        await fetch(`/api/sessions/${st.currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'COMPLETED', ...metrics }),
        });
      } catch {
        // ignore
      }
    }

    setSummaryData({
      totalReps: metrics.totalReps,
      avgAccuracy: metrics.avgAccuracy,
      totalTime: elapsedRef.current,
      perRepAccuracy: useAppStore.getState().sessionAccuracy,
    });

    st.setIsSessionActive(false);
    st.setCurrentSessionId(null);
    st.setSelectedExerciseId(null);

    setPhase('summary');
  }, [flushLogs, getSessionMetrics, releaseMedia]);

  // ─── Toggle pause ───────────────────────────────────────────────────
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // ─── Initialize MediaPipe + Camera ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return;

    let cancelled = false;
    let rafId = 0;
    let videoFrameId = 0;
    let pose: PoseInstance | null = null;

    async function initMediaPipe() {
      try {
        // 1) Load the pinned MediaPipe Pose loader from the CDN
        await loadScriptWithRetry(POSE_SCRIPT);
        if (cancelled) return;

        const w = window as unknown as {
          Pose?: new (config: { locateFile: (file: string) => string }) => PoseInstance;
        };

        if (!w.Pose) {
          setMediaPipeError('ไม่สามารถโหลด MediaPipe ได้ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
          return;
        }

        // 2) Open the camera FIRST — getUserMedia gives a clear error
        //    message (permission denied / no device) before we spend time
        //    downloading WASM model files.
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError(
            'เบราว์เซอร์นี้ไม่รองรับกล้อง (ต้องใช้ HTTPS หรือ localhost) กรุณาเปิดผ่าน https:// หรือ http://localhost'
          );
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' },
          });
        } catch (err) {
          if (cancelled) return;
          const name = err instanceof DOMException ? err.name : '';
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            setCameraError('ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณากด "อนุญาต" แล้วเริ่มใหม่');
          } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            setCameraError('ไม่พบกล้องบนอุปกรณ์นี้');
          } else {
            setCameraError('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบว่าไม่มีแอปอื่นใช้งานกล้องอยู่');
          }
          return;
        }

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Video recording: only with the patient's consent and the session toggle on
        const sessionId = useAppStore.getState().currentSessionId;
        if (recordVideoRef.current && sessionId) {
          const recorder = new SessionVideoRecorder(stream, sessionId, (message) => {
            setIsRecording(false);
            toast.error(message);
          });
          if (recorder.start()) {
            videoRecorderRef.current = recorder;
            setIsRecording(true);
          } else {
            toast.message('เบราว์เซอร์นี้บันทึกวิดีโอไม่ได้ — ฝึกต่อได้ตามปกติ');
          }
        }

        // Wait until React has attached the <video> element to the DOM
        const video = await waitForVideoElement();
        if (!video || cancelled) return;

        video.srcObject = stream;
        video.muted = true;
        try {
          await video.play();
        } catch {
          // autoplay quirks on some browsers; muted+playsInline usually avoids this
        }

        // Wait for actual frames so videoWidth/videoHeight are non-zero
        await waitForVideoReady(video);
        if (cancelled) return;

        // 3) Create Pose instance (WASM assets fetched via locateFile)
        const instance = new w.Pose({
          locateFile: (file: string) => `${POSE_BASE_URL}${file}`,
        });
        pose = instance;

        await instance.setOptions({
          // IMPORTANT: MediaPipe's `selfieMode` on the legacy Pose JS API does
          // NOT mirror landmark.x — it only flips left/right landmark indices.
          // We keep it OFF and draw RAW coordinates instead; both <video> and
          // <canvas> are flipped by the same CSS (-scale-x-100), so raw
          // landmarks line up perfectly with the mirrored preview.
          selfieMode: false,
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        instance.onResults((results: unknown) => {
          if (cancelled || isPausedRef.current) return;
          handlePoseResultsRef.current(results);
        });

        // initialize() can hang forever when the WASM graph fails to boot;
        // race it against a timeout so the failure surfaces in the UI.
        let initTimer: ReturnType<typeof setTimeout> | undefined;
        const initTimeout = new Promise<never>((_, reject) => {
          initTimer = setTimeout(() => reject(new Error('MediaPipe initialize timeout')), 60000);
        });
        try {
          await Promise.race([instance.initialize(), initTimeout]);
        } catch (err) {
          if (cancelled) return;
          console.error('[MediaPipe] initialize() failed/timed out:', err);
          closePose(instance);
          setMediaPipeError(
            'โมเดล AI ไม่สามารถเริ่มต้นได้ (WASM โหลดไม่สำเร็จ) — กดเริ่มใหม่หรือตรวจสอบอินเทอร์เน็ต'
          );
          return;
        } finally {
          clearTimeout(initTimer);
        }
        if (cancelled) return;
        poseRef.current = instance;
        setMediaPipeLoaded(true);

        // 4) Drive detection with our own rAF loop: throttles to the display
        //    refresh rate and never queues frames while the model is busy.
        // Inference is paced by the camera: requestVideoFrameCallback fires once
        // per decoded video frame (no duplicate work on the same frame); older
        // browsers fall back to requestAnimationFrame.
        const useVideoFrames = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
        const schedule = () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (useVideoFrames && v) videoFrameId = v.requestVideoFrameCallback(() => void sendLoop());
          else rafId = requestAnimationFrame(() => void sendLoop());
        };
        const sendLoop = async () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2 && !processingRef.current) {
            processingRef.current = true;
            try {
              await instance.send({ image: v });
            } catch {
              // ignore single-frame inference errors, keep looping
            } finally {
              processingRef.current = false;
            }
          }
          schedule();
        };
        schedule();
      } catch (err) {
        if (cancelled) return;
        console.error('[MediaPipe init failed]', err);
        setMediaPipeError('ไม่สามารถเริ่มต้นระบบ AI ได้ กรุณาลองใหม่อีกครั้ง');
      }
    }

    // Poll for the mounted <video> element (max ~2s)
    function waitForVideoElement(): Promise<HTMLVideoElement | null> {
      return new Promise((resolve) => {
        const start = Date.now();
        const check = () => {
          if (videoRef.current) {
            resolve(videoRef.current);
          } else if (Date.now() - start > 2000 || cancelled) {
            resolve(null);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }

    // Wait until the video stream is actually producing frames
    function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
      return new Promise((resolve) => {
        if (video.videoWidth > 0) {
          resolve();
          return;
        }
        const timeout = setTimeout(() => resolve(), 5000);
        video.onloadeddata = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    }

    initMediaPipe();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (videoFrameId) videoRef.current?.cancelVideoFrameCallback?.(videoFrameId);
      // Covers a graph created but not yet handed to poseRef (init in flight)
      closePose(pose);
    };
  }, [phase]);

  // ─── Handle pose results (runs every processed frame) ───────────────
  const handlePoseResults = useCallback(
    (results: unknown) => {
      if (stoppingRef.current) return;
      const r = results as { poseLandmarks?: Landmark[]; poseWorldLandmarks?: Landmark[] };

      const video = videoRef.current;
      if (!video) return;

      const now = Date.now();
      lastFrameTimeRef.current = now;

      // Only re-render when presence actually changes, not every frame
      const rawLandmarks = r.poseLandmarks;
      const hasPerson = !!rawLandmarks && rawLandmarks.length >= 33;
      if (hasPerson !== personVisibleRef.current) {
        personVisibleRef.current = hasPerson;
        setPersonVisible(hasPerson);
      }
      if (!rawLandmarks || !hasPerson) {
        smootherRef.current.reset();
        overlayRef.current = null;
        overlayVersionRef.current++;
        return;
      }

      // Low-pass filter (One Euro) + visibility hysteresis on image and world
      // landmarks before measuring or drawing — removes jitter at rest
      const smoothed = smootherRef.current.process(rawLandmarks, r.poseWorldLandmarks, now);
      const landmarks = smoothed.image;

      if (!detectionActiveRef.current) {
        detectionActiveRef.current = true;
        setDetectionActive(true);
      }

      // Angles: 3D on world landmarks when available, else aspect-corrected 2D;
      // low-visibility joints are omitted
      const aspect =
        video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 1;
      const angles = calculateAllAngles(landmarks, { aspect, world: smoothed.world });

      // Record a replay frame at REPLAY_FPS (skipped while paused)
      if (!isPausedRef.current && now - lastFrameRecRef.current >= REPLAY_FRAME_MS) {
        lastFrameRecRef.current = now;
        pendingFramesRef.current.push(encodeFrame(now, landmarks, smoothed.world, aspect, angles));
      }

      // Throttled UI update: one store write per ~100 ms
      if (now - lastAngleUiRef.current >= ANGLE_UI_INTERVAL_MS) {
        lastAngleUiRef.current = now;
        useAppStore.getState().setLiveAngles(angles);
      }

      const exercise = selectedExerciseRef.current;
      const targetJoints = exercise?.targetJoints || [];

      // Status color per target joint landmark
      const jointColorMap: Record<number, string> = {};
      targetJoints.forEach((tj) => {
        const angle = angles[tj.name];
        if (angle === undefined) return;
        const color = ANGLE_STATUS_HEX[getAngleStatus(angle, tj.minAngle, tj.maxAngle)];
        const indices = [JOINT_INDEX[tj.name], ...(JOINT_INDEX_EXTRA[tj.name] ?? [])];
        indices.forEach((idx) => {
          if (idx !== undefined) jointColorMap[idx] = color;
        });
      });

      // Hand the frame to the render loop (drawn on the next animation frame)
      overlayRef.current = { landmarks, colors: jointColorMap };
      overlayVersionRef.current++;

      // ─── Rep detection (see lib/rep-counter.ts) ────────────────────
      const showFormCue = (message: string) => {
        setFormCue(message);
        formCueRef.current = message;
        if (formCueTimerRef.current) clearTimeout(formCueTimerRef.current);
        formCueTimerRef.current = setTimeout(() => {
          setFormCue(null);
          formCueRef.current = null;
        }, FORM_CUE_MS);
      };

      const completeRep = (rep: RepCompletion): boolean => {
        if (!exercise) return false;
        const st = useAppStore.getState();
        st.addAccuracy(rep.bestAccuracy);
        const repNumber = st.sessionAccuracy.length + 1;

        // Form faults at the rep's best moment: compensations + low accuracy
        const compensations = evaluateFormChecks(exercise.formChecks ?? [], rep.bestAngles, rep.target.name);
        compensations.forEach((f) =>
          pendingFaultsRef.current.push({ repNumber, type: 'COMPENSATION', checkId: f.checkId, joint: f.joint, measuredAngle: f.measuredAngle, expectedMin: f.expectedMin, expectedMax: f.expectedMax, deficit: f.deficit, message: f.message, occurredAt: now })
        );
        const lowAccuracy = rep.bestAccuracy < LOW_ACCURACY_THRESHOLD;
        if (lowAccuracy) {
          const t = rep.target;
          pendingFaultsRef.current.push({ repNumber, type: 'LOW_ACCURACY', joint: t.name, measuredAngle: rep.bestAngles[t.name], expectedMin: t.minAngle, expectedMax: t.maxAngle, deficit: Math.round(Math.abs(rep.bestAngles[t.name] - t.idealAngle) * 10) / 10, message: `Rep accuracy ${Math.round(rep.bestAccuracy)}% (below ${LOW_ACCURACY_THRESHOLD}%)`, occurredAt: now });
        }
        // Recorded for the report only: posture is coached live during the
        // movement; the patient is now returning, so nothing is spoken here
        cueGateRef.current.noteRepEnd(now);
        faultPersistRef.current.reset();

        pendingRepsRef.current.push({
          setNumber: st.currentSet,
          repNumber,
          enteredAt: rep.enteredAt,
          durationMs: rep.durationMs,
          bestAngle: rep.bestAngles[rep.target.name],
          accuracy: rep.bestAccuracy,
          isCorrect: compensations.length === 0 && !lowAccuracy,
        });
        // One JointAngleLog row per visible target joint, at the rep's best moment
        targetJoints.forEach((tj) => {
          const a = rep.bestAngles[tj.name];
          if (a === undefined) return;
          const { correct, deviation } = isAngleCorrect(a, tj.idealAngle, tj.minAngle, tj.maxAngle);
          pendingLogsRef.current.push({
            repNumber,
            joint: tj.name,
            angle: a,
            idealAngle: tj.idealAngle,
            minAngle: tj.minAngle,
            maxAngle: tj.maxAngle,
            deviation: Math.round(deviation * 10) / 10,
            isCorrect: correct,
          });
        });
        if (pendingRepsRef.current.length + pendingLogsRef.current.length + pendingFaultsRef.current.length >= LOG_FLUSH_SIZE) flushLogs();

        // Advance rep/set counters
        const newRep = st.currentRep + 1;
        if (newRep >= exercise.repsPerSet) {
          if (st.currentSet + 1 > exercise.sets) {
            st.setCurrentRep(newRep);
            handleStopSession();
            return true;
          }
          st.setCurrentSet(st.currentSet + 1);
          st.setCurrentRep(0);
        } else {
          st.setCurrentRep(newRep);
        }
        return false;
      };

      // Movement toward the target that returned without reaching it
      const recordIncomplete = (attempt: IncompleteAttempt) => {
        const t = attempt.target;
        const message = `Range not reached — ${attempt.deficit}° short of the target`;
        pendingFaultsRef.current.push({ type: 'INCOMPLETE_ROM', joint: t.name, measuredAngle: attempt.peakAngle, expectedMin: t.minAngle, expectedMax: t.maxAngle, deficit: attempt.deficit, message, occurredAt: now });
        showFormCue(`Go a little further — ${Math.round(attempt.deficit)}° short of the target range`);
        const cueTarget = exercise?.targetJoints.find((tj) => tj.name === t.name);
        // Direction comes from the peak angle (a shallow squat is above its range, a low arm below)
        if (cueTarget) {
          // Spoken once the patient has finished returning (see below)
          deferredCueRef.current = {
            text: phraseForState(exercise?.slug, cueTarget, cueState(cueTarget, attempt.peakAngle)),
            key: `rom:${t.name}`,
            kind: 'rom',
            expires: now + DEFERRED_CUE_MS,
          };
        }
      };

      for (const event of repCounterRef.current?.update(angles, now) ?? []) {
        if (event.type === 'rep') {
          if (completeRep(event)) return;
        } else {
          recordIncomplete(event);
        }
      }

      // ─── Live posture cues (only while performing the rep) ─────────
      const motion = repCounterRef.current?.motion(now) ?? { phase: 'rest' as const, target: null, since: now };
      motionRef.current = motion;
      const checks = exercise?.formChecks ?? [];
      if (checks.length && motion.target && (motion.phase === 'moving' || motion.phase === 'hold')) {
        const faults = evaluateFormChecks(checks, angles, motion.target.name);
        // A fault must persist briefly (no single-frame triggers) before it is spoken
        const stable = new Set(faultPersistRef.current.update(faults.map((f) => f.checkId), now));
        const fault = faults.find((f) => stable.has(f.checkId));
        if (fault && cue(compensationCue(fault.checkId), 'posture', `posture:${fault.checkId}`)) {
          showFormCue(fault.message);
          lastCoachCallRef.current = now; // the coach doesn't talk over a correction
        }
      } else {
        faultPersistRef.current.reset();
      }

      // Deferred cue (range not reached): once the return phase is over
      const deferred = deferredCueRef.current;
      if (deferred) {
        if (now > deferred.expires) deferredCueRef.current = null;
        else if (cueGateRef.current.phaseAllows(deferred.kind, motion.phase, now)) {
          deferredCueRef.current = null;
          if (cue(deferred.text, deferred.kind, deferred.key)) lastCoachCallRef.current = now;
        }
      }

      // Coach feedback (self-throttled to COACH_INTERVAL_MS, phase-gated)
      callCoach(angles);
    },
    [callCoach, cue, flushLogs, handleStopSession]
  );

  // ─── Skeleton render loop ───────────────────────────────────────────
  // Paints the latest smoothed landmarks on every animation frame in which
  // they changed, decoupled from inference callbacks (no drawing work inside
  // MediaPipe's callback, no tearing). The canvas backing store follows the
  // video's resolution; line widths scale with it.
  useEffect(() => {
    if (phase !== 'active') return;
    let raf = 0;
    let drawnVersion = -1;
    const render = () => {
      raf = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video || video.videoWidth === 0) return;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        drawnVersion = -1;
      }
      if (overlayVersionRef.current === drawnVersion) return;
      drawnVersion = overlayVersionRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const overlay = overlayRef.current;
      if (overlay) drawSkeleton(ctx, canvas.width, canvas.height, overlay.landmarks, overlay.colors);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Keep the ref pointed at the newest handler so the once-registered
  // pose.onResults callback never runs a stale closure.
  useEffect(() => {
    handlePoseResultsRef.current = handlePoseResults;
  }, [handlePoseResults]);

  // ─── Back to home ───────────────────────────────────────────────────
  const handleBackToHome = useCallback(() => {
    setPhase('pre-session');
    setSelectedExercise(null);
    setSummaryData(null);
    const st = useAppStore.getState();
    st.clearSessionData();
    st.setSelectedExerciseId(null);
    st.setSelectedQuestId(null);
  }, []);

  // =====================================================================
  // RENDER: Pre-Session Screen
  // =====================================================================
  if (phase === 'pre-session') {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              เลือกท่าฝึก
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ทำภารกิจที่ผู้ดูแลของคุณกำหนดไว้สำหรับวันนี้ ดูท่าตัวอย่างก่อนเริ่มฝึก
            </p>
          </motion.div>

          {/* Video recording consent (PDPA) */}
          {videoConsent && pickRecorderMime() !== null && (
            <Card className="mb-6">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className={`rounded-full p-2 ${videoConsent.consented ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                    {videoConsent.consented ? <ShieldCheck className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">บันทึกวิดีโอการฝึกให้ทีมผู้ดูแลตรวจสอบ</p>
                    <p className="text-xs text-muted-foreground">
                      {videoConsent.consented
                        ? `ให้ความยินยอมแล้ว${videoConsent.consentedAt ? ` เมื่อ ${new Date(videoConsent.consentedAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}` : ''} — วิดีโอจะถูกบันทึกเมื่อเปิดสวิตช์ด้านขวา`
                        : 'ยังไม่ได้ให้ความยินยอม — ไม่มีการบันทึกวิดีโอ (ระบบยังบันทึกเฉพาะข้อมูลมุมข้อต่อ)'}
                    </p>
                  </div>
                  {videoConsent.consented ? (
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={recordVideo} onCheckedChange={setRecordVideo} aria-label="บันทึกวิดีโอในการฝึกครั้งนี้" />
                      {recordVideo ? 'บันทึกครั้งนี้' : 'ไม่บันทึกครั้งนี้'}
                    </label>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setConsentOpen((o) => !o)}>
                      อ่านและให้ความยินยอม
                    </Button>
                  )}
                </div>

                {!videoConsent.consented && consentOpen && (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                    <p className="text-sm font-semibold">{VIDEO_CONSENT_TITLE}</p>
                    <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                      {VIDEO_CONSENT_POINTS.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                      />
                      ข้าพเจ้าได้อ่านและเข้าใจข้อความข้างต้น และยินยอมให้บันทึกวิดีโอการฝึกเพื่อการรักษา
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={!consentChecked || savingConsent}
                        onClick={() => saveVideoConsent(true)}
                      >
                        {savingConsent && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        ยินยอม
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConsentOpen(false)}>
                        ไม่ใช่ตอนนี้
                      </Button>
                    </div>
                  </div>
                )}

                {videoConsent.consented && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    disabled={savingConsent}
                    onClick={() => {
                      if (window.confirm('ถอนความยินยอมการบันทึกวิดีโอ? การฝึกครั้งต่อไปจะไม่บันทึกวิดีโอ')) saveVideoConsent(false);
                    }}
                  >
                    ถอนความยินยอม
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Today's quests (prescribed by the care team) */}
          {!loadingExercises && !loadError && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Target className="h-5 w-5 text-emerald-600" />
                ภารกิจวันนี้
                <span className="text-sm font-normal text-muted-foreground">
                  ({quests.filter((q) => q.status === 'COMPLETED').length}/{quests.length} สำเร็จ)
                </span>
              </h2>
              {quests.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  วันนี้ไม่มีภารกิจจากแพทย์/นักกายภาพ — ติดต่อผู้ดูแลผ่านแท็บข้อความได้
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {quests.map((quest) => {
                    const done = quest.status === 'COMPLETED';
                    const overridden = quest.exercise.targetJoints.some((t) => t.overridden);
                    return (
                      <Card
                        key={quest.id}
                        className={`${quest.id === selectedQuestId ? 'ring-2 ring-emerald-500' : ''} ${done ? 'opacity-75' : ''}`}
                      >
                        <CardContent className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold leading-tight">{quest.exercise.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {quest.prescription.title} · {quest.prescription.clinicianName}
                              </p>
                            </div>
                            {done ? (
                              <Badge className="bg-emerald-600 text-white">
                                <CheckCircle className="mr-1 h-3 w-3" /> สำเร็จ
                              </Badge>
                            ) : (
                              <Badge variant="outline">{quest.status === 'IN_PROGRESS' ? 'กำลังทำ' : 'รอทำ'}</Badge>
                            )}
                          </div>
                          <ExerciseDemo slug={quest.exercise.slug} compact target={quest.exercise.targetJoints.find((t) => t.isPrimary)} />
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RotateCcw className="h-3 w-3" />
                            {quest.exercise.sets} เซ็ต × {quest.exercise.repsPerSet} ครั้ง · พัก {quest.exercise.restSeconds} วินาที
                          </p>
                          {overridden && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">มุมเป้าหมายปรับโดยผู้ดูแลของคุณ</p>
                          )}
                          <Button
                            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                            size="sm"
                            disabled={connecting}
                            onClick={() => handleStartExercise({ questId: quest.id })}
                          >
                            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            {done ? 'ฝึกซ้ำ' : 'เริ่มภารกิจ'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {loadingExercises && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          )}
          {loadError && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CameraOff className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-muted-foreground">โหลดภารกิจไม่สำเร็จ</p>
              <p className="text-sm text-muted-foreground">กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =====================================================================
  // RENDER: Active Session Screen
  // =====================================================================
  if (phase === 'active') {
    const targets = selectedExercise?.targetJoints || [];
    const hiddenTargets = targets.filter((tj) => liveAngles[tj.name] === undefined);
    const repsPerSet = selectedExercise?.repsPerSet || 10;
    const avgAccuracy = sessionAccuracy.length
      ? Math.round(sessionAccuracy.reduce((a, b) => a + b, 0) / sessionAccuracy.length)
      : null;
    const soundLabel = ttsEnabled ? 'ปิดเสียงโค้ช' : 'เปิดเสียงโค้ช';

    return (
      <div className="relative h-[100dvh] overflow-hidden bg-black">
        {/* Video + Canvas fill the screen */}
        <div className="absolute inset-0">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full -scale-x-100 object-contain lg:object-cover"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full -scale-x-100 object-contain lg:object-cover"
          />
        </div>

        {/* Loading overlay while MediaPipe initializes */}
        {!mediaPipeLoaded && !cameraError && !mediaPipeError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-emerald-400" />
            <p className="text-sm font-medium text-white">กำลังเริ่มต้น AI...</p>
            <p className="mt-1 text-xs text-white/60">
              กำลังโหลดโมเดลตรวจจับท่าทาง (MediaPipe Pose) — ครั้งแรกอาจใช้เวลา 5-15 วินาที
            </p>
          </div>
        )}

        {/* Watchdog: loaded but frames stopped flowing */}
        {mediaPipeLoaded && !detectionActive && !cameraError && !mediaPipeError && (
          <div className="absolute inset-x-4 top-20 z-20 mx-auto flex max-w-md items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-medium text-black shadow-lg lg:right-[22rem]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            ยังไม่ได้รับผลตรวจจับจาก AI — ตรวจสอบว่าอยู่ในที่แสงเพียงพอและเห็นร่างกายชัดเจน
          </div>
        )}

        {/* No-person hint once detection is running */}
        {detectionActive && !personVisible && (
          <div className="absolute inset-x-4 top-20 z-20 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm lg:right-[22rem]">
            <PersonStanding className="h-4 w-4 text-emerald-400" />
            ถอยหลังให้เห็นลำตัว/ขาทั้งข้างในกรอบกล้อง
          </div>
        )}

        {/* Error overlay */}
        {(cameraError || mediaPipeError) && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80">
            <AlertTriangle className="mb-3 h-10 w-10 text-amber-400" />
            <p className="text-sm font-medium text-white">{cameraError || mediaPipeError}</p>
            <Button
              variant="outline"
              className="mt-4 border-white/30 text-white hover:bg-white/10"
              onClick={handleStopSession}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              กลับ
            </Button>
          </div>
        )}

        {/* ─── Top bar ──────────────────────────────────────────────── */}
        <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-3 sm:px-4">
          <button
            onClick={handleStopSession}
            className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            aria-label="หยุดเซสชัน"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold text-white">{selectedExercise?.nameTh || selectedExercise?.name || 'Exercise'}</p>
            <p className="text-xs text-white/70">
              เซ็ต {currentSet}/{selectedExercise?.sets || 3} • ครั้งที่ {currentRep}/{repsPerSet}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[11px] font-bold text-white" title="กำลังบันทึกวิดีโอ (ได้รับความยินยอมแล้ว)">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                REC
              </span>
            )}
            <button
              type="button"
              onClick={toggleTts}
              aria-pressed={ttsEnabled}
              aria-label={soundLabel}
              title={soundLabel}
              className={`rounded-full p-2 backdrop-blur-sm transition-colors ${
                ttsEnabled ? 'bg-emerald-500/90 text-white hover:bg-emerald-500' : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-sm font-semibold text-white">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        {/* ─── Pause overlay ────────────────────────────────────────── */}
        {isPaused && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <Pause className="mb-3 h-12 w-12 text-amber-400" />
            <p className="text-lg font-semibold text-white">หยุดชั่วคราว</p>
            <Button className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleTogglePause}>
              <Play className="mr-2 h-4 w-4" />
              ดำเนินการต่อ
            </Button>
          </div>
        )}

        {/* ─── Side panel (desktop) / bottom sheet (mobile) ─────────── */}
        {/* Flex column capped to the viewport: header and controls always
            visible, only the middle section scrolls. */}
        {mediaPipeLoaded && (
          <aside
            className="absolute inset-x-3 bottom-3 z-20 flex max-h-[55dvh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-white shadow-2xl backdrop-blur-xl lg:inset-x-auto lg:top-16 lg:right-4 lg:bottom-auto lg:max-h-[calc(100dvh-5rem)] lg:w-80"
            aria-label="แผงข้อมูลการฝึก"
          >
            {/* Header: always visible */}
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{selectedExercise?.nameTh || selectedExercise?.name}</p>
                <p className="text-[11px] text-white/60 tabular-nums">
                  เซ็ต {currentSet}/{selectedExercise?.sets || 3} · ครั้งที่ {currentRep}/{repsPerSet}
                  {avgAccuracy !== null && <> · แม่นยำ {avgAccuracy}%</>}
                </p>
              </div>
              <button
                type="button"
                onClick={togglePanel}
                className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-expanded={!panelCollapsed}
                aria-label={panelCollapsed ? 'ขยายแผงข้อมูล' : 'ย่อแผงข้อมูล'}
              >
                {panelCollapsed ? <ChevronUp className="h-4 w-4 lg:rotate-180" /> : <ChevronDown className="h-4 w-4 lg:rotate-180" />}
              </button>
            </div>

            {/* Scrollable body */}
            {!panelCollapsed && (
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
                {formCue && (
                  <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-500/20 p-2.5 text-xs font-medium text-amber-100">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                    {formCue}
                  </div>
                )}

                {/* AI Coach first: it is what the patient acts on */}
                <section>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/80">
                    <Activity className="h-3.5 w-3.5 text-amber-400" />
                    โค้ช
                    {coachLoading && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
                  </h4>
                  <p className="rounded-lg bg-white/5 p-3 text-sm leading-relaxed text-white/90">
                    {aiFeedback || 'โค้ชจะแนะนำเมื่อเริ่มตรวจจับท่าทาง'}
                  </p>
                </section>

                {/* Joint angles */}
                <section>
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/80">
                    <Target className="h-3.5 w-3.5 text-emerald-400" />
                    มุมข้อต่อปัจจุบัน
                  </h4>
                  <div className="space-y-2">
                    {targets.map((tj) => {
                      const current = liveAngles[tj.name];
                      if (current === undefined) return null;
                      const colorHex = ANGLE_STATUS_HEX[getAngleStatus(current, tj.minAngle, tj.maxAngle)];
                      return (
                        <div key={tj.name} className="rounded-lg bg-white/5 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-white/60">{tj.nameTh}</span>
                            <span className={`text-lg font-bold ${getAngleStatusColor(current, tj.minAngle, tj.maxAngle)}`}>
                              {formatAngle(current)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/40">
                            <span>เป้าหมาย {tj.idealAngle}°</span>
                            <span>
                              {tj.minAngle}°–{tj.maxAngle}°
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-all duration-200"
                              style={{ width: `${Math.min(100, (current / (tj.maxAngle + 20)) * 100)}%`, backgroundColor: colorHex }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {hiddenTargets.length > 0 && (
                      <p className="text-xs text-white/50">
                        {hiddenTargets.length === targets.length ? 'ยังมองไม่เห็น' : 'มองไม่เห็น'}{' '}
                        {hiddenTargets.map((t) => t.nameTh).join(', ')} — ถอยห่างจากกล้องให้เห็นไหล่ สะโพก และแขนขาทั้งหมด
                      </p>
                    )}
                  </div>
                </section>

                {/* Set / rep progress */}
                <section>
                  <div className="mb-1.5 flex items-center justify-between text-xs text-white/60">
                    <span className="flex items-center gap-1.5 font-semibold text-white/80">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                      ความคืบหน้า (เซ็ต {currentSet})
                    </span>
                    <span className="font-mono font-bold text-white">
                      {currentRep} / {repsPerSet}
                    </span>
                  </div>
                  <Progress value={(currentRep / repsPerSet) * 100} className="h-2 bg-white/10" />
                </section>

                {/* Demonstration (collapsible) */}
                <section>
                  <button
                    type="button"
                    onClick={() => setDemoOpen((o) => !o)}
                    className="flex w-full items-center justify-between text-xs font-semibold text-white/80"
                    aria-expanded={demoOpen}
                  >
                    ท่าตัวอย่างและวิธีทำ
                    {demoOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {demoOpen && selectedExercise && (
                    <>
                      <ExerciseDemo
                        slug={selectedExercise.slug}
                        target={selectedExercise.targetJoints.find((t) => t.isPrimary)}
                        compact
                        className="mt-2 bg-white/90 dark:bg-slate-900/80"
                      />
                      {selectedExercise.instructions.length > 0 && (
                        <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs leading-relaxed text-white/60">
                          {selectedExercise.instructions.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}

            {/* Controls: always visible */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5">
              <button
                type="button"
                onClick={toggleTts}
                aria-pressed={ttsEnabled}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  ttsEnabled ? 'bg-emerald-500/90 text-white hover:bg-emerald-500' : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {ttsEnabled ? 'เสียงเปิด' : 'เสียงปิด'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTogglePause}
                  className="rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
                  aria-label={isPaused ? 'ดำเนินการต่อ' : 'หยุดชั่วคราว'}
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleStopSession}
                  className="rounded-full bg-red-500/80 p-2.5 text-white transition-colors hover:bg-red-500"
                  aria-label="จบเซสชัน"
                >
                  <Square className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    );
  }

  // =====================================================================
  // RENDER: Session Summary Screen
  // =====================================================================
  if (phase === 'summary' && summaryData) {
    const avgAcc = summaryData.avgAccuracy;
    const accColor =
      avgAcc >= 80
        ? 'text-emerald-500'
        : avgAcc >= 60
        ? 'text-amber-500'
        : 'text-red-500';

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-600 px-6 py-8 text-center text-white">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle className="mx-auto mb-3 h-14 w-14" />
              </motion.div>
              <h2 className="text-xl font-bold">ฝึกเสร็จสิ้น!</h2>
              <p className="mt-1 text-sm text-white/80">
                {selectedExercise?.name || 'Exercise'}
              </p>
            </div>

            <CardContent className="space-y-4 p-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-2xl font-bold text-emerald-600">
                    {summaryData.totalReps}
                  </p>
                  <p className="text-xs text-muted-foreground">ครั้งทั้งหมด</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className={`text-2xl font-bold ${accColor}`}>
                    {summaryData.avgAccuracy}%
                  </p>
                  <p className="text-xs text-muted-foreground">ความแม่นยำ</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <p className="text-2xl font-bold text-foreground">
                    {formatTime(summaryData.totalTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">เวลา</p>
                </div>
              </div>

              <Separator />

              {/* Per-rep accuracy */}
              {summaryData.perRepAccuracy.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                    ความแม่นยำต่อซ้ำ
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {summaryData.perRepAccuracy.map((acc, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                          acc >= 80
                            ? 'bg-emerald-500'
                            : acc >= 60
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {summaryData.perRepAccuracy.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">
                  ยังไม่มีข้อมูลความแม่นยำรายซ้ำ
                </p>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleBackToHome}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  ฝึกอีกครั้ง
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    handleBackToHome();
                    setActiveTab('dashboard');
                  }}
                >
                  กลับหน้าหลัก
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Fallback
  return null;
}