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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import {
  calculateAllAngles,
  isAngleCorrect,
  formatAngle,
  getAngleStatusColor,
  LANDMARKS,
  SKELETON_CONNECTIONS,
  type Landmark,
} from '@/lib/angle-utils';
import type { ExerciseData, TargetJoint } from '@/lib/exercises-data';
import { CATEGORIES } from '@/lib/exercises-data';

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
  beginner: { label: 'เริ่มต้น', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  intermediate: { label: 'ปานกลาง', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  advanced: { label: 'ขั้นสูง', className: 'bg-red-500/15 text-red-600 border-red-500/30' },
};

const bodyPartLabels: Record<string, string> = {
  lower: 'ร่างกายล่าง',
  upper: 'ร่างกายบน',
  full: 'ทั้งตัว',
};

// ─── MediaPipe CDN URLs (pin explicit versions for reliability) ────────
const MP_BASE = 'https://cdn.jsdelivr.net/npm';
const CAMERA_UTILS_CDN = `${MP_BASE}/@mediapipe/camera_utils@0.3/camera_utils.js`;
const POSE_VERSION = '0.1';
const POSE_BASE_URL = `${MP_BASE}/@mediapipe/pose@${POSE_VERSION}/`;
const POSE_CDN = `${POSE_BASE_URL}pose.js`;

// ─── Helper: load script (with timeout + retry) ────────────────────────
function loadScript(src: string, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve, reject) => {
    // If the global provided by this script already exists, skip re-loading
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === 'true') {
      resolve();
      return;
    }
    const s = existing ?? document.createElement('script');
    s.src = src;
    // IMPORTANT: do NOT set crossOrigin here. The MediaPipe loader creates a
    // same-origin Blob worker that importScripts() these CDN files; adding
    // crossorigin can trigger opaque-response failures in some browsers.
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timeout loading: ${src}`));
      }
    }, timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        s.dataset.loaded = 'true';
        resolve();
      }
    };
    s.onerror = () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new Error(`Failed to load: ${src}`));
      }
    };
    if (!existing) document.head.appendChild(s);
  });
}

async function loadScriptWithRetry(src: string, attempts = 2): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await loadScript(src);
      return;
    } catch (err) {
      lastErr = err;
      // wait a bit before retrying
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Failed to load: ${src}`);
}

// ─── Helper: format time MM:SS ────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─── Types ─────────────────────────────────────────────────────────────
interface ExerciseFromAPI {
  id: string;
  name: string;
  nameTh: string;
  category: string;
  description: string;
  instructions: string[];
  targetJoints: TargetJoint[];
  difficulty: string;
  sets: number;
  repsPerSet: number;
  restSeconds: number;
  icon: string;
  bodyPart: string;
}

type SessionPhase = 'pre-session' | 'active' | 'summary';

