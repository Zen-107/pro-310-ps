import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guard';
import { LoginForm } from '@/components/auth/login-form';

// Only allow same-site relative paths, to prevent open redirects
function safeCallbackUrl(value: string | string[] | undefined): string {
  const url = Array.isArray(value) ? value[0] : value;
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackUrl(params.callbackUrl);

  if (await getSessionUser()) redirect(callbackUrl);

  return <LoginForm callbackUrl={callbackUrl} showDemoAccounts={process.env.NODE_ENV !== 'production'} />;
}
