import { NextRequest, NextResponse } from 'next/server';

import { hongguoPlay } from '@/lib/hongguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const episodeId = (req.nextUrl.searchParams.get('episode_id') || '').trim();
  if (!/^\d{1,30}$/.test(episodeId)) {
    return NextResponse.json({ ok: false, message: '缺少有效的 episode_id' }, { status: 400 });
  }
  try {
    const info = await hongguoPlay(episodeId);
    // 播放地址带签名会过期，不缓存
    return NextResponse.json(info, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: (err as Error).message || '取播放地址失败' },
      { status: 502 }
    );
  }
}
