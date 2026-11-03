'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { LogOut, UserCircle } from 'lucide-react';
import { Mascot } from '@/components/kids/mascot';
import type { SessionUser } from '@/lib/auth-guard';
import { ROLE_LABELS } from '@/lib/roles';

// Shared layout for adult screens (teacher, parent, expert): header with the
// role, tabs on top (desktop) or at the bottom (mobile), warm adult theme.

export interface AdultTab<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function AdultShell<T extends string>({
  user,
  tabs,
  active,
  onChange,
  wide = false,
  children,
}: {
  user: SessionUser;
  tabs: AdultTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  /** Wider content for tables and charts */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const width = wide ? 'max-w-7xl' : 'max-w-5xl';
  return (
    <div className="theme-adult flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-[var(--kids-paper)]/90 backdrop-blur-lg">
        <div className={`${width} mx-auto flex h-16 items-center justify-between px-4 sm:px-6`}>
          <div className="flex items-center gap-2">
            <Mascot mood="happy" size={42} />
            <div>
              <p className="font-display text-lg font-bold leading-tight">AI Physio Kids</p>
              <p className="text-xs leading-tight text-muted-foreground">สำหรับ{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm">
            <UserCircle className="h-4 w-4 text-[var(--kids-sky-deep)]" />
            <span className="hidden max-w-[180px] truncate sm:inline">{user.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 hover:text-red-600"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {tabs.length > 1 && (
        <nav className="sticky top-16 z-40 hidden border-b bg-[var(--kids-paper)]/80 backdrop-blur md:block">
          <div className={`${width} mx-auto flex gap-1 overflow-x-auto px-4 sm:px-6`}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onChange(t.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex min-h-12 shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive ? 'text-[var(--kids-sky-deep)]' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {!!t.badge && !isActive && (
                    <span className="rounded-full bg-[var(--kids-coral)] px-1.5 text-[10px] font-semibold text-white">{t.badge}</span>
                  )}
                  {isActive && (
                    <motion.div
                      layoutId="adult-tab-indicator"
                      className="absolute bottom-0 left-2 right-2 h-1 rounded-full bg-[var(--kids-sky)]"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <main className="flex-1">
        <div className={`${width} mx-auto px-4 py-6 pb-24 sm:px-6 md:pb-8`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {tabs.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="flex h-16 items-center justify-around">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = active === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onChange(t.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-full min-w-16 flex-col items-center justify-center gap-0.5 px-2 ${
                    isActive ? 'text-[var(--kids-sky-deep)]' : 'text-muted-foreground'
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />
                    {!!t.badge && !isActive && (
                      <span className="absolute -right-2 -top-1 rounded-full bg-[var(--kids-coral)] px-1 text-[9px] font-semibold text-white">{t.badge}</span>
                    )}
                  </span>
                  <span className="text-[11px] font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

/** Unread care-team messages for the messages tab badge (polls every 30 s) */
export function useUnreadMessages(refreshKey?: unknown) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch('/api/messages/threads')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && d && setUnread(d.totalUnread ?? 0))
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshKey]);
  return unread;
}
