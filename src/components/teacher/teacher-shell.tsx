'use client';

import { BookOpen, MessageCircle, School, UserCog } from 'lucide-react';
import { useAppStore, type TeacherTab } from '@/lib/store';
import type { SessionUser } from '@/lib/auth-guard';
import { AdultShell, useUnreadMessages, type AdultTab } from '@/components/adult/adult-shell';
import { AccountSettings } from '@/components/adult/account-settings';
import { DoctorMessages } from '@/components/physio/doctor-messages';
import { ClassesView } from '@/components/teacher/classes-view';
import { ExerciseLibrary } from '@/components/teacher/exercise-library';

// Teacher: classes (today, missions, students, play mode), the library,
// messages with parents and the expert, account (PIN).
export function TeacherShell({ user }: { user: SessionUser }) {
  const { activeTab, setActiveTab } = useAppStore();
  const unread = useUnreadMessages(activeTab);

  const tabs: AdultTab<TeacherTab>[] = [
    { id: 'classes', label: 'ห้องเรียน', icon: School },
    { id: 'library', label: 'คลังท่า', icon: BookOpen },
    { id: 'messages', label: 'ข้อความ', icon: MessageCircle, badge: unread },
    { id: 'account', label: 'บัญชี', icon: UserCog },
  ];
  const tab: TeacherTab = tabs.some((t) => t.id === activeTab) ? (activeTab as TeacherTab) : 'classes';

  return (
    <AdultShell user={user} tabs={tabs} active={tab} onChange={setActiveTab}>
      {tab === 'classes' && <ClassesView />}
      {tab === 'library' && <ExerciseLibrary />}
      {tab === 'messages' && <DoctorMessages />}
      {tab === 'account' && <AccountSettings user={user} />}
    </AdultShell>
  );
}
