'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Care-team thread for one patient (patient ↔ all clinicians in the care team).
// Polls for new messages every POLL_MS.

const POLL_MS = 5000;
const MAX_LENGTH = 2000;

interface Message {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: { id: string; name: string; role: string; title: string | null };
}

const TITLE_LABEL: Record<string, string> = { DOCTOR: 'แพทย์', PHYSIOTHERAPIST: 'นักกายภาพ' };

export function CareChat({ patientId, viewer }: { patientId?: string; viewer: 'PATIENT' | 'CLINICIAN' }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string | null>(null);

  const query = useCallback(
    (after?: string | null) => {
      const params = new URLSearchParams();
      if (patientId) params.set('patientId', patientId);
      if (after) params.set('after', after);
      return `/api/messages?${params.toString()}`;
    },
    [patientId]
  );

  const append = (incoming: Message[]) => {
    if (incoming.length === 0) return;
    setMessages((list) => {
      const seen = new Set(list.map((m) => m.id));
      const next = [...list, ...incoming.filter((m) => !seen.has(m.id))];
      lastAtRef.current = next[next.length - 1]?.createdAt ?? lastAtRef.current;
      return next;
    });
  };

  // Initial load + polling for newer messages (the component is keyed per
  // thread, so state starts fresh for each patient)
  useEffect(() => {
    let cancelled = false;
    lastAtRef.current = null;

    fetch(query())
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancelled) return;
        const list: Message[] = d.messages ?? [];
        setMessages(list);
        lastAtRef.current = list[list.length - 1]?.createdAt ?? null;
      })
      .catch(() => !cancelled && toast.error('โหลดข้อความไม่สำเร็จ'))
      .finally(() => !cancelled && setLoading(false));

    const id = setInterval(() => {
      fetch(query(lastAtRef.current ?? new Date(0).toISOString()))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && d && append(d.messages ?? []))
        .catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [query]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, body }),
      });
      if (!res.ok) throw new Error();
      append([await res.json()]);
      setDraft('');
    } catch {
      toast.error('ส่งข้อความไม่สำเร็จ');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[60vh] min-h-[360px] flex-col rounded-xl border bg-background">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">
            {viewer === 'PATIENT' ? 'ยังไม่มีข้อความ — ส่งคำถามถึงทีมผู้ดูแลของคุณได้เลย' : 'ยังไม่มีข้อความกับผู้ป่วยรายนี้'}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.mine ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm bg-muted'
                }`}
              >
                {!m.mine && (
                  <p className="mb-0.5 text-[11px] font-semibold text-muted-foreground">
                    {m.sender.name}
                    {m.sender.title && ` · ${TITLE_LABEL[m.sender.title] ?? m.sender.title}`}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-right text-[10px] ${m.mine ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                  {new Date(m.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {viewer === 'PATIENT' && (
        <p className="flex items-center gap-1.5 border-t bg-amber-50 px-4 py-1.5 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          ข้อความนี้ไม่ใช่ช่องทางฉุกเฉิน — หากมีอาการรุนแรงหรือฉุกเฉิน โทร 1669
        </p>
      )}

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="พิมพ์ข้อความ… (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
          className="max-h-32 min-h-10 resize-none"
          aria-label="Message"
        />
        <Button type="submit" size="icon" className="shrink-0 bg-emerald-600 hover:bg-emerald-700" disabled={sending || !draft.trim()} aria-label="Send">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
