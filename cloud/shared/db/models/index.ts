/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, execute } from '../connection';

// ============================================================
// 类型定义
// ============================================================
interface Tenant {
  id: number;
  name: string;
  contact_name?: string;
  contact_phone?: string;
  app_auth_token?: string;
  app_auth_token_expires_at?: Date;
  refresh_token?: string;
  authorization_status: 'pending' | 'authorizing' | 'authorized' | 'expired' | 'disabled';
  authorized_at?: Date;
  last_sync_at?: Date;
  last_sync_status?: 'success' | 'failed' | 'syncing' | 'never';
  last_sync_error?: string;
  device_count: number;
  status: number;
  created_at: Date;
  updated_at: Date;
}

interface SyncLog {
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

interface DeviceMetric {
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
  nfc_amount: number;
  nfc_transaction_count: number;
  refund_order_amt: number;
  refund_order_cnt: number;
  real_refund_fee: number;
  real_consume_fee: number;
  be_register: number;
  register_time?: Date;
  update_register_time?: Date;
  be_lighted_up: number;
  light_up_time?: Date;
  be_turnon_device: number;
  effective_turnon_device: number;
  do_check_in: number;
  last_30_valid_boot_days: string;
  last_30_sales_over_2_days: string;
  last_30_checkin_days: string;
  last_7_checkin_days: string;
  synced_at: Date;
}

interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  real_name?: string;
  status: number;
  last_login?: Date;
  created_at: Date;
}

