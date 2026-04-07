/**
 * 同步模块 - 数据访问层
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../../core/database';
import type { SyncCheckpoint, SyncLog, SyncStatus } from './types';

export class SyncRepository {
  /**
   * 获取同步断点
   */
  async getCheckpoint(tenantId: number, metricsDate: string): Promise<SyncCheckpoint | undefined> {
    return db.queryOne<RowDataPacket & SyncCheckpoint>(
      'SELECT * FROM sync_checkpoints WHERE tenant_id = ? AND metrics_date = ?',
      [tenantId, metricsDate]
    );
  }

  /**
   * 创建同步断点
   */
  async createCheckpoint(tenantId: number, metricsDate: string): Promise<number> {
    const result = await db.execute(
      `INSERT INTO sync_checkpoints (tenant_id, metrics_date, status, started_at)
       VALUES (?, ?, 'running', NOW())
       ON DUPLICATE KEY UPDATE status = 'running', started_at = NOW(), last_page = 0`,
      [tenantId, metricsDate]
    );
    return result.insertId;
  }

  /**
   * 更新同步断点
   */
  async updateCheckpoint(
    tenantId: number,
    metricsDate: string,
    data: {
      lastPage?: number;
      totalPages?: number;
      totalRecords?: number;
      syncedRecords?: number;
      status?: SyncStatus;
      errorMessage?: string;
    }
  ): Promise<void> {
    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    if (data.lastPage !== undefined) {
      updates.push('last_page = ?');
      params.push(data.lastPage);
    }
    if (data.totalPages !== undefined) {
      updates.push('total_pages = ?');
      params.push(data.totalPages);
    }
    if (data.totalRecords !== undefined) {
      updates.push('total_records = ?');
      params.push(data.totalRecords);
    }
    if (data.syncedRecords !== undefined) {
      updates.push('synced_records = ?');
      params.push(data.syncedRecords);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
      if (data.status === 'completed' || data.status === 'failed') {
        updates.push('finished_at = NOW()');
      }
    }
    if (data.errorMessage !== undefined) {
      updates.push('error_message = ?');
      params.push(data.errorMessage);
    }

    params.push(tenantId, metricsDate);
    await db.execute(
      `UPDATE sync_checkpoints SET ${updates.join(', ')} WHERE tenant_id = ? AND metrics_date = ?`,
      params
    );
  }

  /**
   * 获取正在进行的同步任务
   */
  async getRunningTasks(): Promise<SyncCheckpoint[]> {
    return db.query<RowDataPacket[] & SyncCheckpoint[]>(
      "SELECT * FROM sync_checkpoints WHERE status = 'running'"
    );
  }

  /**
   * 获取失败的同步任务
   */
  async getFailedTasks(limit = 10): Promise<SyncCheckpoint[]> {
    return db.query<RowDataPacket[] & SyncCheckpoint[]>(
      "SELECT * FROM sync_checkpoints WHERE status = 'failed' ORDER BY updated_at DESC LIMIT ?",
      [limit]
    );
  }

  // ==================== 同步日志 ====================

  /**
   * 创建同步日志
   */
  async createSyncLog(tenantId: number, metricsDate: string): Promise<number> {
    const result = await db.execute(
      'INSERT INTO sync_logs (tenant_id, metrics_date) VALUES (?, ?)',
      [tenantId, metricsDate]
    );
    return result.insertId;
  }

  /**
   * 更新同步日志
   */
  async updateSyncLog(
    id: number,
    data: {
      status?: string;
      totalRecords?: number;
      syncedRecords?: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.totalRecords !== undefined) {
      updates.push('total_records = ?');
      params.push(data.totalRecords);
    }
    if (data.syncedRecords !== undefined) {
      updates.push('synced_records = ?');
      params.push(data.syncedRecords);
    }
    if (data.errorMessage !== undefined) {
      updates.push('error_message = ?');
      params.push(data.errorMessage);
    }
    if (data.status === 'success' || data.status === 'failed') {
      updates.push('finished_at = NOW()');
    }

    if (updates.length > 0) {
      params.push(id);
      await db.execute(`UPDATE sync_logs SET ${updates.join(', ')} WHERE id = ?`, params);
    }
  }

  /**
   * 获取租户同步日志
   */
  async getSyncLogsByTenant(tenantId: number, limit = 30): Promise<SyncLog[]> {
    return db.query<RowDataPacket[] & SyncLog[]>(
      'SELECT * FROM sync_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?',
      [tenantId, limit]
    );
  }

  /**
   * 获取最近同步日志
   */
  async getRecentSyncLogs(limit = 50): Promise<(SyncLog & { tenant_name: string })[]> {
    return db.query<RowDataPacket[] & (SyncLog & { tenant_name: string })[]>(
      `SELECT sl.*, t.name as tenant_name
       FROM sync_logs sl
       JOIN tenants t ON sl.tenant_id = t.id
       ORDER BY sl.created_at DESC LIMIT ?`,
      [limit]
    );
  }
}

export const syncRepository = new SyncRepository();
