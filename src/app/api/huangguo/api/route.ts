import { NextRequest, NextResponse } from 'next/server';

import { huangguoApi } from '@/lib/huangguo/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const int = (v: string | null, d: number, max = 1e9) => {
  const n = parseInt(v || '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : d;
};

export async function GET(req: NextRequest) {
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
      path = `/api/videos/${int(sp.get('id'), 0)}/play?ep=${int(sp.get('ep'), 1)}&page_texts=0`;
      break;
    default:
      return bad('未知操作');
  }
  try {
    const data = await huangguoApi(path);
    if (action === 'play') {
      const info = data as { video_url?: string };
      if (!info?.video_url) {
        return NextResponse.json(
          {
            ok: false,
            message: process.env.HUANGGUO_USERNAME
              ? '上游未返回播放地址，账号可能已失效'
              : '黄果播放需登录：请配置 HUANGGUO_USERNAME / HUANGGUO_PASSWORD',
          },
          { status: 502 }
        );
      }
    }
    return NextResponse.json({ ok: true, data }, {
      headers: { 'Cache-Control': action === 'play' ? 'no-store' : 'public, s-maxage=60' },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 502 });
  }
}

function bad(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}
