import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { notFound, serverError } from '@/lib/api-utils';
import { analyzePatientTrends, computeFaultTrends, computeRecoveryForecasts } from '@/lib/ai-agent';

type Params = { params: Promise<{ id: string }> };

// Computed fault/accuracy/ROM trends + recovery forecasts (no AI call), care team
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    if (!(await canAccessPatient(auth.user, id))) return notFound('Patient not found');
    const [{ trends, sessions }, forecasts] = await Promise.all([computeFaultTrends(id), computeRecoveryForecasts(id)]);
    return NextResponse.json({ patientId: id, sessionsAnalysed: sessions, trends, forecasts });
  } catch (error) {
    return serverError('AI insights GET error', error);
  }
}

// Trends + AI clinical summary and recommendations (analyst agent), care team.
// If the AI service fails, the computed trends are still returned with aiError.
export async function POST(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    if (!(await canAccessPatient(auth.user, id))) return notFound('Patient not found');
    return NextResponse.json(await analyzePatientTrends(id));
  } catch (error) {
    return serverError('AI insights POST error', error);
  }
}