// ============================================================
// 租户模型
// ============================================================
export const TenantModel = {
  async findById(id: number): Promise<Tenant | undefined> {
    const rows = await query<any[]>('SELECT * FROM tenants WHERE id = ?', [id]);
    return rows[0];
  },

  async findByName(name: string): Promise<Tenant | undefined> {
    const rows = await query<any[]>('SELECT * FROM tenants WHERE name = ?', [name]);
    return rows[0];
  },

  async findAll(options?: {
    status?: number;
    authStatus?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: Tenant[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    
    let sql = 'SELECT * FROM tenants WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM tenants WHERE 1=1';
    const params: any[] = [];

    if (options?.status !== undefined) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(options.status);
    }
    if (options?.authStatus) {
      sql += ' AND authorization_status = ?';
      countSql += ' AND authorization_status = ?';
      params.push(options.authStatus);
    }
    if (options?.keyword) {
      sql += ' AND (name LIKE ? OR contact_name LIKE ?)';
      countSql += ' AND (name LIKE ? OR contact_name LIKE ?)';
      params.push(`%${options.keyword}%`, `%${options.keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const countResult = await query<any[]>(countSql, params);
    const rows = await query<any[]>(sql, [...params, pageSize, offset]);

    return { list: rows, total: countResult[0]?.count || 0 };
  },

  async findAuthorized(): Promise<Tenant[]> {
    return query<any[]>("SELECT * FROM tenants WHERE authorization_status = 'authorized' AND status = 1");
  },

  async create(data: { name: string; contact_name?: string; contact_phone?: string }): Promise<number> {
    const result = await execute(
      'INSERT INTO tenants (name, contact_name, contact_phone) VALUES (?, ?, ?)',
      [data.name, data.contact_name, data.contact_phone]
    );
    return result.insertId;
  },

  async updateStatus(id: number, status: number): Promise<void> {
    await execute('UPDATE tenants SET status = ? WHERE id = ?', [status, id]);
  },

  async updateSyncStatus(id: number, syncStatus: string, error?: string): Promise<void> {
    await execute(
      'UPDATE tenants SET last_sync_status = ?, last_sync_error = ?, last_sync_at = NOW() WHERE id = ?',
      [syncStatus, error || null, id]
    );
  },

  async updateRefreshToken(id: number, appAuthToken: string, refreshToken: string, expiresAt: Date): Promise<void> {
    await execute(
      'UPDATE tenants SET app_auth_token = ?, refresh_token = ?, app_auth_token_expires_at = ? WHERE id = ?',
      [appAuthToken, refreshToken, expiresAt, id]
    );
  },

  async updateDeviceCount(id: number, count: number): Promise<void> {
    await execute('UPDATE tenants SET device_count = ? WHERE id = ?', [count, id]);
  },

  async getStats(): Promise<any> {
    const rows = await query<any[]>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN authorization_status = 'authorized' THEN 1 ELSE 0 END) as authorized,
        SUM(CASE WHEN authorization_status != 'authorized' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active
      FROM tenants
    `);
    return rows[0] || { total: 0, authorized: 0, pending: 0, active: 0 };
  },

  async update(id: number, data: { name?: string; contact_name?: string; contact_phone?: string }): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.contact_name !== undefined) { updates.push('contact_name = ?'); params.push(data.contact_name); }
    if (data.contact_phone !== undefined) { updates.push('contact_phone = ?'); params.push(data.contact_phone); }
    if (updates.length > 0) {
      params.push(id);
      await execute(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  },

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM tenants WHERE id = ?', [id]);
  },
};

// ============================================================
// 设备指标模型
// ============================================================
export const DeviceMetricsModel = {
  async findByTenantAndDate(
    tenantId: number,
    startDate: string,
    endDate: string,
    options?: {
      sn?: string;
      storeId?: string;
      provinceCode?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ list: DeviceMetric[]; total: number }> {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;
    
    let sql = 'SELECT * FROM device_metrics WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?';
    let countSql = 'SELECT COUNT(*) as count FROM device_metrics WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?';
    const params: any[] = [tenantId, startDate, endDate];

    if (options?.sn) {
      sql += ' AND sn LIKE ?';
      countSql += ' AND sn LIKE ?';
      params.push(`%${options.sn}%`);
    }
    if (options?.storeId) {
      sql += ' AND store_id = ?';
      countSql += ' AND store_id = ?';
      params.push(options.storeId);
    }
    if (options?.provinceCode) {
      sql += ' AND province_code = ?';
      countSql += ' AND province_code = ?';
      params.push(options.provinceCode);
    }

    sql += ' ORDER BY metrics_date DESC, id DESC LIMIT ? OFFSET ?';
    const countResult = await query<any[]>(countSql, params);
    const rows = await query<any[]>(sql, [...params, pageSize, offset]);

    return { list: rows, total: countResult[0]?.count || 0 };
  },

  async deleteByTenantAndDate(tenantId: number, metricsDate: string): Promise<void> {
    const formattedDate = metricsDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    await execute('DELETE FROM device_metrics WHERE tenant_id = ? AND metrics_date = ?', [tenantId, formattedDate]);
  },

  async batchInsert(data: Record<string, any>[]): Promise<number> {
    if (data.length === 0) return 0;
    
    const columns = Object.keys(data[0]);
    const values = data.map(row => columns.map(col => row[col]));
    
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO device_metrics (${columns.join(',')}) VALUES (${placeholders})`;
    
    await execute(sql, values.flat());
    return data.length;
  },

  async getDeviceCountByTenantId(tenantId: number): Promise<number> {
    const rows = await query<any[]>('SELECT COUNT(DISTINCT sn) as cnt FROM device_metrics WHERE tenant_id = ?', [tenantId]);
    return rows[0]?.cnt || 0;
  },

  async getDailySummary(tenantId: number, startDate: string, endDate: string): Promise<any[]> {
    return query<any[]>(`
      SELECT 
        metrics_date,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT sn) as device_count,
        SUM(nfc_amount) as nfc_amount,
        SUM(nfc_transaction_count) as nfc_count,
        SUM(refund_order_amt) as refund_amount
      FROM device_metrics
      WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?
      GROUP BY metrics_date
      ORDER BY metrics_date
    `, [tenantId, startDate, endDate]);
  },

  async getGlobalDailySummary(startDate: string, endDate: string): Promise<any[]> {
    return query<any[]>(`
      SELECT 
        metrics_date,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT CONCAT(tenant_id, sn)) as device_count
      FROM device_metrics
      WHERE metrics_date BETWEEN ? AND ?
      GROUP BY metrics_date
      ORDER BY metrics_date
    `, [startDate, endDate]);
  },

  async getStoreRanking(tenantId: number, startDate: string, endDate: string, limit = 10): Promise<any[]> {
    return query<any[]>(`
      SELECT 
        binding_location,
        store_id,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT sn) as device_count
      FROM device_metrics
      WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ? AND binding_location IS NOT NULL
      GROUP BY binding_location, store_id
      ORDER BY total_amount DESC
      LIMIT ?
    `, [tenantId, startDate, endDate, limit]);
  },

  async getProvinceStats(tenantId: number, startDate: string, endDate: string): Promise<any[]> {
    return query<any[]>(`
      SELECT 
        province_name,
        province_code,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT sn) as device_count
      FROM device_metrics
      WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ? AND province_name IS NOT NULL
      GROUP BY province_name, province_code
      ORDER BY total_amount DESC
    `, [tenantId, startDate, endDate]);
  },

  async getTenantRanking(startDate: string, endDate: string, limit = 10): Promise<any[]> {
    return query<any[]>(`
      SELECT 
        t.id,
        t.name,
        SUM(d.alipay_amount) as total_amount,
        SUM(d.alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT d.sn) as device_count
      FROM device_metrics d
      JOIN tenants t ON d.tenant_id = t.id
      WHERE d.metrics_date BETWEEN ? AND ?
      GROUP BY t.id, t.name
      ORDER BY total_amount DESC
      LIMIT ?
    `, [startDate, endDate, limit]);
  },
};

// ============================================================
// 同步日志模型
// ============================================================
export const SyncLogModel = {
  async create(tenantId: number, metricsDate: string): Promise<number> {
    const formattedDate = metricsDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    const result = await execute(
      'INSERT INTO sync_logs (tenant_id, metrics_date) VALUES (?, ?)',
      [tenantId, formattedDate]
    );
    return result.insertId;
  },

  async update(id: number, data: { status?: string; total_records?: number; synced_records?: number; error_message?: string; started_at?: string; finished_at?: string }): Promise<void> {
    const updates: string[] = [];
    const params: any[] = [];
    
    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.total_records !== undefined) {
      updates.push('total_records = ?');
      params.push(data.total_records);
    }
    if (data.synced_records !== undefined) {
      updates.push('synced_records = ?');
      params.push(data.synced_records);
    }
    if (data.error_message !== undefined) {
      updates.push('error_message = ?');
      params.push(data.error_message);
    }
    if (data.started_at) {
      updates.push('started_at = ?');
      params.push(data.started_at);
    }
    if (data.finished_at) {
      updates.push('finished_at = ?');
      params.push(data.finished_at);
    }
    
    if (updates.length > 0) {
      params.push(id);
      await execute(`UPDATE sync_logs SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  },

  async findByTenant(tenantId: number, limit = 30): Promise<SyncLog[]> {
    return query<any[]>(
      'SELECT * FROM sync_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
      [tenantId, limit]
    );
  },

  async findRecent(limit = 50): Promise<SyncLog[]> {
    return query<any[]>(
      `SELECT sl.*, t.name as tenant_name 
       FROM sync_logs sl 
       JOIN tenants t ON sl.tenant_id = t.id 
       ORDER BY sl.created_at DESC LIMIT ?`,
      [limit]
    );
  },
};

// ============================================================
// 管理员用户模型
// ============================================================
export const AdminUserModel = {
  async findByUsername(username: string): Promise<AdminUser | undefined> {
    const rows = await query<any[]>('SELECT * FROM admin_users WHERE username = ?', [username]);
    return rows[0];
  },

  async updateLastLogin(id: number): Promise<void> {
    await execute('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [id]);
  },
};
