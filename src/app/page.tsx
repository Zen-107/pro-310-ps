import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guard';
import { AppShell } from '@/components/app-shell';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return <AppShell user={user} />;
}
