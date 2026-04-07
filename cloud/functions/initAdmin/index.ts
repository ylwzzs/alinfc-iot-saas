/**
 * 初始化管理员账号云函数
 * 用法：tcb fn invoke initAdmin --envId YOUR_ENV_ID
 */
import * as crypto from 'crypto';
import mysql from 'mysql2/promise';

// 简单的 bcrypt 替代方案（用于初始化）
function simpleHash(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `$simple$${salt}$${hash}`;
}

export async function main(ctx: any) {
  console.log('开始初始化管理员账号...');

  // 从环境变量获取配置
  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
  };

  const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const defaultAdminName = process.env.ADMIN_NAME || '系统管理员';

  let connection: any = null;

  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    // 检查管理员账号是否已存在
    const [existing] = await connection.execute(
      'SELECT id FROM admin_users WHERE username = ?',
      [defaultAdminUsername]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      // 更新现有管理员密码
      const hashedPassword = simpleHash(defaultAdminPassword);
      await connection.execute(
        'UPDATE admin_users SET password = ?, name = ?, role = ?, status = 1 WHERE username = ?',
        [hashedPassword, defaultAdminName, 'admin', defaultAdminUsername]
      );
      console.log(`管理员账号 ${defaultAdminUsername} 密码已更新`);

      return {
        success: true,
        message: `管理员账号 ${defaultAdminUsername} 密码已更新`,
        username: defaultAdminUsername,
      };
    } else {
      // 创建新管理员
      const hashedPassword = simpleHash(defaultAdminPassword);
      await connection.execute(
        'INSERT INTO admin_users (username, password, name, role, status, created_at) VALUES (?, ?, ?, ?, 1, NOW())',
        [defaultAdminUsername, hashedPassword, defaultAdminName, 'admin']
      );
      console.log(`管理员账号 ${defaultAdminUsername} 创建成功`);

      return {
        success: true,
        message: `管理员账号 ${defaultAdminUsername} 创建成功`,
        username: defaultAdminUsername,
        password: defaultAdminPassword,
        warning: '请立即修改默认密码！',
      };
    }
  } catch (error: any) {
    console.error('初始化管理员失败:', error);
    return {
      success: false,
      error: error.message,
      hint: '请检查数据库连接和环境变量配置',
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