// =====================================================================
// MAIN COMPONENT
// =====================================================================
export function LiveSessionView() {
  // ─── Store ──────────────────────────────────────────────────────────
  const store = useAppStore();

  // ─── Local State ────────────────────────────────────────────────────
  const [phase, setPhase] = useState<SessionPhase>('pre-session');
  const [exercises, setExercises] = useState<ExerciseFromAPI[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseFromAPI | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [mediaPipeLoaded, setMediaPipeLoaded] = useState(false);
  const [detectionActive, setDetectionActive] = useState(false); // true once landmarks arrive
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
  const poseRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCoachCallRef = useRef<number>(0);
  const repStateRef = useRef<{ wasInRange: boolean; lockTime: number }>({
    wasInRange: false,
    lockTime: 0,
  });
  const streamRef = useRef<MediaStream | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const maxRomRef = useRef<number>(0);
  const processingRef = useRef<boolean>(false); // true while pose.send() is in flight
  const isPausedRef = useRef<boolean>(false); // mirror of isPaused for use inside callbacks
  const lastFrameTimeRef = useRef<number>(0); // watchdog: timestamp of last processed frame
  // ── Latest-value refs for the pose pipeline ──────────────────────────
  // pose.onResults and the init effect are registered ONCE (empty deps) so
  // they never re-run, but handlePoseResults reads exercise/store data that
  // changes over time. We mirror those values into refs so the callback
  // always sees fresh data without needing to re-register onResults.
  const handlePoseResultsRef = useRef<(results: unknown) => void>(() => {});
  const selectedExerciseRef = useRef<ExerciseFromAPI | null>(null);
  const detectionActiveRef = useRef<boolean>(false); // one-shot guard for setDetectionActive

  // keep the ref in sync so onResults callback (registered once) sees latest value
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Mirror changing values into refs — see note above the ref declarations.
  useEffect(() => {
    selectedExerciseRef.current = selectedExercise;
  }, [selectedExercise]);

  // ─── Fetch exercises ────────────────────────────────────────────────
  useEffect(() => {
    async function fetchExercises() {
      try {
        const res = await fetch('/api/exercises');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setExercises(data);
      } catch {
        // Fallback to exercises-data
        const { EXERCISES } = await import('@/lib/exercises-data');
        setExercises(
          EXERCISES.map((ex, idx) => ({
            ...ex,
            id: `local-${idx}`,
            targetJoints: ex.targetJoints,
            instructions: ex.instructions,
          }))
        );
      } finally {
        setLoadingExercises(false);
      }
    }
    fetchExercises();
  }, []);

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

  // ─── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ─── TTS helper ─────────────────────────────────────────────────────
  const speakText = useCallback(
    async (text: string) => {
      if (!ttsEnabled) return;
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch(() => {});
        audio.onended = () => URL.revokeObjectURL(url);
      } catch {
        // Silently fail TTS
      }
    },
    [ttsEnabled]
  );

  // ─── AI Coach call (debounced) ──────────────────────────────────────
  const callCoach = useCallback(
    (currentAngles: Record<string, number>) => {
      if (!selectedExercise) return;
      const now = Date.now();
      if (now - lastCoachCallRef.current < 8000) return;
      lastCoachCallRef.current = now;

      setCoachLoading(true);
      fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseName: selectedExercise.nameTh,
          currentAngles,
          targetJoints: selectedExercise.targetJoints,
          repCount: store.currentRep,
          setCount: store.currentSet,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          const fb = data.feedback || 'ทำดีมากครับ! ทำต่อไปเลย';
          store.setAiFeedback(fb);
          speakText(fb);
        })
        .catch(() => {
          store.setAiFeedback('ทำดีมากครับ! ทำต่อไปเลย');
        })
        .finally(() => {
          setCoachLoading(false);
        });
    },
    [selectedExercise, store, speakText]
  );

  // ─── Start exercise ─────────────────────────────────────────────────
  const handleStartExercise = useCallback(
    async (exercise: ExerciseFromAPI) => {
      setConnecting(true);
      try {
        // Create session
        const sessionRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exerciseId: exercise.id, patientId: store.currentPatientId }),
        });
        const sessionData = await sessionRes.json();

        // Update store
        store.setSelectedExerciseId(exercise.id);
        store.setIsSessionActive(true);
        store.setCurrentSessionId(sessionData.id);
        store.clearSessionData();
        store.setCurrentSet(1);
        store.setCurrentRep(0);

        setSelectedExercise(exercise);
        setPhase('active');
        setElapsedSeconds(0);
        sessionStartTimeRef.current = Date.now();
        maxRomRef.current = 0;
        repStateRef.current = { wasInRange: false, lockTime: 0 };
        lastCoachCallRef.current = 0;
      } catch {
        setConnecting(false);
      } finally {
        setConnecting(false);
      }
    },
    [store]
  );

  // ─── Stop session ───────────────────────────────────────────────────
  const handleStopSession = useCallback(async () => {
    // Stop camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Stop MediaPipe (close WASM graph + release worker)
    try {
      const pose = poseRef.current as { close?: () => void } | null;
      if (pose?.close) pose.close();
    } catch {
      // ignore
    }
    poseRef.current = null;
    setMediaPipeLoaded(false);
    setDetectionActive(false);
    detectionActiveRef.current = false;

    // Finalize session
    const totalReps = store.currentRep;
    const accuracies = store.sessionAccuracy;
    const avgAccuracy =
      accuracies.length > 0
        ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
        : 0;

    if (store.currentSessionId) {
      try {
        await fetch(`/api/sessions/${store.currentSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            endedAt: new Date().toISOString(),
            totalReps,
            avgAccuracy,
            maxRom: maxRomRef.current,
          }),
        });
      } catch {
        // ignore
      }
    }

    setSummaryData({
      totalReps,
      avgAccuracy,
      totalTime: elapsedSeconds,
      perRepAccuracy: accuracies,
    });

    // Reset store
    store.setIsSessionActive(false);
    store.setCurrentSessionId(null);
    store.setSelectedExerciseId(null);

    setPhase('summary');
  }, [store, elapsedSeconds]);

  // ─── Toggle pause ───────────────────────────────────────────────────
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // ─── Initialize MediaPipe + Camera ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'active') return;

    let cancelled = false;
    let rafId = 0;

    async function initMediaPipe() {
      try {
        // 1) Load MediaPipe scripts from CDN (with timeout + retry)
        await loadScriptWithRetry(CAMERA_UTILS_CDN);
        await loadScriptWithRetry(POSE_CDN);

        if (cancelled) return;

        // Access window globals
        const w = window as unknown as {
          Pose: new (config: { locateFile: (file: string) => string }) => {
            setOptions: (opts: Record<string, unknown>) => Promise<void>;
            onResults: (cb: (results: unknown) => void) => void;
            initialize: () => Promise<void>;
            close: () => void;
            send: (input: { image: HTMLVideoElement } | HTMLVideoElement) => Promise<void>;
          };
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
        const pose = new w.Pose({
          locateFile: (file: string) => `${POSE_BASE_URL}${file}`,
        });

        await pose.setOptions({
          selfieMode: true, // landmarks come back already mirrored → matches -scale-x-100 canvas
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        pose.onResults((results: unknown) => {
          if (cancelled) return;
          if (isPausedRef.current) return;
          // Indirection through a ref: this callback is registered once, but
          // handlePoseResults is re-created when exercise/store change. The
          // ref always points at the LATEST version of the handler.
          handlePoseResultsRef.current(results);
        });

        await pose.initialize();
        if (cancelled) return;
        poseRef.current = pose;
        setMediaPipeLoaded(true);

        // 4) Drive detection with our own rAF loop instead of camera_utils'
        //    internal setInterval. This is more robust: it naturally throttles
        //    to the display refresh rate and never queues frames while the
        //    WASM model is still busy (pose.send is awaited per frame).
        const sendLoop = async () => {
          if (cancelled) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2 && !processingRef.current) {
            processingRef.current = true;
            try {
              await pose.send({ image: v });
            } catch {
              // ignore single-frame inference errors, keep looping
            } finally {
              processingRef.current = false;
            }
          }
          rafId = requestAnimationFrame(sendLoop);
        };
        rafId = requestAnimationFrame(sendLoop);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ─── Handle pose results ────────────────────────────────────────────
  const handlePoseResults = useCallback(
    (results: unknown) => {
      const r = results as {
        poseLandmarks?: Landmark[];
        image?: HTMLVideoElement | HTMLCanvasElement;
      };

      if (!canvasRef.current) return;

      const landmarks = r.poseLandmarks;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = videoRef.current;
      if (!video) return;

      // Match canvas to displayed video size
      if (canvas.width !== video.videoWidth && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Watchdog: remember when we last received a processed frame
      lastFrameTimeRef.current = Date.now();

      // No person detected this frame → clear skeleton + show hint
      if (!landmarks || landmarks.length < 33) {
        store.setSkeletonLandmarks([]);
        return;
      }

      // First successful detection → flip watchdog to "active" (only once —
      // calling setState every frame would re-render the component 30x/sec)
      if (!detectionActiveRef.current) {
        detectionActiveRef.current = true;
        setDetectionActive(true);
      }

      // Calculate angles
      const angles = calculateAllAngles(landmarks);

      // Update store angles
      Object.entries(angles).forEach(([joint, angle]) => {
        store.setLiveAngle(joint, angle);
      });

      // Store landmarks
      store.setSkeletonLandmarks(landmarks.map((l) => ({ x: l.x, y: l.y, z: l.z })));

      // Determine colors for connections
      const targetJoints = selectedExerciseRef.current?.targetJoints || [];

      // Build a map of joint index -> color based on target joints
      const jointColorMap: Record<number, string> = {};
      const JOINT_MAP: Record<string, number> = {
        left_shoulder: LANDMARKS.LEFT_SHOULDER,
        right_shoulder: LANDMARKS.RIGHT_SHOULDER,
        left_elbow: LANDMARKS.LEFT_ELBOW,
        right_elbow: LANDMARKS.RIGHT_ELBOW,
        left_wrist: LANDMARKS.LEFT_WRIST,
        right_wrist: LANDMARKS.RIGHT_WRIST,
        left_hip: LANDMARKS.LEFT_HIP,
        right_hip: LANDMARKS.RIGHT_HIP,
        left_knee: LANDMARKS.LEFT_KNEE,
        right_knee: LANDMARKS.RIGHT_KNEE,
        left_ankle: LANDMARKS.LEFT_ANKLE,
        right_ankle: LANDMARKS.RIGHT_ANKLE,
      };

      // Color for each target joint
      const jointStatusColor: Record<string, string> = {};
      targetJoints.forEach((tj) => {
        const currentAngle = angles[tj.name];
        if (currentAngle !== undefined) {
          if (currentAngle >= tj.minAngle && currentAngle <= tj.maxAngle) {
            jointStatusColor[tj.name] = '#10b981'; // green
          } else {
            const dev = Math.min(
              Math.abs(currentAngle - tj.minAngle),
              Math.abs(currentAngle - tj.maxAngle)
            );
            jointStatusColor[tj.name] = dev <= 15 ? '#f59e0b' : '#ef4444'; // amber / red
          }
        }
      });

      // Map joint name to color
      Object.entries(jointStatusColor).forEach(([name, color]) => {
        const idx = JOINT_MAP[name];
        if (idx !== undefined) {
          jointColorMap[idx] = color;
        }
      });

      // Draw skeleton connections
      // NOTE: selfieMode:true already mirrors landmarks, and both <video> and
      // <canvas> are flipped by the same CSS (-scale-x-100). So we draw with
      // RAW landmark coordinates — flipping here too would double-mirror and
      // misalign the skeleton from the body.
      SKELETON_CONNECTIONS.forEach(([i, j]) => {
        const lm1 = landmarks[i];
        const lm2 = landmarks[j];
        if (!lm1 || !lm2) return;
        if ((lm1.visibility ?? 0) < 0.5 || (lm2.visibility ?? 0) < 0.5) return;

        const x1 = lm1.x * canvas.width;
        const y1 = lm1.y * canvas.height;
        const x2 = lm2.x * canvas.width;
        const y2 = lm2.y * canvas.height;

        // Determine line color
        let lineColor = '#10b981'; // default green
        const c1 = jointColorMap[i];
        const c2 = jointColorMap[j];
        if (c1 === '#ef4444' || c2 === '#ef4444') {
          lineColor = '#ef4444';
        } else if (c1 === '#f59e0b' || c2 === '#f59e0b') {
          lineColor = '#f59e0b';
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      // Draw joint circles
      const keyIndices = [
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

      keyIndices.forEach((idx) => {
        const lm = landmarks[idx];
        if (!lm || (lm.visibility ?? 0) < 0.5) return;

        const x = lm.x * canvas.width; // raw coords; CSS -scale-x-100 handles mirroring
        const y = lm.y * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = jointColorMap[idx] || '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      // ─── Rep detection ─────────────────────────────────────────────
      if (targetJoints.length > 0) {
        const primaryTarget = targetJoints[0];
        const currentAngle = angles[primaryTarget.name];
        if (currentAngle !== undefined) {
          const inRange =
            currentAngle >= primaryTarget.minAngle &&
            currentAngle <= primaryTarget.maxAngle;
          const now = Date.now();
          const state = repStateRef.current;

          // Track max ROM
          if (currentAngle > maxRomRef.current) {
            maxRomRef.current = currentAngle;
          }

          if (inRange && !state.wasInRange && now - state.lockTime > 500) {
            // Entered target range → count rep
            const newRep = store.currentRep + 1;
            store.setCurrentRep(newRep);

            // Calculate accuracy for this rep
            const { percentAccuracy } = isAngleCorrect(
              currentAngle,
              primaryTarget.idealAngle,
              primaryTarget.minAngle,
              primaryTarget.maxAngle
            );
            store.addAccuracy(percentAccuracy);

            repStateRef.current = { wasInRange: true, lockTime: now };

            // Check set completion
            if (newRep >= (selectedExercise?.repsPerSet || 10)) {
              const newSet = store.currentSet + 1;
              if (newSet > (selectedExercise?.sets || 3)) {
                // Session complete
                handleStopSession();
                return;
              }
              store.setCurrentSet(newSet);
              store.setCurrentRep(0);
              repStateRef.current = { wasInRange: false, lockTime: now };
            }

            // Trigger coach feedback
            callCoach(angles);
          } else if (!inRange) {
            state.wasInRange = false;
          }
        }
      }

      // Periodic coach call (~8 seconds)
      const now = Date.now();
      if (now - lastCoachCallRef.current >= 8000 && !coachLoading) {
        callCoach(angles);
      }
    },
    [selectedExercise, store, callCoach, coachLoading, handleStopSession]
  );

  // Keep the ref pointed at the newest handler version so the once-registered
  // pose.onResults callback never runs a stale closure (this was the root
  // cause of "camera works but no skeleton": an old closure could early-return
  // or read outdated exercise data while drawing nothing).
  useEffect(() => {
    handlePoseResultsRef.current = handlePoseResults;
  }, [handlePoseResults]);

  // ─── Back to home ───────────────────────────────────────────────────
  const handleBackToHome = useCallback(() => {
    setPhase('pre-session');
    setSelectedExercise(null);
    setSummaryData(null);
    store.clearSessionData();
    store.setAiFeedback('');
    store.clearLiveAngles();
    store.setSelectedExerciseId(null);
  }, [store]);

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
              เลือกท่ากายภาพบำบัดที่ต้องการฝึก จากนั้นกดเริ่มฝึกเพื่อเข้าสู่เซสชัน
            </p>
          </motion.div>

          {/* Exercise Grid */}
          {loadingExercises ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="mb-3 h-5 w-3/4" />
                    <Skeleton className="mb-2 h-4 w-full" />
                    <Skeleton className="mb-2 h-4 w-1/2" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-6 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CameraOff className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium text-muted-foreground">
                ไม่พบท่าฝึก
              </p>
              <p className="text-sm text-muted-foreground">
                กรุณาเพิ่มท่าฝึกในระบบก่อน
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {exercises.map((exercise, idx) => {
                const catInfo = CATEGORIES.find((c) => c.id === exercise.category);
                const diff = difficultyConfig[exercise.difficulty] || difficultyConfig.beginner;
                return (
                  <motion.div
                    key={exercise.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="group overflow-hidden transition-shadow hover:shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                              {exerciseIconMap[exercise.icon] || <Activity className="h-5 w-5" />}
                            </div>
                            <div>
                              <CardTitle className="text-base leading-tight">
                                {exercise.nameTh}
                              </CardTitle>
                              <p className="text-xs text-muted-foreground">{exercise.name}</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 pt-0">
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {exercise.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="outline" className={diff.className}>
                            {diff.label}
                          </Badge>
                          {catInfo && (
                            <Badge variant="outline" className="border-muted bg-muted/50 text-muted-foreground">
                              {catInfo.name}
                            </Badge>
                          )}
                          <Badge variant="outline" className="border-muted bg-muted/50 text-muted-foreground">
                            {bodyPartLabels[exercise.bodyPart] || exercise.bodyPart}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <RotateCcw className="h-3 w-3" />
                            {exercise.sets} เซ็ต × {exercise.repsPerSet} ครั้ง
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            พัก {exercise.restSeconds} วินาที
                          </span>
                        </div>

                        <Button
                          className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                          size="sm"
                          disabled={connecting}
                          onClick={() => handleStartExercise(exercise)}
                        >
                          {connecting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="mr-2 h-4 w-4" />
                          )}
                          เริ่มฝึก
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
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
    return (
      <div className="relative min-h-screen overflow-hidden bg-black">
        {/* Video + Canvas Container */}
        <div className="relative mx-auto aspect-[4/3] w-full max-w-6xl lg:aspect-video lg:h-screen lg:max-w-none">
          {/* Video Element */}
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
            playsInline
            muted
          />

          {/* Canvas Overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full -scale-x-100"
          />

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
            <div className="absolute inset-x-0 bottom-24 z-20 mx-auto flex max-w-md items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-medium text-black shadow-lg lg:bottom-8">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              ยังไม่ได้รับผลตรวจจับจาก AI — ตรวจสอบว่าอยู่ในที่แสงเพียงพอและเห็นร่างกายชัดเจน
            </div>
          )}

          {/* No-person hint once detection is running */}
          {detectionActive && store.skeletonLandmarks.length === 0 && (
            <div className="absolute inset-x-0 top-20 z-20 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
              <PersonStanding className="h-4 w-4 text-emerald-400" />
              ถอยหลังให้เห็นลำตัว/ขาทั้งข้างในกรอบกล้อง
            </div>
          )}

          {/* Error overlay */}
          {(cameraError || mediaPipeError) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
              <AlertTriangle className="mb-3 h-10 w-10 text-amber-400" />
              <p className="text-sm font-medium text-white">
                {cameraError || mediaPipeError}
              </p>
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
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
            <button
              onClick={handleStopSession}
              className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
              aria-label="หยุดเซสชัน"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                {selectedExercise?.nameTh || 'กำลังฝึก...'}
              </p>
              <p className="text-xs text-white/60">
                เซ็ต {store.currentSet}/{selectedExercise?.sets || 3} • ซ้ำ{' '}
                {store.currentRep}/{selectedExercise?.repsPerSet || 10}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-sm font-semibold text-white">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* ─── Pause overlay ────────────────────────────────────────── */}
          {isPaused && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
              <Pause className="mb-3 h-12 w-12 text-amber-400" />
              <p className="text-lg font-semibold text-white">หยุดชั่วคราว</p>
              <Button
                className="mt-4 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleTogglePause}
              >
                <Play className="mr-2 h-4 w-4" />
                ดำเนินการต่อ
              </Button>
            </div>
          )}

          {/* ─── Right panel (desktop) / Bottom panel (mobile) ────────── */}
          {mediaPipeLoaded && (
            <div className="absolute right-0 bottom-0 left-0 z-20 lg:right-4 lg:bottom-4 lg:left-auto lg:w-80">
              <div className="mx-4 mb-4 max-h-[50vh] overflow-hidden rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl lg:mx-0 lg:mb-0 lg:max-h-[85vh]">
                <ScrollArea className="max-h-[50vh] lg:max-h-[85vh]">
                  <div className="p-4 space-y-4">
                    {/* ─── Exercise info ──────────────────────────────── */}
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {selectedExercise?.nameTh}
                      </h3>
                      {selectedExercise?.instructions && selectedExercise.instructions.length > 0 && (
                        <p className="mt-1 text-xs leading-relaxed text-white/60">
                          {selectedExercise.instructions[0]}
                        </p>
                      )}
                    </div>

                    <Separator className="bg-white/10" />

                    {/* ─── Joint Angles ───────────────────────────────── */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/80">
                        <Target className="h-3.5 w-3.5 text-emerald-400" />
                        มุมข้อต่อปัจจุบัน
                      </h4>
                      <div className="space-y-2">
                        {(selectedExercise?.targetJoints || []).map((tj) => {
                          const current = store.liveAngles[tj.name];
                          if (current === undefined) return null;
                          const colorClass = getAngleStatusColor(
                            current,
                            tj.minAngle,
                            tj.maxAngle
                          );
                          const colorHex =
                            current >= tj.minAngle && current <= tj.maxAngle
                              ? '#10b981'
                              : Math.min(
                                  Math.abs(current - tj.minAngle),
                                  Math.abs(current - tj.maxAngle)
                                ) <= 15
                                ? '#f59e0b'
                                : '#ef4444';

                          return (
                            <div
                              key={tj.name}
                              className="rounded-lg bg-white/5 p-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-white/60">
                                  {tj.nameTh}
                                </span>
                                <span
                                  className={`text-lg font-bold ${colorClass}`}
                                >
                                  {formatAngle(current)}
                                </span>
                              </div>
                              <div className="mt-1.5">
                                <div className="flex items-center justify-between text-[10px] text-white/40">
                                  <span>
                                    เป้าหมาย {tj.idealAngle}°
                                  </span>
                                  <span>
                                    {tj.minAngle}°–{tj.maxAngle}°
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full transition-all duration-200"
                                    style={{
                                      width: `${Math.min(100, (current / (tj.maxAngle + 20)) * 100)}%`,
                                      backgroundColor: colorHex,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {Object.keys(store.liveAngles).length === 0 && (
                          <p className="text-xs text-white/40">
                            รอข้อมูลจากกล้อง...
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-white/10" />

                    {/* ─── AI Coach Feedback ──────────────────────────── */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/80">
                        <Activity className="h-3.5 w-3.5 text-amber-400" />
                        AI Coach
                      </h4>
                      <div className="rounded-lg bg-white/5 p-3">
                        {coachLoading ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                            <span className="text-xs text-white/60">
                              กำลังเริ่มต้น AI...
                            </span>
                          </div>
                        ) : store.aiFeedback ? (
                          <p className="text-xs leading-relaxed text-white/80">
                            {store.aiFeedback}
                          </p>
                        ) : (
                          <p className="text-xs text-white/40">
                            AI Coach จะให้คำแนะนำเมื่อเริ่มตรวจจับท่าทาง
                          </p>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-white/10" />

                    {/* ─── Rep/Set progress ───────────────────────────── */}
                    <div>
                      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/80">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        ความคืบหน้า
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5">
                          <span className="text-xs text-white/60">เซ็ต</span>
                          <span className="font-mono text-sm font-bold text-white">
                            {store.currentSet} / {selectedExercise?.sets || 3}
                          </span>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2.5">
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs text-white/60">
                              ซ้ำ (เซ็ต {store.currentSet})
                            </span>
                            <span className="font-mono text-sm font-bold text-white">
                              {store.currentRep} / {selectedExercise?.repsPerSet || 10}
                            </span>
                          </div>
                          <Progress
                            value={
                              selectedExercise?.repsPerSet
                                ? (store.currentRep / selectedExercise.repsPerSet) * 100
                                : 0
                            }
                            className="h-2 bg-white/10"
                          />
                        </div>
                        {store.sessionAccuracy.length > 0 && (
                          <div className="flex items-center justify-between rounded-lg bg-white/5 p-2.5">
                            <span className="text-xs text-white/60">
                              ความแม่นยำเฉลี่ย
                            </span>
                            <span className="text-sm font-bold text-emerald-400">
                              {Math.round(
                                store.sessionAccuracy.reduce((a, b) => a + b, 0) /
                                  store.sessionAccuracy.length
                              )}
                              %
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                {/* ─── Controls ──────────────────────────────────────── */}
                <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={ttsEnabled}
                      onCheckedChange={setTtsEnabled}
                      id="tts-toggle"
                    />
                    <label
                      htmlFor="tts-toggle"
                      className="flex cursor-pointer items-center gap-1 text-xs text-white/60"
                    >
                      {ttsEnabled ? (
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5" />
                      )}
                      เสียงพูด
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTogglePause}
                      className="rounded-full bg-white/10 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                      aria-label={isPaused ? 'ดำเนินการต่อ' : 'หยุดชั่วคราว'}
                    >
                      {isPaused ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={handleStopSession}
                      className="rounded-full bg-red-500/80 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-red-500"
                      aria-label="หยุดเซสชัน"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
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
                {selectedExercise?.nameTh || 'ท่าฝึก'}
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
                    store.setActiveTab('dashboard');
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