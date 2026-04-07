/**
 * 设备模块 - 类型定义
 */

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
}

export interface DeviceMetricInput {
  tenant_id: number;
  metrics_date: string;
  sn: string;
  [key: string]: unknown;
}

export interface DeviceListOptions {
  startDate: string;
  endDate: string;
  sn?: string;
  storeId?: string;
  provinceCode?: string;
  cityCode?: string;
  page?: number;
  pageSize?: number;
}

export interface DailySummary {
  metrics_date: string;
  total_amount: number;
  total_transactions: number;
  device_count: number;
  nfc_amount: number;
  nfc_count: number;
  refund_amount: number;
}

export interface StoreRanking {
  binding_location: string;
  store_id: string;
  total_amount: number;
  total_transactions: number;
  device_count: number;
}

export interface ProvinceStats {
  province_name: string;
  province_code: string;
  total_amount: number;
  total_transactions: number;
  device_count: number;
}
