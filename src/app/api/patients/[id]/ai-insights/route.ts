import { NextResponse } from 'next/server';
import { requireApiUser } from '@/lib/auth-guard';
import { canAccessPatient } from '@/lib/access';
import { notFound, serverError } from '@/lib/api-utils';
import { analyzePatientTrends } from '@/lib/ai-agent';
import { predictPatient } from '@/lib/predictive';

type Params = { params: Promise<{ id: string }> };

// Computed fault/accuracy/ROM trends, recovery forecasts (individual + population
// model) and the early-warning risk score — no AI call. Care team only.
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiUser(['CLINICIAN']);
  if ('response' in auth) return auth.response;
  const { id } = await params;
  try {
    if (!(await canAccessPatient(auth.user, id))) return notFound('Patient not found');
    const p = await predictPatient(id);
    if (!p) return notFound('Patient not found');
    return NextResponse.json(p);
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
