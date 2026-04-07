/**
 * 同步状态管理
 */
import { create } from 'zustand';
import { adminApi, tenantApi, type SyncProgress } from '../api/request';

// ============================================================
// 类型定义
// ============================================================

interface SyncTask {
  tenantId: number;
  tenantName?: string;
  metricsDate: string;
  status: SyncProgress['status'];
  percent: number;
  syncedRecords: number;
  totalRecords: number;
}

interface SyncState {
  tasks: Map<string, SyncTask>;
  isPolling: boolean;
  pollingInterval: NodeJS.Timeout | null;

  // Actions
  startPolling: () => void;
  stopPolling: () => void;
  fetchProgress: (tenantId: number, metricsDate: string) => Promise<void>;
  fetchAllProgress: (tenantIds: number[], metricsDate: string) => Promise<void>;
  triggerSync: (tenantId: number, metricsDate?: string) => Promise<{ taskId: string; metricsDate: string } | undefined>;
  triggerAllSync: (metricsDate?: string) => Promise<{ count: number; metricsDate: string } | undefined>;
}

// ============================================================
// 辅助函数
// ============================================================

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

const getTaskKey = (tenantId: number, metricsDate: string) => `${tenantId}-${metricsDate}`;

// ============================================================
// Store 实现
// ============================================================

export const useSyncStore = create<SyncState>((set, get) => ({
  tasks: new Map(),
  isPolling: false,
  pollingInterval: null,

  startPolling: () => {
    if (get().isPolling) return;

    const interval = setInterval(() => {
      // 检查所有运行中的任务
      const { tasks } = get();
      tasks.forEach((task, key) => {
        if (task.status === 'running') {
          const [tenantId, metricsDate] = key.split('-');
          get().fetchProgress(parseInt(tenantId), metricsDate);
        }
      });
    }, 3000); // 每 3 秒轮询一次

    set({ isPolling: true, pollingInterval: interval });
  },

  stopPolling: () => {
    const { pollingInterval } = get();
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }
    set({ isPolling: false, pollingInterval: null });
  },

  fetchProgress: async (tenantId: number, metricsDate: string) => {
    try {
      const response = await adminApi.getSyncProgress(tenantId, metricsDate);
      const progress = response.data;

      if (progress) {
        const key = getTaskKey(tenantId, metricsDate);
        set(state => {
          const newTasks = new Map(state.tasks);
          newTasks.set(key, {
            tenantId,
            metricsDate,
            status: progress.status,
            percent: progress.percent,
            syncedRecords: progress.syncedRecords,
            totalRecords: progress.totalRecords,
          });
          return { tasks: newTasks };
        });
      }
    } catch (error) {
      console.error('获取同步进度失败:', error);
    }
  },

  fetchAllProgress: async (tenantIds: number[], metricsDate: string) => {
    await Promise.all(
      tenantIds.map(id => get().fetchProgress(id, metricsDate))
    );
  },

  triggerSync: async (tenantId: number, metricsDate?: string) => {
    const date = metricsDate || getYesterday();

    try {
      const response = await adminApi.triggerSync(tenantId, date);

      // 添加到任务列表
      const key = getTaskKey(tenantId, date);
      set(state => {
        const newTasks = new Map(state.tasks);
        newTasks.set(key, {
          tenantId,
          metricsDate: date,
          status: 'running',
          percent: 0,
          syncedRecords: 0,
          totalRecords: 0,
        });
        return { tasks: newTasks };
      });

      // 开始轮询
      get().startPolling();

      return response.data;
    } catch (error) {
      console.error('触发同步失败:', error);
      throw error;
    }
  },

  triggerAllSync: async (metricsDate?: string) => {
    const date = metricsDate || getYesterday();

    try {
      const response = await adminApi.triggerAllSync(date);
      get().startPolling();
      return response.data;
    } catch (error) {
      console.error('触发全量同步失败:', error);
      throw error;
    }
  },
}));

// ============================================================
// Hooks
// ============================================================

export const useSyncTasks = () => {
  const tasks = useSyncStore(state => state.tasks);
  return Array.from(tasks.values());
};

export const useSyncTask = (tenantId: number, metricsDate: string) => {
  const key = getTaskKey(tenantId, metricsDate);
  return useSyncStore(state => state.tasks.get(key));
};

export const useRunningSyncCount = () => {
  const tasks = useSyncStore(state => state.tasks);
  return Array.from(tasks.values()).filter(t => t.status === 'running').length;
};
