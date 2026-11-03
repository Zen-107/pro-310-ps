import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth-guard';
import { ParentRegisterForm } from '@/components/auth/parent-register-form';

// Parent sign-up with the link code from the teacher's card
export default async function RegisterPage() {
  if (await getSessionUser()) redirect('/');
  return <ParentRegisterForm />;
}
