import postgres from 'postgres';
import { config } from 'dotenv';

config();

const POSTGRES_URL = process.env.mytech_POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error('Missing POSTGRES_URL');
  process.exit(1);
}

const sql = postgres(POSTGRES_URL);

async function init() {
  try {
    console.log('Creating tables...');

    // 管理员用户表
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(50),
        status SMALLINT DEFAULT 1,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ admin_users table created');

    // 插入初始管理员
    await sql`
      INSERT INTO admin_users (username, password, real_name)
      VALUES ('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员')
      ON CONFLICT (username) DO NOTHING
    `;
    console.log('✅ Admin user created');

    // 租户表
    await sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        contact_name VARCHAR(50),
        contact_phone VARCHAR(20),
        authorization_status VARCHAR(20) DEFAULT 'pending',
        device_count INT DEFAULT 0,
        status SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ tenants table created');

    // 设备表
    await sql`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        tenant_id INT NOT NULL REFERENCES tenants(id),
        sn VARCHAR(50) NOT NULL,
        store_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ devices table created');

    // 同步日志表
    await sql`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INT NOT NULL REFERENCES tenants(id),
        metrics_date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ sync_logs table created');

    // 验证表是否创建成功
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    console.log('\n📋 Created tables:', tables.map(t => t.table_name).join(', '));

    console.log('\n🎉 Database initialized successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

init();
