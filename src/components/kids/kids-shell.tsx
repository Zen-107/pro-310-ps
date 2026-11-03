'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, House, Map, Star } from 'lucide-react';
import { useAppStore, type PatientTab } from '@/lib/store';
import type { SessionUser } from '@/lib/auth-guard';
import { LiveSessionView } from '@/components/physio/live-session-view';
import { Mascot } from '@/components/kids/mascot';
import { KidsHome } from '@/components/kids/kids-home';
import { KidsMissions } from '@/components/kids/kids-missions';
import { KidsRewards } from '@/components/kids/kids-rewards';
import { ExitKidMode } from '@/components/kids/exit-kid-mode';

// Patient side of the kids branch (docs/KIDS-ART-UI.md §9). Reuses the patient
// tab ids so the store and the camera session work unchanged. The care-team
// chat tab is left out on purpose: messaging belongs to the parent screens.

const kidsTabs: { id: PatientTab; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; color: string }[] = [
  { id: 'dashboard', label: 'บ้าน', icon: House, color: 'var(--kids-sky)' },
  { id: 'exercises', label: 'ภารกิจ', icon: Map, color: 'var(--kids-grass)' },
  { id: 'camera', label: 'เล่นเลย', icon: Camera, color: 'var(--kids-coral)' },
  { id: 'history', label: 'สติกเกอร์', icon: Star, color: 'var(--kids-grape)' },
];

export function KidsShell({ user }: { user: SessionUser }) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const isSessionActive = useAppStore((s) => s.isSessionActive);
  const setCurrentPatientId = useAppStore((s) => s.setCurrentPatientId);
  const tab: PatientTab = kidsTabs.some((t) => t.id === activeTab) ? (activeTab as PatientTab) : 'dashboard';

  // The child identity comes from the login, not from a picker
  useEffect(() => {
    setCurrentPatientId(user.patientId);
  }, [user.patientId, setCurrentPatientId]);

  // A running camera session keeps the camera tab open
  useEffect(() => {
    if (isSessionActive && activeTab !== 'camera') setActiveTab('camera');
  }, [isSessionActive, activeTab, setActiveTab]);

  // The camera session keeps its own full-screen layout (kids version: §12 of the guide)
  if (tab === 'camera') {
    return <LiveSessionView />;
  }

  return (
    <div className="theme-kids flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b-2 border-[var(--border)] bg-[var(--kids-paper)]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Mascot mood="happy" size={44} />
            <div className="leading-tight">
              <p className="text-xl font-bold">AI Physio Kids</p>
              <p className="text-sm text-[var(--kids-ink-soft)]">ยืด ขยับ แข็งแรง</p>
            </div>
          </div>
          {/* Small and plain on purpose: a grown-up control, not a game button */}
          <ExitKidMode returnName={user.returnName} />
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pb-32 pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {tab === 'dashboard' && <KidsHome onPlay={() => setActiveTab('camera')} />}
              {tab === 'exercises' && <KidsMissions />}
              {tab === 'history' && <KidsRewards />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom bar on every screen size, like a game menu */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-[var(--border)] bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid h-20 max-w-3xl grid-cols-4">
          {kidsTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1"
              >
                <motion.span
                  animate={{ scale: active ? 1.12 : 1, y: active ? -2 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: active ? t.color : 'transparent' }}
                >
                  <Icon className={`h-7 w-7 ${active ? 'text-white' : 'text-[var(--kids-ink-soft)]'}`} strokeWidth={2.5} />
                </motion.span>
                <span className={`text-sm ${active ? 'font-bold' : 'text-[var(--kids-ink-soft)]'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
