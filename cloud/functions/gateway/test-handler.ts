// Gateway 云函数 - 统一的 API 入口
// 处理所有前端请求

import { createHmac, randomBytes } from 'crypto';

// ============================================================
// 数据库连接 (简化版，不依赖外部文件)
// ============================================================
let pool: any = null;

function getPool() {
  if (!pool) {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
      user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
      database: process.env.DB_DATABASE || process.env.MYSQL_DATABASE || 'alinfc',
      waitForConnections: true,
      connectionLimit: 3,
      queueLimit: 0,
    });
  }
  return pool;
}

async function query(sql: string, params: any[] = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function execute(sql: string, params: any[] = []) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

// ============================================================
// 工具函数
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'alinfc-secret-key-change-in-production';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '32-char-encryption-key-here!!!';

function generateToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): { valid: boolean; payload?: any } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    const [header, body, signature] = parts;
    const expectedSig = createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expectedSig) return { valid: false };
    return { valid: true, payload: JSON.parse(Buffer.from(body, 'base64url').toString()) };
  } catch {
    return { valid: false };
  }
}

function simpleHash(password: string): string {
  return createHmac('sha256', ENCRYPTION_KEY).update(password).digest('hex');
}

function parseBody(event: any): any {
  if (event.body) {
    if (event.isBase64Encoded) {
      return JSON.parse(Buffer.from(event.body, 'base64').toString());
    }
    return JSON.parse(event.body);
  }
  return {};
}

// ============================================================
// 认证处理
// ============================================================
async function adminLogin(body: { username: string; password: string }) {
  if (!body.username || !body.password) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: '用户名和密码不能为空' }) };
  }

  const rows = await query('SELECT * FROM admin_users WHERE username = ?', [body.username]);
  const user = rows[0];

  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: '用户名或密码错误' }) };
  }

  // 简单密码验证 (生产环境应使用 bcrypt)
  const passwordHash = simpleHash(body.password);
  if (user.password_hash !== passwordHash && user.password_hash !== body.password) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: '用户名或密码错误' }) };
  }

  if (user.status !== 1) {
    return { statusCode: 403, body: JSON.stringify({ success: false, message: '账号已被禁用' }) };
  }

  // 更新最后登录时间
  await execute('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天过期
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, real_name: user.real_name, role: 'admin' }
      }
    })
  };
}

async function tenantLogin(body: { tenantName: string; password: string }) {
  if (!body.tenantName || !body.password) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: '租户名称和密码不能为空' }) };
  }

  const rows = await query('SELECT * FROM tenants WHERE name = ?', [body.tenantName]);
  const tenant = rows[0];

  if (!tenant) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: '租户不存在' }) };
  }

  // 租户默认密码: 租户名 + "2024"
  const defaultPassword = body.tenantName + '2024';
  if (body.password !== defaultPassword && simpleHash(body.password) !== tenant.password_hash) {
    return { statusCode: 401, body: JSON.stringify({ success: false, message: '密码错误' }) };
  }

  if (tenant.status !== 1) {
    return { statusCode: 403, body: JSON.stringify({ success: false, message: '租户账号已被禁用' }) };
  }

  const token = generateToken({
    tenantId: tenant.id,
    tenantName: tenant.name,
    role: 'tenant',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        token,
        tenant: { id: tenant.id, name: tenant.name, contact_name: tenant.contact_name }
      }
    })
  };
}

// ============================================================
// 主 Handler
// ============================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

interface GatewayEvent {
  path: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string>;
  requestContext?: {
    http?: { path: string; method: string };
  };
}

