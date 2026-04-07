/**
 * 同步模块 - 类型定义
 */

export interface SyncCheckpoint {
  id: number;
  tenant_id: number;
  metrics_date: string;
  last_page: number;
  total_pages: number;
  total_records: number;
  synced_records: number;
  status: SyncStatus;
  error_message?: string;
  started_at?: Date;
  finished_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SyncLog {
  id: number;
  tenant_id: number;
  metrics_date: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  total_records: number;
  synced_records: number;
  error_message?: string;
  started_at?: Date;
  finished_at?: Date;
  created_at: Date;
}

export interface SyncTask {
  tenantId: number;
  metricsDate: string;
  priority?: number;
}

export interface SyncProgress {
  tenantId: number;
  metricsDate: string;
  currentPage: number;
  totalPages: number;
  syncedRecords: number;
  totalRecords: number;
  status: SyncStatus;
  percent: number;
}

export interface AlipayDeviceMetric {
  sn: string;
  store_id?: string;
  device_type?: string;
  device_system?: string;
  province_code?: string;
  province_name?: string;
  city_code?: string;
  city_name?: string;
  district_code?: string;
  district_name?: string;
  location_address?: string;
  binding_location?: string;
  alipay_amt?: string | number;
  alipay_trd_cnt?: string | number;
  eff_alipay_trd_cnt?: string | number;
  nfc_amt?: string | number;
  nfc_trd_cnt?: string | number;
  eff_nfc_trd_cnt?: string | number;
  refund_order_amt?: string | number;
  refund_order_cnt?: string | number;
  real_refund_fee?: string | number;
  real_consume_fee?: string | number;
  be_register?: number;
  register_time?: string;
  be_lighted_up?: number;
  light_up_time?: string;
  be_turnon_device?: number;
  eff_turnon_device?: number;
  do_check_in?: number;
  last_30_valid_boot_days?: string;
  last_30_sales_over_2_days?: string;
  last_30_checkin_days?: string;
  last_7_checkin_days?: string;
  cont_non_turnon_days_mtd?: string;
  total_lighted_months?: string;
  [key: string]: unknown;
}
