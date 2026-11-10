import { NextRequest, NextResponse } from 'next/server';

import { huangguoApi, huangguoPlayback, gateUnlockedRequest } from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const int = (v: string | null, d: number, max = 1e9) => {
  const n = parseInt(v || '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d;
};

export async function GET(req: NextRequest) {
  if (!(await gateUnlockedRequest(req))) {
    return NextResponse.json({ ok: false, message: '需要访问密码' }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const action = sp.get('action');
  const page = int(sp.get('page'), 1, 10000);
  const size = int(sp.get('size'), 20, 50);
  let path = '';
  switch (action) {
    case 'feed':
      path = `/api/videos?page=${page}&size=${size}`;
      break;
    case 'category': {
      const cate = sp.get('cate') || '';
      if (!/^[a-z0-9-]{1,40}$/.test(cate)) return bad('分类无效');
      path = `/api/videos/category/${cate}?page=${page}&size=${size}`;
      break;
    }
    case 'rank': {
      const type = sp.get('type') || 'hot';
      if (!['hot', 'recommend', 'potential'].includes(type)) return bad('榜单无效');
      path = `/api/ranks/${type}`;
      break;
    }
    case 'search': {
      const q = (sp.get('q') || '').trim().slice(0, 60);
      if (!q) return bad('缺少关键词');
      path = `/api/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`;
      break;
    }
    case 'detail':
      path = `/api/videos/${int(sp.get('id'), 0)}`;
      break;
    case 'play':
      break;
    default:
      return bad('未知操作');
  }
  if (action === 'play') {
    try {
      const info = await huangguoPlayback(int(sp.get('id'), 0), int(sp.get('ep'), 1));
      return NextResponse.json({ ok: true, data: info }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 502 });
    }
  }
  try {
    const data = await huangguoApi(path);
    return NextResponse.json({ ok: true, data }, {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 502 });
  }
}

function bad(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}