export const handler = async (event: GatewayEvent): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}> => {
  try {
    // SCF API 网关事件格式兼容 - 使用 httpMethod 或 method
    const method = (event.httpMethod || event.requestContext?.http?.method || event.method || 'GET') as string;
    const path = (event.path || event.requestContext?.http?.path || '/') as string;
    
    console.log(`[GATEWAY] ${method} ${path}`);

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: CORS_HEADERS,
        body: '',
        isBase64Encoded: false,
      };
    }

    // 移除 /gateway 前缀
    let requestPath = path;
    if (requestPath.startsWith('/gateway')) {
      requestPath = requestPath.replace('/gateway', '') || '/';
    }

    const body = parseBody(event);

    // ============================================================
    // 路由处理
    // ============================================================

    // 健康检查
    if (requestPath === '/health' || requestPath === '/api/health') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        isBase64Encoded: false,
      };
    }

    // 管理员登录
    if (requestPath === '/api/auth/admin/login' && method === 'POST') {
      return {
        ...await adminLogin(body),
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        isBase64Encoded: false,
      };
    }

    // 租户登录
    if (requestPath === '/api/auth/tenant/login' && method === 'POST') {
      return {
        ...await tenantLogin(body),
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        isBase64Encoded: false,
      };
    }

    // 获取当前用户信息
    if (requestPath === '/api/auth/user' && method === 'GET') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      
      if (!token) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: '未登录' }),
          isBase64Encoded: false,
        };
      }

      const result = verifyToken(token);
      if (!result.valid) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: 'Token无效' }),
          isBase64Encoded: false,
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: true, data: result.payload }),
        isBase64Encoded: false,
      };
    }

    // 管理员接口 - 获取租户列表
    if (requestPath.match(/^\/api\/admin\/tenants$/) && method === 'GET') {
      const { page = 1, pageSize = 20, keyword = '', status, authStatus } = event.queryStringParameters || {};
      
      let sql = 'SELECT * FROM tenants WHERE 1=1';
      const params: any[] = [];

      if (keyword) {
        sql += ' AND (name LIKE ? OR contact_name LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }
      if (status !== undefined) {
        sql += ' AND status = ?';
        params.push(parseInt(status));
      }
      if (authStatus) {
        sql += ' AND authorization_status = ?';
        params.push(authStatus);
      }

      sql += ' ORDER BY created_at DESC';
      
      const countResult = await query('SELECT COUNT(*) as total FROM tenants WHERE 1=1' + 
        (keyword ? ' AND (name LIKE ? OR contact_name LIKE ?)' : '') +
        (status !== undefined ? ' AND status = ?' : '') +
        (authStatus ? ' AND authorization_status = ?' : ''),
        params
      );
      
      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      sql += ` LIMIT ${parseInt(pageSize)} OFFSET ${offset}`;
      
      const list = await query(sql, params);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: true, data: { list, total: countResult[0]?.total || 0 } }),
        isBase64Encoded: false,
      };
    }

    // 管理员概览
    if (requestPath === '/api/admin/overview' && method === 'GET') {
      const stats = await query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN authorization_status = 'authorized' THEN 1 ELSE 0 END) as authorized,
          SUM(CASE WHEN authorization_status != 'authorized' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as active
        FROM tenants
      `);

      const deviceCount = await query('SELECT COUNT(DISTINCT sn) as cnt FROM device_metrics');
      const recentSync = await query(`
        SELECT sl.*, t.name as tenant_name 
        FROM sync_logs sl 
        JOIN tenants t ON sl.tenant_id = t.id 
        ORDER BY sl.created_at DESC LIMIT 5
      `);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ 
          success: true, 
          data: {
            tenants: stats[0] || { total: 0, authorized: 0, pending: 0, active: 0 },
            deviceCount: deviceCount[0]?.cnt || 0,
            recentSync
          }
        }),
        isBase64Encoded: false,
      };
    }

    // 租户概览
    if (requestPath === '/api/tenant/info' && method === 'GET') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const result = verifyToken(token);
      
      if (!result.valid || result.payload.role !== 'tenant') {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: '未授权' }),
          isBase64Encoded: false,
        };
      }

      const tenants = await query('SELECT * FROM tenants WHERE id = ?', [result.payload.tenantId]);
      if (!tenants[0]) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: '租户不存在' }),
          isBase64Encoded: false,
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: true, data: tenants[0] }),
        isBase64Encoded: false,
      };
    }

    // 租户数据看板
    if (requestPath === '/api/tenant/dashboard' && method === 'GET') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const result = verifyToken(token);
      
      if (!result.valid || result.payload.role !== 'tenant') {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: '未授权' }),
          isBase64Encoded: false,
        };
      }

      const tenantId = result.payload.tenantId;
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');

      // 昨日汇总
      const [yesterdaySummary] = await query(`
        SELECT 
          COUNT(DISTINCT sn) as device_count,
          SUM(alipay_amount) as alipay_amount,
          SUM(alipay_transaction_count) as alipay_transaction_count,
          SUM(nfc_amount) as nfc_amount,
          SUM(be_turnon_device) as online_count,
          SUM(do_check_in) as checkin_count
        FROM device_metrics
        WHERE tenant_id = ? AND metrics_date = ?
      `, [tenantId, yesterday]);

      // 近30天每日汇总
      const dailySummary = await query(`
        SELECT 
          metrics_date,
          COUNT(DISTINCT sn) as device_count,
          COALESCE(SUM(alipay_amount), 0) as alipay_amount,
          COALESCE(SUM(alipay_transaction_count), 0) as alipay_transaction_count,
          COALESCE(SUM(nfc_amount), 0) as nfc_amount,
          SUM(be_turnon_device) as online_count,
          SUM(do_check_in) as checkin_count
        FROM device_metrics
        WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?
        GROUP BY metrics_date ORDER BY metrics_date
      `, [tenantId, startDate, today]);

      // 门店排行
      const storeRanking = await query(`
        SELECT store_id, binding_location as store_name,
          SUM(alipay_amount + nfc_amount) as total_amount,
          COUNT(DISTINCT sn) as device_count
        FROM device_metrics
        WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?
        GROUP BY store_id, binding_location
        ORDER BY total_amount DESC LIMIT 10
      `, [tenantId, startDate, today]);

      // 省份统计
      const provinceStats = await query(`
        SELECT province_name,
          SUM(alipay_amount + nfc_amount) as total_amount,
          COUNT(DISTINCT sn) as device_count
        FROM device_metrics
        WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?
        GROUP BY province_name
        ORDER BY total_amount DESC
      `, [tenantId, startDate, today]);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ 
          success: true, 
          data: { 
            yesterdaySummary: yesterdaySummary || { device_count: '0', alipay_amount: '0', alipay_transaction_count: '0', nfc_amount: '0', online_count: '0', checkin_count: '0' },
            dailySummary,
            storeRanking,
            provinceStats
          }
        }),
        isBase64Encoded: false,
      };
    }

    // 租户设备列表
    if (requestPath === '/api/tenant/devices' && method === 'GET') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const result = verifyToken(token);
      
      if (!result.valid || result.payload.role !== 'tenant') {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: '未授权' }),
          isBase64Encoded: false,
        };
      }

      const tenantId = result.payload.tenantId;
      const { startDate, endDate, sn, storeId, provinceCode, page = 1, pageSize = 20 } = event.queryStringParameters || {};

      let sql = 'SELECT * FROM device_metrics WHERE tenant_id = ?';
      const params: any[] = [tenantId];

      if (startDate) { sql += ' AND metrics_date >= ?'; params.push(startDate.replace(/-/g, '')); }
      if (endDate) { sql += ' AND metrics_date <= ?'; params.push(endDate.replace(/-/g, '')); }
      if (sn) { sql += ' AND sn LIKE ?'; params.push(`%${sn}%`); }
      if (storeId) { sql += ' AND store_id LIKE ?'; params.push(`%${storeId}%`); }

      sql += ' ORDER BY metrics_date DESC, sn';
      
      const countResult = await query('SELECT COUNT(*) as total FROM device_metrics WHERE tenant_id = ?' + 
        (startDate ? ' AND metrics_date >= ?' : '') +
        (endDate ? ' AND metrics_date <= ?' : '') +
        (sn ? ' AND sn LIKE ?' : '') +
        (storeId ? ' AND store_id LIKE ?' : ''),
        params
      );

      const offset = (parseInt(page) - 1) * parseInt(pageSize);
      sql += ` LIMIT ${parseInt(pageSize)} OFFSET ${offset}`;
      
      const list = await query(sql, params);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: true, data: { list, total: countResult[0]?.total || 0 } }),
        isBase64Encoded: false,
      };
    }

    // 租户统计数据
    if (requestPath === '/api/tenant/statistics' && method === 'GET') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const result = verifyToken(token);
      
      if (!result.valid || result.payload.role !== 'tenant') {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({ success: false, message: '未授权' }),
          isBase64Encoded: false,
        };
      }

      const tenantId = result.payload.tenantId;
      const { startDate, endDate } = event.queryStringParameters || {};
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
      const end = endDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');

      const stats = await query(`
        SELECT 
          SUM(alipay_amount + nfc_amount) as total_amount,
          SUM(alipay_transaction_count + nfc_transaction_count) as total_transactions,
          COUNT(DISTINCT sn) as device_count
        FROM device_metrics
        WHERE tenant_id = ? AND metrics_date BETWEEN ? AND ?
      `, [tenantId, start, end]);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ success: true, data: stats[0] || { total_amount: 0, total_transactions: 0, device_count: 0 } }),
        isBase64Encoded: false,
      };
    }

    // 未知路由
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: false, message: `Route not found: ${method} ${requestPath}` }),
      isBase64Encoded: false,
    };

  } catch (err) {
    const error = err as Error;
    console.error('[GATEWAY] Error:', error.message, error.stack);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      body: JSON.stringify({ success: false, message: error.message }),
      isBase64Encoded: false,
    };
  }
};
