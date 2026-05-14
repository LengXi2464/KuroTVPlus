/**
 * 下载任务数据库管�? */

export interface SavedTask {
  id: string;
  url: string;
  title: string;
  type: 'TS' | 'MP4';
  status: 'ready' | 'downloading' | 'pause' | 'done' | 'error';
  finishList: Array<{
    title: string;
    status: '' | 'is-downloading' | 'is-success' | 'is-error';
    retryCount?: number;
  }>;
  downloadIndex: number;
  finishNum: number;
  errorNum: number;
  source?: string;
  videoId?: string;
  episodeIndex?: number;
  downloadMode?: 'browser' | 'filesystem';
  rangeDownload: {
    isShowRange: boolean;
    startSegment: number;
    endSegment: number;
    targetSegment: number;
  };
  m3u8Content?: string;
  createdAt: number;
  completedAt?: number;
}

export interface CompletedTask {
  id: string;
  title: string;
  source: string;
  videoId: string;
  episodeIndex: number;
  videoTitle?: string; // 视频总标�?  episodeTitle?: string; // 集数标题
  fileSize?: number; // 文件大小（字节）
  completedAt: number;
  downloadMode: 'browser' | 'filesystem';
}

const DB_NAME = 'KuroTVPlus';
const DB_VERSION = 2;
const ACTIVE_TASKS_STORE = 'activeTasks';
const COMPLETED_TASKS_STORE = 'completedTasks';

class DownloadDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建 activeTasks �?        if (!db.objectStoreNames.contains(ACTIVE_TASKS_STORE)) {
          const activeStore = db.createObjectStore(ACTIVE_TASKS_STORE, { keyPath: 'id' });
          activeStore.createIndex('status', 'status', { unique: false });
          activeStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 创建 completedTasks �?        if (!db.objectStoreNames.contains(COMPLETED_TASKS_STORE)) {
          const completedStore = db.createObjectStore(COMPLETED_TASKS_STORE, { keyPath: 'id' });
          completedStore.createIndex('source', 'source', { unique: false });
          completedStore.createIndex('videoId', 'videoId', { unique: false });
          completedStore.createIndex('completedAt', 'completedAt', { unique: false });
          completedStore.createIndex('sourceVideoId', ['source', 'videoId'], { unique: false });
        }
      };
    });
  }

  // 保存活动任务
  async saveActiveTask(task: SavedTask): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(ACTIVE_TASKS_STORE);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 批量保存活动任务
  async saveActiveTasks(tasks: SavedTask[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(ACTIVE_TASKS_STORE);

      // 先清�?      store.clear();

      // 再添�?      for (const task of tasks) {
        store.put(task);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // 获取所有活动任�?  async getActiveTasks(): Promise<SavedTask[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_TASKS_STORE], 'readonly');
      const store = transaction.objectStore(ACTIVE_TASKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // 删除活动任务
  async deleteActiveTask(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(ACTIVE_TASKS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 批量删除活动任务
  async deleteActiveTasks(ids: string[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([ACTIVE_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(ACTIVE_TASKS_STORE);

      for (const id of ids) {
        store.delete(id);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // 保存已完成任�?  async saveCompletedTask(task: CompletedTask): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([COMPLETED_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 获取所有已完成任务
  async getCompletedTasks(): Promise<CompletedTask[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([COMPLETED_TASKS_STORE], 'readonly');
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const index = store.index('completedAt');
      const request = index.openCursor(null, 'prev'); // 按完成时间倒序

      const results: CompletedTask[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // 删除已完成任�?  async deleteCompletedTask(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([COMPLETED_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 批量删除已完成任�?  async deleteCompletedTasks(ids: string[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([COMPLETED_TASKS_STORE], 'readwrite');
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);

      for (const id of ids) {
        store.delete(id);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // 检查是否已下载
  async isDownloaded(source: string, videoId: string, episodeIndex: number): Promise<boolean> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([COMPLETED_TASKS_STORE], 'readonly');
      const store = transaction.objectStore(COMPLETED_TASKS_STORE);
      const index = store.index('sourceVideoId');
      const request = index.openCursor(IDBKeyRange.only([source, videoId]));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const task = cursor.value as CompletedTask;
          if (task.episodeIndex === episodeIndex) {
            resolve(true);
            return;
          }
          cursor.continue();
        } else {
          resolve(false);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const downloadDB = new DownloadDB();
