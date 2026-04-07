/**
 * 导出状态管理
 */
import { create } from 'zustand';
import { tenantApi, type ExportProgress } from '../api/request';

// ============================================================
// 类型定义
// ============================================================

interface ExportTask {
  id: number;
  fileName: string;
  exportType: 'excel' | 'pdf';
  status: ExportProgress['status'];
  progress: number;
  message?: string;
  downloadUrl?: string;
  createdAt: Date;
}

interface ExportState {
  tasks: Map<number, ExportTask>;
  isPolling: boolean;

  // Actions
  createExport: (data: {
    exportType: 'excel' | 'pdf';
    fileName: string;
    filterConfig: {
      startDate: string;
      endDate: string;
      sn?: string;
      storeId?: string;
      provinceCode?: string;
    };
  }) => Promise<number>;
  fetchProgress: (id: number) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  clearCompleted: () => void;
}

// ============================================================
// Store 实现
// ============================================================

export const useExportStore = create<ExportState>((set, get) => ({
  tasks: new Map(),
  isPolling: false,

  createExport: async (data) => {
    try {
      const response = await tenantApi.createExport(data);
      const id = response.data!.id;

      // 添加到任务列表
      set(state => {
        const newTasks = new Map(state.tasks);
        newTasks.set(id, {
          id,
          fileName: data.fileName,
          exportType: data.exportType,
          status: 'pending',
          progress: 0,
          createdAt: new Date(),
        });
        return { tasks: newTasks };
      });

      // 开始轮询
      get().startPolling();

      return id;
    } catch (error) {
      console.error('创建导出任务失败:', error);
      throw error;
    }
  },

  fetchProgress: async (id: number) => {
    try {
      const response = await tenantApi.getExportProgress(id);
      const progress = response.data;

      if (progress) {
        set(state => {
          const newTasks = new Map(state.tasks);
          const existing = newTasks.get(id);
          if (existing) {
            newTasks.set(id, {
              ...existing,
              status: progress.status,
              progress: progress.progress,
              message: progress.message,
              downloadUrl: progress.downloadUrl,
            });
          }
          return { tasks: newTasks };
        });

        // 如果完成了，停止轮询
        if (progress.status === 'success' || progress.status === 'failed') {
          const allDone = Array.from(get().tasks.values()).every(
            t => t.status === 'success' || t.status === 'failed'
          );
          if (allDone) {
            get().stopPolling();
          }
        }
      }
    } catch (error) {
      console.error('获取导出进度失败:', error);
    }
  },

  startPolling: () => {
    if (get().isPolling) return;

    set({ isPolling: true });

    const poll = () => {
      const { tasks, isPolling } = get();
      if (!isPolling) return;

      tasks.forEach((task, id) => {
        if (task.status === 'pending' || task.status === 'generating') {
          get().fetchProgress(id);
        }
      });

      // 继续轮询
      setTimeout(poll, 2000);
    };

    poll();
  },

  stopPolling: () => {
    set({ isPolling: false });
  },

  clearCompleted: () => {
    set(state => {
      const newTasks = new Map(state.tasks);
      Array.from(newTasks.entries()).forEach(([id, task]) => {
        if (task.status === 'success' || task.status === 'failed') {
          newTasks.delete(id);
        }
      });
      return { tasks: newTasks };
    });
  },
}));

// ============================================================
// Hooks
// ============================================================

export const useExportTasks = () => {
  const tasks = useExportStore(state => state.tasks);
  return Array.from(tasks.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const useExportTask = (id: number) => {
  return useExportStore(state => state.tasks.get(id));
};

export const usePendingExportCount = () => {
  const tasks = useExportStore(state => state.tasks);
  return Array.from(tasks.values()).filter(t => t.status === 'pending' || t.status === 'generating').length;
};
