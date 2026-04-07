/**
 * API 请求封装
 * 统一请求处理、错误处理、Token 管理
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

// ============================================================
// 类型定义
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  traceId?: string;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Tenant {
  id: number;
  name: string;
  contact_name?: string;
  contact_phone?: string;
  authorization_status: 'pending' | 'authorizing' | 'authorized' | 'expired' | 'disabled';
  last_sync_at?: string;
  last_sync_status?: string;
  device_count: number;
  status: number;
  created_at: string;
}

export interface SystemModule {
  id: string;
  name: string;
  description?: string;
  version: string;
  icon?: string;
  route?: string;
  permissions: string[];
  is_core: boolean;
  status: string;
}

export interface TenantModule {
  id: number;
  tenant_id: number;
  module_id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  name?: string;
  description?: string;
  route?: string;
  icon?: string;
  expires_at?: string;
}

export interface SyncProgress {
  tenantId: number;
  metricsDate: string;
  currentPage: number;
  totalPages: number;
  syncedRecords: number;
  totalRecords: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  percent: number;
}

export interface ExportProgress {
  id: number;
  status: 'pending' | 'generating' | 'success' | 'failed';
  progress: number;
  message?: string;
  downloadUrl?: string;
}

// ============================================================
// 创建 Axios 实例
// ============================================================

const createRequest = (baseURL?: string): AxiosInstance => {
  const request = axios.create({
    baseURL: baseURL || import.meta.env.VITE_API_URL || '',
    timeout: 60000,
    headers: { 'Content-Type': 'application/json' },
  });

  // 请求拦截器
  request.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // 添加追踪 ID
      config.headers['X-Trace-Id'] = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // 响应拦截器
  request.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const { data } = response;

      if (data.success === false) {
        message.error(data.message || '请求失败');
        return Promise.reject(new Error(data.message));
      }

      return data as any;
    },
    (error) => {
      const { response, code, message: msg } = error;

      if (response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/#/login';
        message.error('登录已过期，请重新登录');
      } else if (response?.status === 403) {
        message.error('没有权限执行此操作');
      } else if (response?.status === 429) {
        message.error('请求过于频繁，请稍后重试');
      } else if (code === 'ECONNABORTED') {
        message.error('请求超时，请重试');
      } else if (response?.status >= 500) {
        message.error('服务器错误，请稍后重试');
      } else {
        message.error(response?.data?.message || msg || '网络错误');
      }

      return Promise.reject(error);
    }
  );

  return request;
};

const request = createRequest();

// ============================================================
// 认证 API
// ============================================================

export const authApi = {
  adminLogin: (data: { username: string; password: string }) =>
    request.post<unknown, ApiResponse<{ token: string; user: { id: number; username: string; realName?: string } }>>(
      '/api/auth/admin/login',
      data
    ),

  tenantLogin: (data: { tenantName: string; password: string }) =>
    request.post<unknown, ApiResponse<{ token: string; tenant: { id: number; name: string } }>>(
      '/api/auth/tenant/login',
      data
    ),

  getUser: () =>
    request.get<unknown, ApiResponse<{ id: number; username: string; role: 'admin' | 'tenant'; tenantId?: number }>>(
      '/api/auth/user'
    ),
};

// ============================================================
// 管理员 API
// ============================================================

export const adminApi = {
  // 租户管理
  getTenants: (params?: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    status?: number;
    authStatus?: string;
  }) => request.get<unknown, ApiResponse<PaginatedResponse<Tenant>>>('/api/admin/tenants', { params }),

  createTenant: (data: { name: string; contact_name?: string; contact_phone?: string }) =>
    request.post<unknown, ApiResponse<{ id: number }>>('/api/admin/tenants', data),

  updateTenant: (id: number, data: { name?: string; contact_name?: string; contact_phone?: string }) =>
    request.put<unknown, ApiResponse<null>>(`/api/admin/tenants/${id}`, data),

  updateTenantStatus: (id: number, status: number) =>
    request.put<unknown, ApiResponse<null>>(`/api/admin/tenants/${id}/status`, { status }),

  deleteTenant: (id: number) =>
    request.delete<unknown, ApiResponse<null>>(`/api/admin/tenants/${id}`),

  // 授权
  getAuthQrCode: (tenantId: number) =>
    request.get<unknown, ApiResponse<{ authUrl: string; qrCodeUrl: string; expireSeconds: number }>>(
      `/api/admin/auth/tenant/${tenantId}/url`
    ),

  // 模块管理
  getModules: () =>
    request.get<unknown, ApiResponse<SystemModule[]>>('/api/admin/modules'),

  getTenantModules: (tenantId: number) =>
    request.get<unknown, ApiResponse<TenantModule[]>>(`/api/admin/modules/tenant/${tenantId}`),

  enableModule: (tenantId: number, moduleId: string, config?: Record<string, unknown>, expiresAt?: string) =>
    request.post<unknown, ApiResponse<null>>(`/api/admin/modules/tenant/${tenantId}/enable`, {
      moduleId,
      config,
      expiresAt,
    }),

  disableModule: (tenantId: number, moduleId: string) =>
    request.post<unknown, ApiResponse<null>>(`/api/admin/modules/tenant/${tenantId}/disable`, { moduleId }),

  // 同步管理
  getSyncLogs: (limit = 50) =>
    request.get<unknown, ApiResponse<any[]>>('/api/admin/sync/logs', { params: { limit } }),

  triggerSync: (tenantId: number, metricsDate?: string) =>
    request.post<unknown, ApiResponse<{ taskId: string; metricsDate: string }>>(
      `/api/admin/sync/tenant/${tenantId}`,
      { metricsDate }
    ),

  triggerAllSync: (metricsDate?: string) =>
    request.post<unknown, ApiResponse<{ count: number; metricsDate: string }>>(
      '/api/admin/sync/all',
      { metricsDate }
    ),

  getSyncProgress: (tenantId: number, metricsDate: string) =>
    request.get<unknown, ApiResponse<SyncProgress | null>>(
      `/api/admin/sync/progress/${tenantId}/${metricsDate}`
    ),

  // 概览
  getOverview: (days = 30) =>
    request.get<unknown, ApiResponse<any>>('/api/admin/overview', { params: { days } }),
};

// ============================================================
// 租户 API
// ============================================================

export const tenantApi = {
  // 租户信息
  getInfo: () =>
    request.get<unknown, ApiResponse<Tenant>>('/api/tenant/info'),

  updateInfo: (data: { contact_name?: string; contact_phone?: string }) =>
    request.put<unknown, ApiResponse<null>>('/api/tenant/info', data),

  // 模块
  getModules: () =>
    request.get<unknown, ApiResponse<TenantModule[]>>('/api/tenant/modules'),

  // Dashboard
  getDashboard: (days = 30) =>
    request.get<unknown, ApiResponse<any>>('/api/tenant/dashboard', { params: { days } }),

  // 设备数据
  getDevices: (params: {
    startDate: string;
    endDate: string;
    sn?: string;
    storeId?: string;
    provinceCode?: string;
    page?: number;
    pageSize?: number;
  }) => request.get<unknown, ApiResponse<PaginatedResponse<any>>>('/api/tenant/devices', { params }),

  // 分析
  getAnalytics: (params: {
    startDate: string;
    endDate: string;
    type?: 'daily' | 'store' | 'province';
  }) => request.get<unknown, ApiResponse<any[]>>('/api/tenant/analytics', { params }),

  // 同步
  getSyncLogs: (limit = 30) =>
    request.get<unknown, ApiResponse<any[]>>('/api/tenant/sync/logs', { params: { limit } }),

  getSyncProgress: (metricsDate: string) =>
    request.get<unknown, ApiResponse<SyncProgress | null>>(`/api/tenant/sync/progress/${metricsDate}`),

  // 导出
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
  }) => request.post<unknown, ApiResponse<{ id: number }>>('/api/tenant/export', data),

  getExportProgress: (id: number) =>
    request.get<unknown, ApiResponse<ExportProgress>>(`/api/tenant/export/progress/${id}`),

  getExportRecords: () =>
    request.get<unknown, ApiResponse<any[]>>('/api/tenant/export/records'),

  downloadExport: (id: number) =>
    `${import.meta.env.VITE_API_URL || ''}/api/tenant/export/download/${id}`,
};

// ============================================================
// 监控 API
// ============================================================

export const monitorApi = {
  getHealth: () =>
    request.get<unknown, any>('/api/monitor/health'),

  getStatus: () =>
    request.get<unknown, ApiResponse<any>>('/api/monitor/status'),

  getMetrics: () =>
    request.get<unknown, ApiResponse<any>>('/api/monitor/metrics'),
};

export default request;
