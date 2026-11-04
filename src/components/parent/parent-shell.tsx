'use client';

import { Heart, MessageCircle, UserCog } from 'lucide-react';
import { useAppStore, type ParentTab } from '@/lib/store';
import type { SessionUser } from '@/lib/auth-guard';
import { AdultShell, useUnreadMessages, type AdultTab } from '@/components/adult/adult-shell';
import { AccountSettings } from '@/components/adult/account-settings';
import { CareMessages } from '@/components/adult/care-messages';
import { ChildrenView } from '@/components/parent/children-view';

// Parent: my children (consent, progress, play at home), messages with the
// expert, account (PIN for leaving kid mode).
export function ParentShell({ user }: { user: SessionUser }) {
  const { activeTab, setActiveTab } = useAppStore();
  const unread = useUnreadMessages(activeTab);

  const tabs: AdultTab<ParentTab>[] = [
    { id: 'children', label: 'ลูกของฉัน', icon: Heart },
    { id: 'messages', label: 'ข้อความ', icon: MessageCircle, badge: unread },
    { id: 'account', label: 'บัญชี', icon: UserCog },
  ];
  const tab: ParentTab = tabs.some((t) => t.id === activeTab) ? (activeTab as ParentTab) : 'children';

  return (
    <AdultShell user={user} tabs={tabs} active={tab} onChange={setActiveTab}>
      {tab === 'children' && <ChildrenView />}
      {tab === 'messages' && <CareMessages viewer="PARENT" />}
      {tab === 'account' && <AccountSettings user={user} />}
    </AdultShell>
  );
}
