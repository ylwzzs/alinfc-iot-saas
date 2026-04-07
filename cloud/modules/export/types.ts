/**
 * 导出模块 - 类型定义
 */

export interface ExportRecord {
  id: number;
  tenant_id: number;
  user_id?: number;
  user_type: 'admin' | 'tenant';
  export_type: 'excel' | 'pdf';
  file_name: string;
  file_path?: string;
  file_size: number;
  status: ExportStatus;
  filter_config?: Record<string, unknown>;
  error_message?: string;
  created_at: Date;
}

export type ExportStatus = 'pending' | 'generating' | 'success' | 'failed';

export interface ExportOptions {
  tenantId: number;
  userId?: number;
  userType: 'admin' | 'tenant';
  exportType: 'excel' | 'pdf';
  fileName: string;
  filterConfig: {
    startDate: string;
    endDate: string;
    sn?: string;
    storeId?: string;
    provinceCode?: string;
  };
}

export interface ExportProgress {
  id: number;
  status: ExportStatus;
  progress: number;
  message?: string;
  downloadUrl?: string;
}
