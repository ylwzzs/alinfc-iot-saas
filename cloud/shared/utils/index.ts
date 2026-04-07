import dayjs from 'dayjs';

/**
 * 日志工具
 */
export const logger = {
  info(tag: string, message: string, data?: unknown) {
    console.log(JSON.stringify({ level: 'info', time: dayjs().format('YYYY-MM-DD HH:mm:ss'), tag, message, data }));
  },
  warn(tag: string, message: string, data?: unknown) {
    console.warn(JSON.stringify({ level: 'warn', time: dayjs().format('YYYY-MM-DD HH:mm:ss'), tag, message, data }));
  },
  error(tag: string, message: string, data?: unknown) {
    console.error(JSON.stringify({ level: 'error', time: dayjs().format('YYYY-MM-DD HH:mm:ss'), tag, message, data }));
  },
};

/**
 * 获取昨天的日期字符串（格式: YYYYMMDD）
 */
export function getYesterday(): string {
  return dayjs().subtract(1, 'day').format('YYYYMMDD');
}

/**
 * 获取昨天的日期（格式: YYYY-MM-DD）
 */
export function getYesterdayDate(): string {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD');
}

/**
 * 将 YYYYMMDD 转换为 YYYY-MM-DD
 */
export function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * 生成日期范围数组
 */
export function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = dayjs(startDate);
  const end = dayjs(endDate);
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    dates.push(current.format('YYYYMMDD'));
    current = current.add(1, 'day');
  }
  return dates;
}

/**
 * 获取最近N天的日期范围
 */
export function getRecentDays(days: number): { start: string; end: string } {
  return {
    start: dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'),
    end: getYesterdayDate(),
  };
}

/**
 * 延时
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * AES-256 加密
 */
export function encrypt(text: string, key: string): string {
  const crypto = require('crypto');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * AES-256 解密
 */
export function decrypt(encryptedText: string, key: string): string {
  const crypto = require('crypto');
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32, '0').slice(0, 32)), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * 将支付宝接口返回的设备数据映射为数据库字段
 */
