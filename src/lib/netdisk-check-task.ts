import { nanoid } from 'nanoid';

import { checkNetdiskLink } from '@/lib/pancheck';
import type {
  NetdiskCheckPlatform,
  NetdiskCheckResult,
  NetdiskCheckStartInput,
  NetdiskCheckTask,
  NetdiskCheckTaskResultItem,
} from '@/lib/pancheck/types';

const NETDISK_CHECK_RULE = {
  batchSize: 3,
  batchIntervalMs: 2000,
  requestTimeoutMs: 12000,
  maxTaskLinks: 60,
  cooldownMs: 60000,
  taskRetentionMs: 60 * 60 * 1000,
  maxActiveTasks: 5,
} as const;

const tasks = new Map<string, NetdiskCheckTask>();
const activeTaskIds = new Set<string>();
let cooldownUntil = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`执行超时(${timeoutMs}ms)`)), timeoutMs);
    }),
  ]);
}

function cleanupOldTasks() {
  const now = Date.now();
  for (const [id, task] of Array.from(tasks.entries())) {
    if (now - task.updatedAt > NETDISK_CHECK_RULE.taskRetentionMs) {
      tasks.delete(id);
    }
  }
}

function cloneTask(task: NetdiskCheckTask): NetdiskCheckTask {
  return JSON.parse(JSON.stringify(task)) as NetdiskCheckTask;
}

function createTaskResultItem(status: NetdiskCheckTaskResultItem['status']): NetdiskCheckTaskResultItem {
  return { status };
}

function countBatchSize(total: number) {
  return Math.max(1, Math.ceil(total / NETDISK_CHECK_RULE.batchSize));
}

function updateTaskAfterResult(task: NetdiskCheckTask, url: string, result: NetdiskCheckResult) {
  task.results[url] = {
    status: result.status,
    reason: result.reason,
    fromCache: result.fromCache,
    checkedAt: result.checkedAt,
    durationMs: result.durationMs,
  };
  task.progress.done += 1;
  if (result.status === 'valid') task.progress.valid += 1;
  else if (result.status === 'invalid') task.progress.invalid += 1;
  else if (result.status === 'rate_limited') task.progress.rateLimited += 1;
  else task.progress.unknown += 1;
  task.updatedAt = Date.now();
}

async function runTask(taskId: string, links: string[]) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    const pendingLinks = links.slice(0, NETDISK_CHECK_RULE.maxTaskLinks);
    let batchIndex = 0;

    while (pendingLinks.length > 0) {
      if (task.shouldStop) {
        task.status = 'cancelled';
        task.updatedAt = Date.now();
        return;
      }

      if (Date.now() < cooldownUntil) {
        task.status = 'failed';
        task.error = '检测功能冷却中，请稍后再试';
        task.updatedAt = Date.now();
        return;
      }

      batchIndex += 1;
      task.progress.currentBatch = batchIndex;
      task.updatedAt = Date.now();

      const batch = pendingLinks.splice(0, NETDISK_CHECK_RULE.batchSize);
      batch.forEach((url) => {
        task.results[url] = createTaskResultItem('checking');
      });

      const batchResults = await Promise.all(
        batch.map(async (url) => {
          try {
            return await withTimeout(checkNetdiskLink(task.platform, url), NETDISK_CHECK_RULE.requestTimeoutMs);
          } catch (error) {
            const reason = error instanceof Error ? error.message : '检测失�?;
            return {
              platform: task.platform,
              url,
              normalizedUrl: url,
              status: 'unknown',
              valid: null,
              reason,
              checkedAt: Date.now(),
              durationMs: NETDISK_CHECK_RULE.requestTimeoutMs,
            } satisfies NetdiskCheckResult;
          }
        })
      );

      let hasRateLimited = false;
      batchResults.forEach((result) => {
        updateTaskAfterResult(task, result.url, result);
        if (result.status === 'rate_limited') {
          hasRateLimited = true;
        }
      });

      if (hasRateLimited) {
        cooldownUntil = Date.now() + NETDISK_CHECK_RULE.cooldownMs;
        task.status = 'failed';
        task.error = '触发网盘平台限流，请稍后重试';
        task.updatedAt = Date.now();
        return;
      }

      if (pendingLinks.length > 0) {
        await sleep(NETDISK_CHECK_RULE.batchIntervalMs);
      }
    }

    task.status = 'completed';
    task.updatedAt = Date.now();
  } catch (error) {
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : '检测任务失�?;
    task.updatedAt = Date.now();
  } finally {
    activeTaskIds.delete(taskId);
  }
}

export function startNetdiskCheckTask(input: NetdiskCheckStartInput) {
  cleanupOldTasks();
  if (Date.now() < cooldownUntil) {
    throw new Error('检测功能冷却中，请稍后再试');
  }
  for (const taskId of Array.from(activeTaskIds)) {
    const activeTask = tasks.get(taskId);
    if (!activeTask || activeTask.status !== 'running') {
      activeTaskIds.delete(taskId);
    }
  }
  if (activeTaskIds.size >= NETDISK_CHECK_RULE.maxActiveTasks) {
    throw new Error(`当前最多只允许 ${NETDISK_CHECK_RULE.maxActiveTasks} 个检测任务同时执行，请稍后再试`);
  }

  const uniqueLinks = Array.from(
    new Set(
      input.links
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, NETDISK_CHECK_RULE.maxTaskLinks);

  if (uniqueLinks.length === 0) {
    throw new Error('没有可检测的链接');
  }

  const taskId = `netdisk_check_${nanoid(10)}`;
  const task: NetdiskCheckTask = {
    id: taskId,
    platform: input.platform,
    status: 'running',
    progress: {
      total: uniqueLinks.length,
      done: 0,
      valid: 0,
      invalid: 0,
      unknown: 0,
      rateLimited: 0,
      currentBatch: 0,
      totalBatches: countBatchSize(uniqueLinks.length),
    },
    results: Object.fromEntries(uniqueLinks.map((url) => [url, createTaskResultItem('pending')])),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.set(taskId, task);
  activeTaskIds.add(taskId);
  void runTask(taskId, uniqueLinks);
  return cloneTask(task);
}

export function getNetdiskCheckTask(taskId: string) {
  cleanupOldTasks();
  const task = tasks.get(taskId);
  return task ? cloneTask(task) : null;
}

export function cancelNetdiskCheckTask(taskId: string) {
  const task = tasks.get(taskId);
  if (!task) return null;
  task.shouldStop = true;
  task.updatedAt = Date.now();
  if (task.status !== 'running') {
    return cloneTask(task);
  }
  return cloneTask(task);
}

export function getNetdiskCheckCooldownRemainingMs() {
  return Math.max(0, cooldownUntil - Date.now());
}

export function assertNetdiskCheckPlatform(value: string): NetdiskCheckPlatform {
  const platform = value as NetdiskCheckPlatform;
  const allowed: NetdiskCheckPlatform[] = ['115', 'aliyun', 'baidu', 'cmcc', 'pan123', 'quark', 'tianyi', 'uc', 'xunlei'];
  if (!allowed.includes(platform)) {
    throw new Error('不支持的网盘平台');
  }
  return platform;
}
