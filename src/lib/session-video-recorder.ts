// Records the session camera stream with MediaRecorder and uploads it to
// /api/sessions/[id]/video in sequential chunks (browser only). Only used when
// the patient has given video consent and left recording on for the session.

const MIME_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
const TIMESLICE_MS = 5000;
const VIDEO_BITS_PER_SECOND = 600_000; // ≈ 4.5 MB/min, enough to judge posture
const MAX_RETRIES = 3;

export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export class SessionVideoRecorder {
  private recorder: MediaRecorder | null = null;
  private seq = 0;
  private queue: Promise<void> = Promise.resolve();
  private failed = false;
  private stopped: Promise<void> | null = null;
  private startedAt = 0;
  /** Wall-clock pause intervals, so the viewer can map session time → video time */
  private pauses: { at: number; resumedAt: number | null }[] = [];

  constructor(
    private readonly stream: MediaStream,
    private readonly sessionId: string,
    private readonly onError: (message: string) => void = () => {}
  ) {}

  /** false when the browser cannot record */
  start(): boolean {
    const mime = pickRecorderMime();
    if (!mime) return false;
    // Video only: the session stream has no audio, and none is requested
    const videoOnly = new MediaStream(this.stream.getVideoTracks());
    this.recorder = new MediaRecorder(videoOnly, { mimeType: mime, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    this.recorder.ondataavailable = (e) => {
      // The end-of-recording marker is sent separately on 'stop'
      if (e.data.size > 0) this.enqueue(e.data, false);
    };
    this.recorder.start(TIMESLICE_MS);
    this.startedAt = Date.now();
    return true;
  }

  pause() {
    if (this.recorder?.state === 'recording') {
      this.recorder.pause();
      this.pauses.push({ at: Date.now(), resumedAt: null });
    }
  }

  resume() {
    if (this.recorder?.state === 'paused') {
      this.recorder.resume();
      const last = this.pauses[this.pauses.length - 1];
      if (last && last.resumedAt === null) last.resumedAt = Date.now();
    }
  }

  get isRecording(): boolean {
    return !!this.recorder && this.recorder.state !== 'inactive' && !this.failed;
  }

  /** Stop and wait for the last chunk to upload */
  stop(): Promise<void> {
    if (this.stopped) return this.stopped;
    const rec = this.recorder;
    if (!rec || rec.state === 'inactive') return (this.stopped = this.queue);
    const open = this.pauses[this.pauses.length - 1];
    if (open && open.resumedAt === null) open.resumedAt = Date.now();
    this.stopped = new Promise<void>((resolve) => {
      rec.addEventListener('stop', () => {
        // ondataavailable for the final slice fires before 'stop'; mark the end
        this.enqueue(new Blob([], { type: rec.mimeType }), true);
        this.queue.then(resolve, resolve);
      }, { once: true });
      rec.stop();
    });
    return this.stopped;
  }

  private enqueue(blob: Blob, final: boolean) {
    const seq = this.seq++;
    this.queue = this.queue.then(() => this.upload(blob, seq, final));
  }

  private async upload(blob: Blob, seq: number, final: boolean): Promise<void> {
    if (this.failed) return; // chunks must be contiguous: stop after a lost one
    const params = new URLSearchParams({ seq: String(seq) });
    if (final) params.set('final', '1');
    if (seq === 0) params.set('startedAt', String(this.startedAt));
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`/api/sessions/${this.sessionId}/video?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': blob.type || this.recorder?.mimeType || 'video/webm',
            ...(final ? { 'X-Video-Pauses': JSON.stringify(this.pauses.slice(0, 200)) } : {}),
          },
          body: blob,
        });
        if (res.ok) return;
        if (res.status === 403 || res.status === 409 || res.status === 413) break; // not retryable
      } catch {
        // network error: retry
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
    this.failed = true;
    if (this.recorder?.state !== 'inactive') this.recorder?.stop();
    this.onError('บันทึกวิดีโอไม่สำเร็จ — การฝึกยังดำเนินต่อได้ตามปกติ');
  }
}
