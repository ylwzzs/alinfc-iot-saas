export interface Tenant {
  id: number;
  name: string;
  contact_name?: string;
  contact_phone?: string;
  app_auth_token?: string;
  app_auth_token_expires_at?: string;
  refresh_token?: string;
  authorization_status: 'pending' | 'authorizing' | 'authorized' | 'expired' | 'disabled';
  authorized_at?: string;
  last_sync_at?: string;
  last_sync_status?: 'success' | 'failed' | 'syncing' | 'never';
  last_sync_error?: string;
  device_count: number;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface TenantCreate {
  name: string;
  contact_name?: string;
  contact_phone?: string;
}

export interface DeviceMetric {
  id: number;
  tenant_id: number;
  metrics_date: string;
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
  alipay_amount: number;
  alipay_transaction_count: number;
  effective_alipay_transaction_count: number;
  nfc_amount: number;
  nfc_transaction_count: number;
  effective_nfc_transaction_count: number;
  refund_order_amt: number;
  refund_order_cnt: number;
  real_refund_fee: number;
  real_consume_fee: number;
  be_register: number;
  register_time?: string;
  be_lighted_up: number;
  light_up_time?: string;
  be_turnon_device: number;
  effective_turnon_device: number;
  do_check_in: number;
  last_30_valid_boot_days: string;
  last_30_sales_over_2_days: string;
  last_30_checkin_days: string;
  last_7_checkin_days: string;
  cont_non_turnon_days_mtd: string;
  total_lighted_months: string;
  raw_data?: Record<string, unknown>;
  synced_at: string;
  [key: string]: unknown;
}

export interface SyncLog {
  id: number;
  tenant_id: number;
  metrics_date: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'partial';
  total_records: number;
  synced_records: number;
  error_message?: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
}

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  real_name?: string;
  status: number;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}
