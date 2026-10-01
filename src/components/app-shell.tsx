'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { useAppStore, type ActiveTab, type DoctorTab, type PatientTab } from '@/lib/store';
import type { SessionUser } from '@/lib/auth-guard';
import { DashboardView } from '@/components/physio/dashboard-view';
import { ExercisesView } from '@/components/physio/exercises-view';
import { LiveSessionView } from '@/components/physio/live-session-view';
import { HistoryView } from '@/components/physio/history-view';
import { DoctorOverview } from '@/components/physio/doctor-overview';
import { DoctorPatients } from '@/components/physio/doctor-patients';
import { DoctorReports } from '@/components/physio/doctor-reports';
import { DoctorPlans } from '@/components/physio/doctor-plans';
import {
  LayoutDashboard, Dumbbell, Camera, History, Activity,
  Stethoscope, Users, FileText, ClipboardList, LogOut, UserCircle, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const patientTabs: { id: PatientTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'หน้าหลัก', icon: LayoutDashboard },
  { id: 'exercises', label: 'ท่ากายภาพ', icon: Dumbbell },
  { id: 'camera', label: 'เริ่มฝึก', icon: Camera },
  { id: 'history', label: 'ประวัติ', icon: History },
];

const doctorTabs: { id: DoctorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'patients', label: 'ผู้ป่วย', icon: Users },
  { id: 'reports', label: 'รายงาน', icon: FileText },
  { id: 'plans', label: 'แผนรักษา', icon: ClipboardList },
];

const handleSignOut = () => signOut({ callbackUrl: '/login' });

export function AppShell({ user }: { user: SessionUser }) {
  const { activeTab, setActiveTab, isSessionActive, setCurrentPatientId, setSelectedPatientId } = useAppStore();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const isDoctor = user.role === 'CLINICIAN';
  const currentTabs = isDoctor ? doctorTabs : patientTabs;
  // Fall back to the role's first tab if the store holds a tab from the other role
  const tab: ActiveTab = currentTabs.some((t) => t.id === activeTab) ? activeTab : currentTabs[0].id;

  // The patient identity comes from the login, not from a picker
  useEffect(() => {
    setCurrentPatientId(user.patientId);
  }, [user.patientId, setCurrentPatientId]);

  useEffect(() => {
    if (isSessionActive && activeTab !== 'camera') {
      setActiveTab('camera');
    }
  }, [isSessionActive, activeTab, setActiveTab]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Activity className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Admin accounts have no screens yet
  if (user.role === 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm space-y-4">
          <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">
            บัญชีผู้ดูแลระบบยังไม่มีหน้าจัดการ กรุณาเข้าสู่ระบบด้วยบัญชีแพทย์/นักกายภาพ หรือผู้ป่วย
          </p>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </Button>
        </div>
      </div>
    );
  }

  // Full-screen camera mode
  if (!isDoctor && tab === 'camera') {
    return <LiveSessionView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDoctor ? 'bg-slate-700' : 'bg-emerald-600'}`}>
              {isDoctor ? <Stethoscope className="h-4.5 w-4.5 text-white" /> : <Activity className="h-4.5 w-4.5 text-white" />}
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">
                {isDoctor ? 'AI Physio — Dashboard' : 'AI Physio'}
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {isDoctor ? 'แผงควบคุมแพทย์/นักกายภาพ' : 'กายภาพบำบัดอัจฉริยะ'}
              </p>
            </div>
          </div>
          <UserChip name={user.name} isDoctor={isDoctor} />
        </div>
      </header>

      {/* Desktop Tab Navigation */}
      <nav className="hidden md:block border-b bg-background/60 backdrop-blur-sm sticky top-14 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            {currentTabs.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? isDoctor
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-emerald-700 dark:text-emerald-400'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {isActive && (
                    <motion.div
                      layoutId="desktop-tab-indicator"
                      className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${isDoctor ? 'bg-slate-600' : 'bg-emerald-600'}`}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${user.role}-${tab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Patient Views */}
              {!isDoctor && tab === 'dashboard' && (
                <DashboardView onStartSession={() => setActiveTab('camera')} />
              )}
              {!isDoctor && tab === 'exercises' && <ExercisesView />}
              {!isDoctor && tab === 'history' && <HistoryView />}

              {/* Clinician Views */}
              {isDoctor && tab === 'overview' && (
                <DoctorOverview onSelectPatient={(id) => { setSelectedPatientId(id); setActiveTab('patients'); }} />
              )}
              {isDoctor && tab === 'patients' && <DoctorPatients />}
              {isDoctor && tab === 'reports' && <DoctorReports />}
              {isDoctor && tab === 'plans' && <DoctorPlans />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg safe-area-bottom">
        <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
          {currentTabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const isCamera = !isDoctor && t.id === 'camera';

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors ${
                  isActive ? (isCamera ? 'text-white' : isDoctor ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-700 dark:text-emerald-400') : 'text-muted-foreground'
                }`}
              >
                {isCamera ? (
                  <div className={`w-12 h-12 -mt-5 rounded-full flex items-center justify-center shadow-lg transition-all ${isActive ? 'bg-emerald-600 shadow-emerald-600/30 scale-110' : 'bg-emerald-500/80 shadow-emerald-500/20'}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <>
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{t.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="mobile-tab-indicator"
                        className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full ${isDoctor ? 'bg-slate-600' : 'bg-emerald-600'}`}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="md:hidden h-16" />
    </div>
  );
}

// Signed-in user's name + sign-out (name hidden on small screens)
function UserChip({ name, isDoctor }: { name: string; isDoctor: boolean }) {
  const tone = isDoctor
    ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400';
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${tone}`}>
      <UserCircle className="h-3.5 w-3.5" />
      <span className="hidden sm:inline text-xs font-medium max-w-[160px] truncate">{name}</span>
      <button
        onClick={handleSignOut}
        className="ml-1 hover:text-red-500 transition-colors"
        title="ออกจากระบบ"
        aria-label="ออกจากระบบ"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
