import { redirect } from 'next/navigation';
import { getSessionUser, userAcceptedTerms } from '@/lib/auth-guard';
import { AppShell } from '@/components/app-shell';
import { TermsGate } from '@/components/terms-gate';
import { KidWaitingConsent } from '@/components/kids/kid-waiting-consent';
import { termsFor, TERMS_VERSION } from '@/lib/terms';

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  // Blocking consent: nothing else renders until it is in place. Adults accept
  // the terms themselves; a child waits for a parent's (or the school's) consent.
  if (!(await userAcceptedTerms(user.id))) {
    if (user.role === 'PATIENT') return <KidWaitingConsent name={user.name} />;
    return <TermsGate userName={user.name} sections={termsFor(user.role)} version={TERMS_VERSION} />;
  }
  return <AppShell user={user} />;
}
