/**
 * 认证 API
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.mytech_SUPABASE_URL;
const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';

function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const supabase = createClient(supabaseUrl!, supabaseKey!);
  const path = req.url?.split('?')[0] || '';

  try {
    // 管理员登录
    if (path === '/api/auth/admin/login' && req.method === 'POST') {
      const { username, password } = req.body as any;

      if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      }

      const { data: users, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (error || !users?.length) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      const user = users[0];
      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      if (user.status !== 1) {
        return res.status(403).json({ success: false, message: '账号已被禁用' });
      }

      await supabase.from('admin_users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

      const token = jwt.sign({ id: user.id, username: user.username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });

      return res.json({
        success: true,
        data: { token, user: { id: user.id, username: user.username, realName: user.real_name } }
      });
    }

    // 租户登录
    if (path === '/api/auth/tenant/login' && req.method === 'POST') {
      const { tenantName, password } = req.body as any;

      if (!tenantName || !password) {
        return res.status(400).json({ success: false, message: '租户名和密码不能为空' });
      }

      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('name', tenantName)
        .limit(1);

      if (error || !tenants?.length) {
        return res.status(401).json({ success: false, message: '租户不存在' });
      }

      const tenant = tenants[0];
      if (tenant.authorization_status !== 'authorized') {
        return res.status(403).json({ success: false, message: '租户尚未授权' });
      }

      if (tenant.status !== 1) {
        return res.status(403).json({ success: false, message: '租户已被禁用' });
      }

      const validPassword = password === tenant.name + '2024' || password === tenant.name;
      if (!validPassword) {
        return res.status(401).json({ success: false, message: '密码错误' });
      }

      const token = jwt.sign({ id: tenant.id, username: tenant.name, role: 'tenant', tenantId: tenant.id }, JWT_SECRET, { expiresIn: '7d' });

      return res.json({
        success: true,
        data: { token, tenant: { id: tenant.id, name: tenant.name } }
      });
    }

    // 获取当前用户
    if (path === '/api/auth/user' && req.method === 'GET') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: '未登录' });
      }

      try {
        const payload = jwt.verify(token, JWT_SECRET);
        return res.json({ success: true, data: payload });
      } catch {
        return res.status(401).json({ success: false, message: '登录已过期' });
      }
    }

    return res.status(404).json({ success: false, message: '接口不存在' });

  } catch (error: any) {
    console.error('Auth Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