export function mapDeviceData(tenantId: number, metricsDate: string, rawItem: Record<string, unknown>): Record<string, unknown> {
  return {
    tenant_id: tenantId,
    metrics_date: formatDate(metricsDate),
    sn: rawItem.sn || '',
    store_id: rawItem.store_id || null,
    device_type: rawItem.device_type || null,
    device_system: rawItem.device_system || null,
    province_code: rawItem.province_code || null,
    province_name: rawItem.province_name || null,
    city_code: rawItem.city_code || null,
    city_name: rawItem.city_name || null,
    district_code: rawItem.district_code || null,
    district_name: rawItem.district_name || null,
    location_address: rawItem.location_address || null,
    binding_location: rawItem.binding_location || null,
    alipay_amount: rawItem.alipay_amount || 0,
    alipay_transaction_count: rawItem.alipay_transaction_count || 0,
    effective_alipay_transaction_count: rawItem.effective_alipay_transaction_count || 0,
    nfc_amount: rawItem.nfc_amount || 0,
    nfc_transaction_count: rawItem.nfc_transaction_count || 0,
    effective_nfc_transaction_count: rawItem.effective_nfc_transaction_count || 0,
    refund_order_amt: rawItem.refund_order_amt || 0,
    refund_order_cnt: rawItem.refund_order_cnt || 0,
    real_refund_fee: rawItem.real_refund_fee || 0,
    real_consume_fee: rawItem.real_consume_fee || 0,
    be_register: rawItem.be_register ? 1 : 0,
    register_time: rawItem.register_time || null,
    update_register_time: rawItem.update_register_time || null,
    be_lighted_up: rawItem.be_lighted_up ? 1 : 0,
    light_up_time: rawItem.light_up_time || null,
    be_turnon_device: rawItem.be_turnon_device ? 1 : 0,
    effective_turnon_device: rawItem.effective_turnon_device ? 1 : 0,
    do_check_in: rawItem.do_check_in ? 1 : 0,
    last_30_valid_boot_days: rawItem.last_30_valid_boot_days || '0',
    last_30_sales_over_2_days: rawItem.last_30_sales_over_2_days || '0',
    last_30_checkin_days: rawItem.last_30_checkin_days || '0',
    last_7_checkin_days: rawItem.last_7_checkin_days || '0',
    cont_non_turnon_days_mtd: rawItem.cont_non_turnon_days_mtd || '0',
    total_lighted_months: rawItem.total_lighted_months || '0',
    nfc_amt_2_restrict_2_order_cnt: rawItem.nfc_amt_2_restrict_2_order_cnt || 0,
    alipay_amt_2_restrict_2_order_cnt: rawItem.alipay_amt_2_restrict_2_order_cnt || 0,
    trd_nfc_device_usercnt: rawItem.trd_nfc_device_usercnt || '0',
    trd_amt_2_n_user_cnt_fromlight_30_d: rawItem.trd_amt_2_n_user_cnt_fromlight_30_d || '0',
    trd_amt_2_user_cnt: rawItem.trd_amt_2_user_cnt || '0',
    trd_amt_3_user_cnt: rawItem.trd_amt_3_user_cnt || '0',
    trd_greater_2_nfc_device_usercnt: rawItem.trd_greater_2_nfc_device_usercnt || '0',
    has_nfc_trade: rawItem.has_nfc_trade ? 1 : 0,
    has_nfc_trade_greater_2: rawItem.has_nfc_trade_greater_2 ? 1 : 0,
    nfc_trade_greater_2: rawItem.nfc_trade_greater_2 ? 1 : 0,
    leads_worker_id: rawItem.leads_worker_id || null,
    leads_worker_name: rawItem.leads_worker_name || null,
    leads_location: rawItem.leads_location || null,
    leads_location_address: rawItem.leads_location_address || null,
    leads_poi_id: rawItem.leads_poi_id || null,
    digital_poi_id: rawItem.digital_poi_id || null,
    shipping_time: rawItem.shipping_time || null,
    open_id: rawItem.open_id || null,
    micro_command_active_7_day: rawItem.micro_command_active_7_day ? 1 : 0,
    advance_plan: rawItem.advance_plan || null,
    be_change_device: rawItem.be_change_device ? 1 : 0,
    change_device_sn: rawItem.change_device_sn || null,
    change_device_time: rawItem.change_device_time || null,
    be_high_tpv_shop: rawItem.be_high_tpv_shop ? 1 : 0,
    be_special_shop: rawItem.be_special_shop ? 1 : 0,
    be_unified_collect: rawItem.be_unified_collect ? 1 : 0,
    instructions_work_time: rawItem.instructions_work_time || null,
    act_instructions_dvc: rawItem.act_instructions_dvc || '0',
    be_access_my_tiny_cmd_td: rawItem.be_access_my_tiny_cmd_td ? 1 : 0,
    valid_open_days_last_bind_30_d: rawItem.valid_open_days_last_bind_30_d || '0',
    nfc_amt_2_days_last_bind_30_d: rawItem.nfc_amt_2_days_last_bind_30_d || '0',
    nfc_amt_2_user_cnt_last_bind_30_d: rawItem.nfc_amt_2_user_cnt_last_bind_30_d || '0',
    sign_days_last_bind_30_d: rawItem.sign_days_last_bind_30_d || '0',
    sign_days_last_bind_7_d: rawItem.sign_days_last_bind_7_d || '0',
    cur_bind_status: rawItem.cur_bind_status || null,
    poi_first_sign_time: rawItem.poi_first_sign_time || null,
    store_first_sale_1_yuan_date: rawItem.store_first_sale_1_yuan_date || null,
    raw_data: JSON.stringify(rawItem),
  };
}
