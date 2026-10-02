import { redirect } from 'next/navigation';
import { getSessionUser, userAcceptedTerms } from '@/lib/auth-guard';
import { AppShell } from '@/components/app-shell';
import { TermsGate } from '@/components/terms-gate';
import { termsFor, TERMS_VERSION } from '@/lib/terms';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // Blocking consent popup: nothing else renders until the terms are accepted
  if (!(await userAcceptedTerms(user.id))) {
    return <TermsGate userName={user.name} sections={termsFor(user.role)} version={TERMS_VERSION} />;
  }
  return <AppShell user={user} />;
}
