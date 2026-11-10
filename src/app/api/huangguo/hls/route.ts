import { NextRequest, NextResponse } from 'next/server';

import { absUrl, fetchUpstream, gateUnlockedRequest, rewriteM3u8 } from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await gateUnlockedRequest(req))) {
    return new NextResponse('need password', { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const u = absUrl(sp.get('u') || '');
  const auth = sp.get('h') || '';
  if (!/^https:\/\//i.test(u)) return new NextResponse('bad url', { status: 400 });
  const res = await fetchUpstream(u, auth).catch(() => null);
  if (!res || !res.ok) return new NextResponse('upstream error', { status: 502 });
  const ctype = res.headers.get('content-type') || '';
  const looksPlaylist = /mpegurl/i.test(ctype) || /\.m3u8(\?|$)/i.test(u);
  if (looksPlaylist) {
    const text = await res.text();
    if (text.trimStart().startsWith('#EXTM3U')) {
      return new NextResponse(rewriteM3u8(text, res.url || u, auth), {
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' },
      });
    }
    return new NextResponse(text, { headers: { 'Content-Type': ctype || 'application/octet-stream' } });
  }
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': ctype || 'video/mp2t',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
