/**
 * Vercel Serverless Function - 健康检查
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ping } from './db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // 检查数据库连接
  let dbStatus = 'ok';
  try {
    const ok = await ping();
    if (!ok) dbStatus = 'error: connection failed';
  } catch (error: any) {
    dbStatus = 'error: ' + error.message;
  }

  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    database: process.env.POSTGRES_URL ? 'postgres' : 'mysql',
    services: {
      database: dbStatus,
    },
  });
}
