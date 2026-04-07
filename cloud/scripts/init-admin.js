# 支付宝 IoT 数据分析 SaaS 系统 - 管理员配置脚本

# 使用前请先安装依赖
# cd cloud && npm install

# 导入环境变量（可选）
# source ../.env

# 使用 Node.js 直接调用初始化函数
node -e "
const crypto = require('crypto');
const mysql = require('mysql2/promise');

function simpleHash(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return '\$simple\$' + salt + '\$' + hash;
}

async function initAdmin() {
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alinfc',
    charset: 'utf8mb4',
  };

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const name = process.env.ADMIN_NAME || '系统管理员';

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功');

    const [existing] = await connection.execute(
      'SELECT id FROM admin_users WHERE username = ?',
      [username]
    );

    const hashedPassword = simpleHash(password);

    if (existing.length > 0) {
      await connection.execute(
        'UPDATE admin_users SET password = ?, name = ?, status = 1 WHERE username = ?',
        [hashedPassword, name, username]
      );
      console.log('管理员密码已更新');
    } else {
      await connection.execute(
        'INSERT INTO admin_users (username, password, name, role, status, created_at) VALUES (?, ?, ?, ?, 1, NOW())',
        [username, hashedPassword, name, 'admin']
      );
      console.log('管理员账号创建成功');
    }

    console.log('用户名:', username);
    console.log('密码:', password);
    console.log('请立即修改默认密码！');

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initAdmin();
"
