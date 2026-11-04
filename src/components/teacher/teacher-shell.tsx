'use client';

import { BookOpen, School, UserCog } from 'lucide-react';
import { useAppStore, type TeacherTab } from '@/lib/store';
import type { SessionUser } from '@/lib/auth-guard';
import { AdultShell, type AdultTab } from '@/components/adult/adult-shell';
import { AccountSettings } from '@/components/adult/account-settings';
import { ClassesView } from '@/components/teacher/classes-view';
import { ExerciseLibrary } from '@/components/teacher/exercise-library';

// Teacher: classes (today, missions, students, play mode), the library and
// account (PIN). Chat is between the expert and parents only.
export function TeacherShell({ user }: { user: SessionUser }) {
  const { activeTab, setActiveTab } = useAppStore();

  const tabs: AdultTab<TeacherTab>[] = [
    { id: 'classes', label: 'ห้องเรียน', icon: School },
    { id: 'library', label: 'คลังท่า', icon: BookOpen },
    { id: 'account', label: 'บัญชี', icon: UserCog },
  ];
  const tab: TeacherTab = tabs.some((t) => t.id === activeTab) ? (activeTab as TeacherTab) : 'classes';

  return (
    <AdultShell user={user} tabs={tabs} active={tab} onChange={setActiveTab}>
      {tab === 'classes' && <ClassesView />}
      {tab === 'library' && <ExerciseLibrary />}
      {tab === 'account' && <AccountSettings user={user} />}
    </AdultShell>
  );
}
