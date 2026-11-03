'use client';

import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';

/**
 * Hand the device to a child ("play as …"): gets a one-time ticket and signs
 * in as the child. Leaving kid mode later needs this adult's PIN.
 * Returns false (with a toast) when the PIN or the child's consent is missing.
 */
export async function playAsChild(patientId: string, router: { refresh: () => void }, onNeedPin?: () => void): Promise<boolean> {
  const res = await fetch('/api/me/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body?.code === 'PIN_REQUIRED') {
      toast.info('ตั้ง PIN 4 หลักก่อน เพื่อใช้ออกจากโหมดเด็ก');
      onNeedPin?.();
    } else if (body?.code === 'CONSENT_REQUIRED') {
      toast.error('เด็กคนนี้ยังไม่มีความยินยอมจากผู้ปกครอง');
    } else {
      toast.error('เปลี่ยนเป็นโหมดเด็กไม่สำเร็จ');
    }
    return false;
  }
  const login = await signIn('ticket', { ticket: body.ticket, redirect: false });
  if (!login || login.error) {
    toast.error('เปลี่ยนเป็นโหมดเด็กไม่สำเร็จ');
    return false;
  }
  // The home page re-renders with the child's session (kid screens)
  useAppStore.getState().setActiveTab('dashboard');
  router.refresh();
  return true;
}
