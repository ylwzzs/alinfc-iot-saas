/**
 * 数据库连接池模块
 * 支持：连接池管理、分表路由、事务
 */
import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { config } from '../config';
import { logger } from '../logger';

class DatabaseManager {
  private pool: Pool;
  private metricsTableCache: Map<number, boolean> = new Map();

  constructor() {
    this.pool = mysql.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.database,
      connectionLimit: config.database.connectionLimit,
      timezone: config.database.timezone,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });

    logger.info('DATABASE', `连接池已创建，最大连接数: ${config.database.connectionLimit}`);
  }

  /**
   * 获取连接
   */
  async getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  /**
   * 执行查询
   */
  async query<T extends RowDataPacket[]>(sql: string, params?: unknown[]): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);
    return rows;
  }

  /**
   * 执行单条查询
   */
  async queryOne<T extends RowDataPacket>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T[]>(sql, params);
    return rows[0];
  }

  /**
   * 执行增删改
   */
  async execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params as any[]);
    return result;
  }

  /**
   * 批量插入（高性能）
   */
  async bulkInsert(table: string, data: Record<string, unknown>[]): Promise<ResultSetHeader> {
    if (data.length === 0) {
      return { affectedRows: 0, insertId: 0 } as ResultSetHeader;
    }

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(',');
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;

    const values = data.map(row => columns.map(col => row[col]));

    const [result] = await this.pool.query<ResultSetHeader>(sql, [values.flat()]);
    return result;
  }

  /**
   * 批量插入或更新（ON DUPLICATE KEY UPDATE）
   */
  async bulkUpsert(
    table: string,
    data: Record<string, unknown>[],
    updateFields: string[]
  ): Promise<ResultSetHeader> {
    if (data.length === 0) {
      return { affectedRows: 0, insertId: 0 } as ResultSetHeader;
    }

    const columns = Object.keys(data[0]);
    const placeholders = columns.map(() => '?').join(',');
    const updateClause = updateFields
      .filter(f => columns.includes(f))
      .map(f => `${f} = VALUES(${f})`)
      .join(', ');

    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) ${
      updateClause ? `ON DUPLICATE KEY UPDATE ${updateClause}` : ''
    }`;

    const values = data.map(row => columns.map(col => row[col]));

    const [result] = await this.pool.query<ResultSetHeader>(sql, [values.flat()]);
    return result;
  }

  /**
   * 事务执行
   */
  async transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await this.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * 获取租户设备指标表名
   */
  getMetricsTable(tenantId: number): string {
    return `device_metrics_${tenantId}`;
  }

  /**
   * 确保租户分表存在
   */
  async ensureTenantTable(tenantId: number): Promise<void> {
    if (this.metricsTableCache.has(tenantId)) return;

    const tableName = this.getMetricsTable(tenantId);

    // 检查表是否存在
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [config.database.database, tableName]
    );

    if (rows.length === 0) {
      // 创建分表
      await this.pool.execute(`
        CREATE TABLE ${tableName} LIKE device_metrics_template
      `);
      logger.info('DATABASE', `租户分表已创建: ${tableName}`);
    }

    this.metricsTableCache.set(tenantId, true);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end();
    logger.info('DATABASE', '连接池已关闭');
  }
}

export const db = new DatabaseManager();
export default db;
