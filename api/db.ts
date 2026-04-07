/**
 * 数据库连接配置
 * 支持 Vercel Postgres 和 MySQL
 */
import { sql } from '@vercel/postgres';

// 检测是否使用 Vercel Postgres
const USE_POSTGRES = !!process.env.POSTGRES_URL;

// MySQL 配置
const mysqlConfig = {
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME || 'alinfc',
};

// 通用查询函数
export async function query<T>(sqlQuery: string, params: any[] = []): Promise<T[]> {
  if (USE_POSTGRES) {
    // Vercel Postgres
    const result = await sql.query(sqlQuery, params);
    return result.rows as T[];
  } else {
    // MySQL
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection(mysqlConfig);
    try {
      const [rows] = await connection.execute(sqlQuery, params);
      return rows as T[];
    } finally {
      await connection.end();
    }
  }
}

// 通用执行函数
export async function execute(sqlQuery: string, params: any[] = []): Promise<void> {
  if (USE_POSTGRES) {
    await sql.query(sqlQuery, params);
  } else {
    const mysql = await import('mysql2/promise');
    const connection = await mysql.createConnection(mysqlConfig);
    try {
      await connection.execute(sqlQuery, params);
    } finally {
      await connection.end();
    }
  }
}

// 健康检查
export async function ping(): Promise<boolean> {
  try {
    if (USE_POSTGRES) {
      await sql`SELECT 1`;
    } else {
      const mysql = await import('mysql2/promise');
      const connection = await mysql.createConnection(mysqlConfig);
      await connection.ping();
      await connection.end();
    }
    return true;
  } catch {
    return false;
  }
}
