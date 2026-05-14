/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { requireFeaturePermission } from '@/lib/permissions';
import { getScanTask } from '@/lib/scan-task';

export const runtime = 'nodejs';

/**
 * GET /api/openlist/scan-progress?taskId=xxx
 * 获取扫描任务进度
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireFeaturePermission(request, 'private_library', '无权限访问私人影�?);
    if (authResult instanceof NextResponse) return authResult;
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: '未授�? }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId' }, { status: 400 });
    }

    const task = getScanTask(taskId);

    if (!task) {
      return NextResponse.json({ error: '任务不存�? }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      task,
    });
  } catch (error) {
    console.error('获取扫描进度失败:', error);
    return NextResponse.json(
      { error: '获取失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
