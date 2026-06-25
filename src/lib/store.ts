import { create } from 'zustand';

export type UserRole = 'patient' | 'doctor';

export type PatientTab = 'dashboard' | 'exercises' | 'camera' | 'history';
export type DoctorTab = 'overview' | 'patients' | 'reports' | 'plans';

export type ActiveTab = PatientTab | DoctorTab;

interface AppState {
  // Role
  role: UserRole;
  setRole: (role: UserRole) => void;

  // Navigation
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Patient tab navigation
  patientTab: PatientTab;
  setPatientTab: (tab: PatientTab) => void;

  // Doctor tab navigation
  doctorTab: DoctorTab;
  setDoctorTab: (tab: DoctorTab) => void;

  // Doctor: selected patient for detail view
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;

  // Patient side: which patient identity am I?
  currentPatientId: string | null;
  setCurrentPatientId: (id: string | null) => void;

  // Exercise selection
  selectedExerciseId: string | null;
  setSelectedExerciseId: (id: string | null) => void;

  // Session state
  isSessionActive: boolean;
  setIsSessionActive: (active: boolean) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;

  // Live session data
  liveAngles: Record<string, number>;
  setLiveAngle: (joint: string, angle: number) => void;
  clearLiveAngles: () => void;
  currentRep: number;
  setCurrentRep: (rep: number) => void;
  currentSet: number;
  setCurrentSet: (set: number) => void;
  sessionAccuracy: number[];
  addAccuracy: (value: number) => void;
  clearSessionData: () => void;

  // AI feedback
  aiFeedback: string;
  setAiFeedback: (feedback: string) => void;

  // Skeleton
  skeletonLandmarks: Array<{ x: number; y: number; z: number }>;
  setSkeletonLandmarks: (landmarks: Array<{ x: number; y: number; z: number }>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  role: 'patient',
  setRole: (role) => {
    set({ role, selectedPatientId: null });
    if (role === 'patient') set({ activeTab: 'dashboard' });
    else set({ activeTab: 'overview' });
  },

  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),

  patientTab: 'dashboard',
  setPatientTab: (tab) => set({ patientTab: tab, activeTab: tab }),

  doctorTab: 'overview',
  setDoctorTab: (tab) => set({ doctorTab: tab, activeTab: tab }),

  selectedPatientId: null,
  setSelectedPatientId: (id) => set({ selectedPatientId: id }),

  currentPatientId: null,
  setCurrentPatientId: (id) => set({ currentPatientId: id }),

  selectedExerciseId: null,
  setSelectedExerciseId: (id) => set({ selectedExerciseId: id }),

  isSessionActive: false,
  setIsSessionActive: (active) => set({ isSessionActive: active }),
  currentSessionId: null,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),

  liveAngles: {},
  setLiveAngle: (joint, angle) =>
    set((state) => ({ liveAngles: { ...state.liveAngles, [joint]: angle } })),
  clearLiveAngles: () => set({ liveAngles: {} }),

  currentRep: 0,
  setCurrentRep: (rep) => set({ currentRep: rep }),
  currentSet: 1,
  setCurrentSet: (setNum) => set({ currentSet: setNum }),
  sessionAccuracy: [],
  addAccuracy: (value) =>
    set((state) => ({ sessionAccuracy: [...state.sessionAccuracy, value] })),
  clearSessionData: () =>
    set({
      currentRep: 0,
      currentSet: 1,
      sessionAccuracy: [],
      liveAngles: {},
      aiFeedback: '',
      skeletonLandmarks: [],
    }),

  aiFeedback: '',
  setAiFeedback: (feedback) => set({ aiFeedback: feedback }),

  skeletonLandmarks: [],
  setSkeletonLandmarks: (landmarks) => set({ skeletonLandmarks: landmarks }),
}));