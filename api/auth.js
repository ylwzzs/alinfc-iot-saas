/**
 * 认证 API - 简化版本
 */
module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const path = req.url?.split('?')[0] || '';
  console.log('Auth request:', req.method, path);

  // 管理员登录
  if (path === '/api/auth/admin/login' && req.method === 'POST') {
    try {
      const { username, password } = req.body || {};

      console.log('Login attempt:', { username, hasPassword: !!password });

      if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
      }

      // 动态加载依赖
      const { createClient } = require('@supabase/supabase-js');
      const bcrypt = require('bcryptjs');
      const jwt = require('jsonwebtoken');

      const supabaseUrl = process.env.mytech_SUPABASE_URL;
      const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;
      const JWT_SECRET = process.env.JWT_SECRET || 'alinfc-default-secret-2024';

      console.log('Supabase URL:', supabaseUrl ? 'set' : 'missing');

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: '数据库配置缺失' });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: users, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .limit(1);

      if (error) {
        console.error('DB error:', error);
        return res.status(500).json({ success: false, message: '数据库查询失败' });
      }

      if (!users?.length) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      const user = users[0];
      if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ success: false, message: '用户名或密码错误' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: { id: user.id, username: user.username, realName: user.real_name }
        }
      });
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 租户登录
  if (path === '/api/auth/tenant/login' && req.method === 'POST') {
    try {
      const { tenantName, password } = req.body || {};

      if (!tenantName || !password) {
        return res.status(400).json({ success: false, message: '租户名和密码不能为空' });
      }

      const { createClient } = require('@supabase/supabase-js');
      const jwt = require('jsonwebtoken');

      const supabaseUrl = process.env.mytech_SUPABASE_URL;
      const supabaseKey = process.env.mytech_SUPABASE_SERVICE_ROLE_KEY;
      const JWT_SECRET = process.env.JWT_SECRET || 'alinfc-default-secret-2024';

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ success: false, message: '数据库配置缺失' });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('name', tenantName)
        .limit(1);

      if (error) {
        console.error('DB error:', error);
        return res.status(500).json({ success: false, message: '数据库查询失败' });
      }

      if (!tenants?.length) {
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

      const token = jwt.sign(
        { id: tenant.id, username: tenant.name, role: 'tenant', tenantId: tenant.id },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        success: true,
        data: { token, tenant: { id: tenant.id, name: tenant.name } }
      });
    } catch (err) {
      console.error('Tenant login error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  // 获取当前用户
  if (path === '/api/auth/user' && req.method === 'GET') {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ success: false, message: '未登录' });
      }

      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'alinfc-default-secret-2024';
      const payload = jwt.verify(token, JWT_SECRET);
      return res.json({ success: true, data: payload });
    } catch (err) {
      return res.status(401).json({ success: false, message: '登录已过期' });
    }
  }

  return res.status(404).json({ success: false, message: '接口不存在' });
};
