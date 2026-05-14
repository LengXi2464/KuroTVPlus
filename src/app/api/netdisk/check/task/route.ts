import { NextRequest, NextResponse } from 'next/server';

import { getNetdiskCheckCooldownRemainingMs, getNetdiskCheckTask } from '@/lib/netdisk-check-task';
import { requireFeaturePermission } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(
      request,
      'netdisk_search',
      '无权限使用网盘有效性检�?
    );
    if (authResult instanceof NextResponse) return authResult;

    const taskId = request.nextUrl.searchParams.get('id') || '';
    if (!taskId) {
      return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
    }
    const task = getNetdiskCheckTask(taskId);
    if (!task) {
      return NextResponse.json({ error: '任务不存�? }, { status: 404 });
    }
    return NextResponse.json({
      task,
      cooldownRemainingMs: getNetdiskCheckCooldownRemainingMs(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取检测任务失�? },
      { status: 500 }
    );
  }
}
