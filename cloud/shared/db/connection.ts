import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
      database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'alinfc',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 30000,
    });
  }
  return pool;
}

// 将数字转换为字符串，避免 mysql2 execute bug
function normalizeParams(params?: any[]): any[] {
  if (!params) return [];
  return params.map(p => typeof p === 'number' ? String(p) : p);
}

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  params?: any[]
): Promise<T> {
  const p = getPool();
  const normalizedParams = normalizeParams(params);
  const [rows] = await p.execute<T>(sql, normalizedParams);
  return rows;
}

export async function execute(
  sql: string,
  params?: any[]
): Promise<ResultSetHeader> {
  const p = getPool();
  const normalizedParams = normalizeParams(params);
  const [result] = await p.execute<ResultSetHeader>(sql, normalizedParams);
  return result;
}

export async function batchInsert(
  table: string,
  columns: string[],
  rows: any[][]
): Promise<number> {
  if (rows.length === 0) return 0;
  const p = getPool();
  const placeholders = columns.map(() => '?').join(',');
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
  const normalizedRows = rows.map(row => row.map(v => typeof v === 'number' ? String(v) : v));
  const [result] = await p.execute<ResultSetHeader>(sql, normalizedRows.flat());
  return result.affectedRows;
}

export async function transaction<T>(
  callback: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const p = getPool();
  const conn = await p.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
