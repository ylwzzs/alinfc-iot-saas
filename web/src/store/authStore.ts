/**
 * 认证状态管理
 */
import { create } from 'zustand';
import { authApi, type TenantModule } from '../api/request';

// ============================================================
// 类型定义
// ============================================================

interface User {
  id: number;
  username: string;
  role: 'admin' | 'tenant';
  realName?: string;
  tenantId?: number;
  tenantName?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  modules: TenantModule[];
  isLoading: boolean;

  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
  loadModules: () => Promise<void>;
  hasModule: (moduleId: string) => boolean;
}

// ============================================================
// Store 实现
// ============================================================

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  modules: [],
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ token: null, user: null, modules: [] });
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isLoading: true });

        // 验证 token 并加载模块
        try {
          await authApi.getUser();
          await get().loadModules();
        } catch {
          // Token 无效
          get().logout();
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ token: null, user: null, isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  loadModules: async () => {
    const { user } = get();
    if (!user) return;

    try {
      // 根据角色加载模块
      const { tenantApi, adminApi } = await import('../api/request');

      if (user.role === 'tenant') {
        const response = await tenantApi.getModules();
        set({ modules: response.data || [], isLoading: false });
      } else {
        // 管理员不需要模块权限，设置空数组
        set({ modules: [], isLoading: false });
      }
    } catch (error) {
      console.error('加载模块失败:', error);
      set({ isLoading: false });
    }
  },

  hasModule: (moduleId: string) => {
    const { user, modules } = get();

    // 管理员拥有所有权限
    if (user?.role === 'admin') return true;

    // 检查租户模块权限
    return modules.some(m => m.module_id === moduleId && m.enabled);
  },
}));

// ============================================================
// Hooks
// ============================================================

export const useIsAdmin = () => useAuthStore(state => state.user?.role === 'admin');
export const useIsTenant = () => useAuthStore(state => state.user?.role === 'tenant');
export const useTenantId = () => useAuthStore(state => state.user?.tenantId);
export const useModules = () => useAuthStore(state => state.modules);
export const useHasModule = (moduleId: string) => useAuthStore(state => state.hasModule(moduleId));
