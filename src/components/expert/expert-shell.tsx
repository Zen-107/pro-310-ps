'use client';

import { LayoutDashboard, FileText, MessageCircle, Users, School } from 'lucide-react';
import { useAppStore, type DoctorTab } from '@/lib/store';
import type { SessionUser } from '@/lib/auth-guard';
import { AdultShell, useUnreadMessages, type AdultTab } from '@/components/adult/adult-shell';
import { DoctorOverview } from '@/components/physio/doctor-overview';
import { DoctorPatients } from '@/components/physio/doctor-patients';
import { DoctorReports } from '@/components/physio/doctor-reports';
import { DoctorMessages } from '@/components/physio/doctor-messages';
import { ClassesView } from '@/components/teacher/classes-view';

// Expert (physio, role CLINICIAN): overview and review queue, children and
// their trends, classes (read-only), session reports and messages. Mission
// sets are created by teachers, so there is no plans tab here.

type ExpertTab = Extract<DoctorTab, 'overview' | 'patients' | 'reports' | 'messages'> | 'plans';

export function ExpertShell({ user }: { user: SessionUser }) {
  const { activeTab, setActiveTab, setSelectedPatientId } = useAppStore();
  const unread = useUnreadMessages(activeTab);

  // 'plans' is reused as the id of the read-only classes tab
  const tabs: AdultTab<ExpertTab>[] = [
    { id: 'overview', label: 'ภาพรวม', icon: LayoutDashboard },
    { id: 'patients', label: 'เด็ก', icon: Users },
    { id: 'plans', label: 'ห้องเรียน', icon: School },
    { id: 'reports', label: 'รายงาน', icon: FileText },
    { id: 'messages', label: 'ข้อความ', icon: MessageCircle, badge: unread },
  ];
  const tab: ExpertTab = tabs.some((t) => t.id === activeTab) ? (activeTab as ExpertTab) : 'overview';

  return (
    <AdultShell user={user} tabs={tabs} active={tab} onChange={setActiveTab} wide>
      {tab === 'overview' && (
        <DoctorOverview
          onSelectPatient={(id) => {
            setSelectedPatientId(id);
            setActiveTab('patients');
          }}
        />
      )}
      {tab === 'patients' && <DoctorPatients />}
      {tab === 'plans' && <ClassesView readOnly />}
      {tab === 'reports' && <DoctorReports />}
      {tab === 'messages' && <DoctorMessages />}
    </AdultShell>
  );
}
