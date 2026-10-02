import { NextResponse, type NextRequest } from 'next/server';
import { requireApiUser } from '@/lib/auth-guard';
import { allowTts, MAX_TTS_TEXT, synthesizeThai, ttsEnabled } from '@/lib/tts-server';
import { sanitizeText } from '@/lib/text-safe';

// Thai speech for the live coach: GET /api/tts?text=… → audio/mpeg.
// GET (not POST) so the browser can cache repeated cues.
export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if ('response' in auth) return auth.response;
  if (!ttsEnabled()) return NextResponse.json({ error: 'Server TTS disabled' }, { status: 503 });

  const text = sanitizeText(request.nextUrl.searchParams.get('text') ?? '').trim();
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  if (text.length > MAX_TTS_TEXT) return NextResponse.json({ error: `text over ${MAX_TTS_TEXT} characters` }, { status: 400 });
  if (!allowTts(auth.user.id)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const audio = await synthesizeThai(text);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.length),
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    console.error('TTS error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Speech synthesis unavailable' }, { status: 502 });
  }
}
