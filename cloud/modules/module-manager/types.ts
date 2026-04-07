/**
 * 模块管理模块 - 类型定义
 */

export interface SystemModule {
  id: string;
  name: string;
  description?: string;
  version: string;
  icon?: string;
  route?: string;
  permissions: string[];
  dependencies?: string[];
  is_core: boolean;     // 是否核心模块（不可禁用）
  status: ModuleStatus;
  created_at: Date;
  updated_at: Date;
}

export type ModuleStatus = 'active' | 'deprecated' | 'development';

export interface TenantModule {
  id: number;
  tenant_id: number;
  module_id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ModuleConfig {
  [key: string]: unknown;
}

// 系统预置模块
export const PRESET_MODULES: Omit<SystemModule, 'created_at' | 'updated_at'>[] = [
  {
    id: 'dashboard',
    name: '数据大屏',
    description: '数据概览和可视化大屏',
    version: '1.0.0',
    route: '/tenant/dashboard',
    permissions: ['tenant:dashboard:view'],
    is_core: true,
    status: 'active',
  },
  {
    id: 'devices',
    name: '设备管理',
    description: '设备数据查询和管理',
    version: '1.0.0',
    route: '/tenant/devices',
    permissions: ['tenant:devices:view', 'tenant:devices:export'],
    is_core: true,
    status: 'active',
  },
  {
    id: 'analytics',
    name: '数据分析',
    description: '多维度数据分析和图表',
    version: '1.0.0',
    route: '/tenant/analytics',
    permissions: ['tenant:analytics:view'],
    is_core: false,
    status: 'active',
  },
  {
    id: 'export',
    name: '报表导出',
    description: 'Excel/PDF/Word 报表导出',
    version: '1.0.0',
    route: '/tenant/export',
    permissions: ['tenant:export:excel', 'tenant:export:pdf'],
    is_core: false,
    status: 'active',
  },
  {
    id: 'sync',
    name: '数据同步',
    description: '查看数据同步状态',
    version: '1.0.0',
    route: '/tenant/sync',
    permissions: ['tenant:sync:view'],
    is_core: true,
    status: 'active',
  },
];
