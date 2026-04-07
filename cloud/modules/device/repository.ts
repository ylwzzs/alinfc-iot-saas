/**
 * 设备模块 - 数据访问层
 * 支持分表查询
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { db } from '../../core/database';
import type { DeviceMetric, DeviceListOptions, DailySummary, StoreRanking, ProvinceStats } from './types';

export class DeviceRepository {
  /**
   * 获取租户设备表名
   */
  private getTableName(tenantId: number): string {
    return `device_metrics_${tenantId}`;
  }

  /**
   * 分页查询设备数据（分表）
   */
  async findByTenantAndDate(
    tenantId: number,
    options: DeviceListOptions
  ): Promise<{ list: DeviceMetric[]; total: number }> {
    const { startDate, endDate, sn, storeId, provinceCode, cityCode, page = 1, pageSize = 20 } = options;
    const tableName = this.getTableName(tenantId);
    const offset = (page - 1) * pageSize;

    let sql = `SELECT * FROM ${tableName} WHERE metrics_date BETWEEN ? AND ?`;
    let countSql = `SELECT COUNT(*) as count FROM ${tableName} WHERE metrics_date BETWEEN ? AND ?`;
    const params: unknown[] = [startDate, endDate];

    if (sn) {
      sql += ' AND sn LIKE ?';
      countSql += ' AND sn LIKE ?';
      params.push(`%${sn}%`);
    }
    if (storeId) {
      sql += ' AND store_id = ?';
      countSql += ' AND store_id = ?';
      params.push(storeId);
    }
    if (provinceCode) {
      sql += ' AND province_code = ?';
      countSql += ' AND province_code = ?';
      params.push(provinceCode);
    }
    if (cityCode) {
      sql += ' AND city_code = ?';
      countSql += ' AND city_code = ?';
      params.push(cityCode);
    }

    sql += ' ORDER BY metrics_date DESC, id DESC LIMIT ? OFFSET ?';

    const countResult = await db.query<RowDataPacket[]>(countSql, params);
    const rows = await db.query<RowDataPacket[] & DeviceMetric[]>(sql, [...params, pageSize, offset]);

    return {
      list: rows,
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * 批量插入设备数据（分表）
   */
  async batchInsert(tenantId: number, data: Record<string, unknown>[]): Promise<number> {
    if (data.length === 0) return 0;

    const tableName = this.getTableName(tenantId);

    // 确保分表存在
    await db.ensureTenantTable(tenantId);

    const result = await db.bulkUpsert(tableName, data, [
      'alipay_amount', 'alipay_transaction_count', 'nfc_amount', 'nfc_transaction_count',
      'refund_order_amt', 'refund_order_cnt', 'real_refund_fee', 'real_consume_fee',
      'be_turnon_device', 'effective_turnon_device', 'do_check_in', 'synced_at',
    ]);

    return result.affectedRows;
  }

  /**
   * 删除指定日期数据（分表）
   */
  async deleteByDate(tenantId: number, metricsDate: string): Promise<void> {
    const tableName = this.getTableName(tenantId);
    await db.execute(`DELETE FROM ${tableName} WHERE metrics_date = ?`, [metricsDate]);
  }

  /**
   * 获取设备数量
   */
  async getDeviceCount(tenantId: number): Promise<number> {
    const tableName = this.getTableName(tenantId);
    try {
      const rows = await db.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT sn) as cnt FROM ${tableName}`
      );
      return rows[0]?.cnt || 0;
    } catch {
      return 0;
    }
  }

  /**
   * 获取日汇总数据
   */
  async getDailySummary(tenantId: number, startDate: string, endDate: string): Promise<DailySummary[]> {
    const tableName = this.getTableName(tenantId);
    return db.query<RowDataPacket[] & DailySummary[]>(`
      SELECT
        metrics_date,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT sn) as device_count,
        SUM(nfc_amount) as nfc_amount,
        SUM(nfc_transaction_count) as nfc_count,
        SUM(refund_order_amt) as refund_amount
      FROM ${tableName}
      WHERE metrics_date BETWEEN ? AND ?
      GROUP BY metrics_date
      ORDER BY metrics_date
    `, [startDate, endDate]);
  }

  /**
   * 获取门店排行
   */
  async getStoreRanking(tenantId: number, startDate: string, endDate: string, limit = 10): Promise<StoreRanking[]> {
    const tableName = this.getTableName(tenantId);
    return db.query<RowDataPacket[] & StoreRanking[]>(`
      SELECT
        binding_location,
        store_id,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT sn) as device_count
      FROM ${tableName}
      WHERE metrics_date BETWEEN ? AND ? AND binding_location IS NOT NULL
      GROUP BY binding_location, store_id
      ORDER BY total_amount DESC
      LIMIT ?
    `, [startDate, endDate, limit]);
  }

  /**
   * 获取省份统计
   */
  async getProvinceStats(tenantId: number, startDate: string, endDate: string): Promise<ProvinceStats[]> {
    const tableName = this.getTableName(tenantId);
    return db.query<RowDataPacket[] & ProvinceStats[]>(`
      SELECT
        province_name,
        province_code,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT sn) as device_count
      FROM ${tableName}
      WHERE metrics_date BETWEEN ? AND ? AND province_name IS NOT NULL
      GROUP BY province_name, province_code
      ORDER BY total_amount DESC
    `, [startDate, endDate]);
  }

  /**
   * 获取全局日汇总（管理员）
   */
  async getGlobalDailySummary(startDate: string, endDate: string): Promise<DailySummary[]> {
    return db.query<RowDataPacket[] & DailySummary[]>(`
      SELECT
        metrics_date,
        SUM(alipay_amount) as total_amount,
        SUM(alipay_transaction_count) as total_transactions,
        COUNT(DISTINCT CONCAT(tenant_id, '-', sn)) as device_count
      FROM device_metrics
      WHERE metrics_date BETWEEN ? AND ?
      GROUP BY metrics_date
      ORDER BY metrics_date
    `, [startDate, endDate]);
  }

  /**
   * 获取租户排行（管理员）
   */
  async getTenantRanking(startDate: string, endDate: string, limit = 10): Promise<any[]> {
    return db.query<RowDataPacket[]>(`
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
  }
}

export const deviceRepository = new DeviceRepository();
