/**
 * 租户模块 - 数据访问层
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../../core/database';
import {
  Tenant,
  TenantCreateInput,
  TenantUpdateInput,
  TenantListOptions,
  TenantStats,
  AuthorizationStatus,
  SyncStatus,
} from './types';

export class TenantRepository {
  /**
   * 根据 ID 查找租户
   */
  async findById(id: number): Promise<Tenant | undefined> {
    return db.queryOne<RowDataPacket & Tenant>(
      'SELECT * FROM tenants WHERE id = ?',
      [id]
    );
  }

  /**
   * 根据名称查找租户
   */
  async findByName(name: string): Promise<Tenant | undefined> {
    return db.queryOne<RowDataPacket & Tenant>(
      'SELECT * FROM tenants WHERE name = ?',
      [name]
    );
  }

  /**
   * 分页查询租户列表
   */
  async findAll(options: TenantListOptions): Promise<{ list: Tenant[]; total: number }> {
    const { page = 1, pageSize = 20, keyword, status, authStatus } = options;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM tenants WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM tenants WHERE 1=1';
    const params: unknown[] = [];

    if (status !== undefined) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(status);
    }

    if (authStatus) {
      sql += ' AND authorization_status = ?';
      countSql += ' AND authorization_status = ?';
      params.push(authStatus);
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR contact_name LIKE ?)';
      countSql += ' AND (name LIKE ? OR contact_name LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const countResult = await db.query<RowDataPacket[]>(countSql, params);
    const rows = await db.query<(RowDataPacket & Tenant)[]>(sql, [...params, pageSize, offset]);

    return {
      list: rows,
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * 查找已授权的租户
   */
  async findAuthorized(): Promise<Tenant[]> {
    return db.query<RowDataPacket[] & Tenant[]>(
      "SELECT * FROM tenants WHERE authorization_status = 'authorized' AND status = 1"
    );
  }

  /**
   * 创建租户
   */
  async create(data: TenantCreateInput): Promise<number> {
    const result = await db.execute(
      'INSERT INTO tenants (name, contact_name, contact_phone) VALUES (?, ?, ?)',
      [data.name, data.contact_name || null, data.contact_phone || null]
    );
    return result.insertId;
  }

  /**
   * 更新租户信息
   */
  async update(id: number, data: TenantUpdateInput): Promise<void> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.contact_name !== undefined) {
      updates.push('contact_name = ?');
      params.push(data.contact_name);
    }
    if (data.contact_phone !== undefined) {
      updates.push('contact_phone = ?');
      params.push(data.contact_phone);
    }

    if (updates.length > 0) {
      params.push(id);
      await db.execute(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  }

  /**
   * 更新租户状态
   */
  async updateStatus(id: number, status: number): Promise<void> {
    await db.execute('UPDATE tenants SET status = ? WHERE id = ?', [status, id]);
  }

  /**
   * 更新授权状态
   */
  async updateAuthStatus(
    id: number,
    status: AuthorizationStatus,
    options?: { authorizedAt?: Date }
  ): Promise<void> {
    const sql = options?.authorizedAt
      ? 'UPDATE tenants SET authorization_status = ?, authorized_at = ? WHERE id = ?'
      : 'UPDATE tenants SET authorization_status = ? WHERE id = ?';

    const params = options?.authorizedAt
      ? [status, options.authorizedAt, id]
      : [status, id];

    await db.execute(sql, params);
  }

  /**
   * 更新授权 Token
   */
  async updateAuthToken(
    id: number,
    appAuthToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    await db.execute(
      'UPDATE tenants SET app_auth_token = ?, refresh_token = ?, app_auth_token_expires_at = ? WHERE id = ?',
      [appAuthToken, refreshToken, expiresAt, id]
    );
  }

  /**
   * 更新同步状态
   */
  async updateSyncStatus(id: number, syncStatus: SyncStatus, error?: string): Promise<void> {
    await db.execute(
      'UPDATE tenants SET last_sync_status = ?, last_sync_error = ?, last_sync_at = NOW() WHERE id = ?',
      [syncStatus, error || null, id]
    );
  }

  /**
   * 更新设备数量
   */
  async updateDeviceCount(id: number, count: number): Promise<void> {
    await db.execute('UPDATE tenants SET device_count = ? WHERE id = ?', [count, id]);
  }

  /**
   * 获取租户统计
   */
  async getStats(): Promise<TenantStats> {
    const rows = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN authorization_status = 'authorized' THEN 1 ELSE 0 END) as authorized,
        SUM(CASE WHEN authorization_status != 'authorized' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active
      FROM tenants
    `);
    return rows[0] as TenantStats;
  }

  /**
   * 删除租户
   */
  async delete(id: number): Promise<void> {
    await db.execute('DELETE FROM tenants WHERE id = ?', [id]);
  }
}

export const tenantRepository = new TenantRepository();
