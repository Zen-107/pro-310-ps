'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, type ActiveTab, type DoctorTab, type PatientTab } from '@/lib/store';
import { DashboardView } from '@/components/physio/dashboard-view';
import { ExercisesView } from '@/components/physio/exercises-view';
import { LiveSessionView } from '@/components/physio/live-session-view';
import { HistoryView } from '@/components/physio/history-view';
import { DoctorOverview } from '@/components/physio/doctor-overview';
import { DoctorPatients } from '@/components/physio/doctor-patients';
import { DoctorReports } from '@/components/physio/doctor-reports';
import { DoctorPlans } from '@/components/physio/doctor-plans';
import { PatientSelector } from '@/components/physio/patient-selector';
import {
  LayoutDashboard, Dumbbell, Camera, History, Activity,
  Stethoscope, Users, FileText, ClipboardList, LogOut, UserCircle,
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

export default function Home() {
  const {
    role, setRole, activeTab, setActiveTab, isSessionActive,
    currentPatientId, setCurrentPatientId, setSelectedPatientId,
  } = useAppStore();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    fetch('/api/seed', { method: 'POST' });
  }, []);

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

  // Full-screen camera mode
  if (activeTab === 'camera') {
    return <LiveSessionView />;
  }

  const isDoctor = role === 'doctor';
  const showPatientSelector = !isDoctor && !currentPatientId;
  const currentTabs = isDoctor ? doctorTabs : patientTabs;

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
                {isDoctor ? 'แผงควบคุมหมอผู้ดูแล' : 'กายภาพบำบัดอัจฉริยะ'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Patient identity: show name + logout */}
            {!isDoctor && currentPatientId && (
              <PatientIdentityChip />
            )}
            {/* Role Switcher */}
            <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setRole('patient')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  !isDoctor ? 'bg-background shadow-sm text-emerald-700' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Activity className="h-3.5 w-3.5" /> คนไข้
              </button>
              <button
                onClick={() => setRole('doctor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isDoctor ? 'bg-background shadow-sm text-slate-700' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Stethoscope className="h-3.5 w-3.5" /> หมอ
              </button>
            </div>
            <div className="sm:hidden">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Role Switcher (below header) */}
      <div className="sm:hidden border-b bg-background/60">
        <div className="flex">
          <button
            onClick={() => setRole('patient')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              !isDoctor ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-muted-foreground'
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> ฝั่งคนไข้
          </button>
          <button
            onClick={() => setRole('doctor')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all border-b-2 ${
              isDoctor ? 'border-slate-600 text-slate-700' : 'border-transparent text-muted-foreground'
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5" /> ฝั่งหมอ
          </button>
        </div>
      </div>

      {/* Desktop Tab Navigation (hide when patient selector shown) */}
      {!showPatientSelector && (
        <nav className="hidden md:block border-b bg-background/60 backdrop-blur-sm sticky top-14 z-40">
          <div className="max-w-5xl mx-auto px-4">
            <div className="flex gap-1">
              {currentTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? isDoctor
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-emerald-700 dark:text-emerald-400'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
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
      )}

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {/* Patient Identity Selector */}
            {showPatientSelector ? (
              <motion.div
                key="patient-selector"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="min-h-[60vh] flex flex-col items-center justify-center"
              >
                <PatientSelector />
              </motion.div>
            ) : (
              <motion.div
                key={`${role}-${activeTab}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Patient Views */}
                {!isDoctor && activeTab === 'dashboard' && (
                  <DashboardView onStartSession={() => setActiveTab('camera')} />
                )}
                {!isDoctor && activeTab === 'exercises' && <ExercisesView />}
                {!isDoctor && activeTab === 'history' && <HistoryView />}

                {/* Doctor Views */}
                {isDoctor && activeTab === 'overview' && (
                  <DoctorOverview onSelectPatient={(id) => { setSelectedPatientId(id); setActiveTab('patients'); }} />
                )}
                {isDoctor && activeTab === 'patients' && <DoctorPatients />}
                {isDoctor && activeTab === 'reports' && <DoctorReports />}
                {isDoctor && activeTab === 'plans' && <DoctorPlans />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation (hide when patient selector shown) */}
      {!showPatientSelector && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg safe-area-bottom">
          <div className="flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)]">
            {currentTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const isCamera = !isDoctor && tab.id === 'camera';

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                      <span className="text-[10px] font-medium">{tab.label}</span>
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
      )}

      {!showPatientSelector && <div className="md:hidden h-16" />}
    </div>
  );
}

// Small chip showing current patient name + logout
function PatientIdentityChip() {
  const { currentPatientId, setCurrentPatientId, setActiveTab } = useAppStore();
  const [name, setName] = useState('');

  useEffect(() => {
    if (currentPatientId) {
      fetch(`/api/patients/${currentPatientId}`)
        .then(r => r.json())
        .then(d => setName(d.patient?.name || ''))
        .catch(() => {});
    }
  }, [currentPatientId]);

  return (
    <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-2.5 py-1.5">
      <UserCircle className="h-3.5 w-3.5 text-emerald-600" />
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 max-w-[120px] truncate">{name}</span>
      <button
        onClick={() => { setCurrentPatientId(null); setActiveTab('dashboard'); }}
        className="text-emerald-600 hover:text-red-500 transition-colors"
        title="ออกจากระบบ"
      >
        <LogOut className="h-3 w-3" />
      </button>
    </div>
  );
}