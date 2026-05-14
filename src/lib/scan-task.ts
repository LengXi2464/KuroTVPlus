/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

/**
 * 后台扫描任务管理
 */

export interface ScanTask {
  id: string;
  status: 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    currentFolder?: string;
  };
  result?: {
    total: number;
    new: number;
    existing: number;
    errors: number;
  };
  error?: string;
  startTime: number;
  endTime?: number;
}

const tasks = new Map<string, ScanTask>();

export function createScanTask(): string {
  const id = `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const task: ScanTask = {
    id,
    status: 'running',
    progress: {
      current: 0,
      total: 0,
    },
    startTime: Date.now(),
  };
  tasks.set(id, task);
  return id;
}

export function getScanTask(id: string): ScanTask | null {
  return tasks.get(id) || null;
}

export function updateScanTaskProgress(
  id: string,
  current: number,
  total: number,
  currentFolder?: string
): void {
  let task = tasks.get(id);
  if (!task) {
    // 如果任务不存在（可能因为模块重新加载），重新创建任务
    console.warn(`[ScanTask] 任务 ${id} 不存在，重新创建`);
    task = {
      id,
      status: 'running',
      progress: {
        current: 0,
        total: 0,
      },
      startTime: Date.now(),
    };
    tasks.set(id, task);
  }
  task.progress = { current, total, currentFolder };
}

export function completeScanTask(
  id: string,
  result: ScanTask['result']
): void {
  let task = tasks.get(id);
  if (!task) {
    // 如果任务不存在（可能因为模块重新加载），重新创建任务
    console.warn(`[ScanTask] 任务 ${id} 不存在，重新创建并标记为完成`);
    task = {
      id,
      status: 'completed',
      progress: {
        current: result?.total || 0,
        total: result?.total || 0,
      },
      startTime: Date.now() - 60000, // 假设任务运行�?分钟
      endTime: Date.now(),
      result,
    };
    tasks.set(id, task);
    return;
  }
  task.status = 'completed';
  task.result = result;
  task.endTime = Date.now();
}

export function failScanTask(id: string, error: string): void {
  let task = tasks.get(id);
  if (!task) {
    // 如果任务不存在（可能因为模块重新加载），重新创建任务
    console.warn(`[ScanTask] 任务 ${id} 不存在，重新创建并标记为失败`);
    task = {
      id,
      status: 'failed',
      progress: {
        current: 0,
        total: 0,
      },
      startTime: Date.now() - 60000, // 假设任务运行�?分钟
      endTime: Date.now(),
      error,
    };
    tasks.set(id, task);
    return;
  }
  task.status = 'failed';
  task.error = error;
  task.endTime = Date.now();
}

export function cleanupOldTasks(): void {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1小时

  for (const [id, task] of Array.from(tasks.entries())) {
    if (task.endTime && now - task.endTime > maxAge) {
      tasks.delete(id);
    }
  }
}
