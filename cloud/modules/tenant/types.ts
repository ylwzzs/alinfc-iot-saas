/**
 * 租户模块 - 类型定义
 */

export interface Tenant {
  id: number;
  name: string;
  contact_name?: string;
  contact_phone?: string;
  app_auth_token?: string;
  app_auth_token_expires_at?: Date;
  refresh_token?: string;
  authorization_status: AuthorizationStatus;
  authorized_at?: Date;
  last_sync_at?: Date;
  last_sync_status?: SyncStatus;
  last_sync_error?: string;
  device_count: number;
  status: TenantStatus;
  created_at: Date;
  updated_at: Date;
}

export type AuthorizationStatus = 'pending' | 'authorizing' | 'authorized' | 'expired' | 'disabled';
export type SyncStatus = 'success' | 'failed' | 'syncing' | 'never';
export type TenantStatus = 0 | 1; // 0: 禁用, 1: 启用

export interface TenantCreateInput {
  name: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface TenantUpdateInput {
  name?: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface TenantListOptions {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: TenantStatus;
  authStatus?: AuthorizationStatus;
}

export interface TenantStats {
  total: number;
  authorized: number;
  pending: number;
  active: number;
}
