# 支付宝 IoT 设备数据分析 SaaS 系统

[![CI/CD](https://github.com/your-org/alinfc/actions/workflows/deploy.yml/badge.svg)](https://github.com/your-org/alinfc/actions/workflows/deploy.yml)

## 项目概述

支付宝 IoT 设备数据多租户 SaaS 分析平台，支持：
- 多租户隔离与独立授权
- 设备数据分表存储
- 断点续传数据同步
- 功能模块化与开关控制
- 完整的 CI/CD 流水线
- 监控告警系统

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                    前端层 (React + Vite)                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Dashboard│ │ Devices │ │Analytics│ │ Export  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                    API 网关层 (Koa)                          │
│  认证鉴权 │ 租户识别 │ 功能开关 │ 限流熔断 │ 监控指标        │
└─────────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                    业务服务层                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │ Tenant  │ │ Device  │ │  Sync   │ │ Export  │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │  Auth   │ │ Module  │ │ Monitor │                       │
│  └─────────┘ └─────────┘ └─────────┘                       │
└─────────────────────────────────────────────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    ▼                      ▼                      ▼
┌─────────┐          ┌─────────┐          ┌─────────┐
│  MySQL  │          │  Redis  │          │   OSS   │
│ (分表)   │          │ (缓存)  │          │ (文件)  │
└─────────┘          └─────────┘          └─────────┘
```

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm run install:all

# 复制环境配置
cp .env.development .env.local
# 编辑 .env.local 填入实际配置
```

### 2. 启动本地服务

```bash
# 启动 MySQL 和 Redis
docker-compose up -d mysql redis

# 初始化数据库
mysql -u root -p < cloud/shared/db/migrations/001_init.sql
mysql -u root -p < cloud/shared/db/migrations/002_modules.sql

# 启动后端
cd cloud && npm run local

# 启动前端
cd web && npm run dev
```

### 3. 访问系统

- 前端地址: http://localhost:5173
- API 地址: http://localhost:3000/api
- 管理员默认账号: `admin` / `admin123`

## 核心功能

### 租户管理
- 租户创建、编辑、启用/禁用
- 支付宝授权链接生成
- 独立数据分表

### 功能模块
| 模块 | 功能 | 是否核心 |
|------|------|---------|
| dashboard | 数据大屏 | ✅ |
| devices | 设备管理 | ✅ |
| sync | 数据同步 | ✅ |
| analytics | 数据分析 | ❌ |
| export | 报表导出 | ❌ |

### 数据同步
- 定时同步：每日凌晨 2:00
- 断点续传：失败自动恢复
- 批量写入：1000 条/批次
- 失败重试：指数退避

## 运维指南

### 健康检查

```bash
# 基础健康检查
curl http://localhost:3000/api/monitor/health

# 详细状态
curl http://localhost:3000/api/monitor/status

# K8s 探针
curl http://localhost:3000/api/monitor/ready  # 就绪探针
curl http://localhost:3000/api/monitor/live   # 存活探针
```

### 数据备份

```bash
# 全量备份
./scripts/backup.sh

# 单租户备份
./scripts/backup.sh 123
```

### 部署

```bash
# 部署到开发环境
./scripts/deploy.sh dev

# 部署到生产环境
./scripts/deploy.sh prod
```

### 监控告警

配置环境变量：
```bash
DINGTALK_WEBHOOK=https://oapi.dingtalk.com/robot/send?access_token=xxx
WECOM_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

预置告警规则：
- 数据同步失败（连续 3 次）
- API 错误率 > 5%
- API 响应时间 > 3s
- 内存使用 > 80%

## 项目结构

```
alinfc/
├── cloud/                      # 后端服务
│   ├── core/                   # 核心模块
│   │   ├── config/            # 配置管理
│   │   ├── database/          # 数据库连接池
│   │   ├── cache/             # Redis 缓存
│   │   ├── queue/             # 任务队列
│   │   ├── logger/            # 日志系统
│   │   └── middleware/        # 中间件
│   │
│   ├── modules/                # 业务模块
│   │   ├── tenant/            # 租户管理
│   │   ├── device/            # 设备数据
│   │   ├── sync/              # 数据同步
│   │   ├── auth/              # 授权管理
│   │   ├── export/            # 报表导出
│   │   ├── module-manager/    # 功能开关
│   │   └── monitor/           # 监控告警
│   │
│   └── shared/                 # 共享代码
│       ├── alipay/            # 支付宝 SDK
│       └── db/                # 数据库迁移
│
├── web/                        # 前端应用
│   └── src/
│       ├── api/               # API 请求
│       ├── pages/             # 页面组件
│       ├── layouts/           # 布局组件
│       └── store/             # 状态管理
│
├── scripts/                    # 脚本
│   ├── backup.sh              # 数据库备份
│   └── deploy.sh              # 部署脚本
│
├── .github/workflows/          # CI/CD
│   └── deploy.yml
│
├── docker-compose.yml          # 本地开发环境
└── Dockerfile                  # 生产镜像
```

## API 文档

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/admin/login | 管理员登录 |
| POST | /api/auth/tenant/login | 租户登录 |
| GET | /api/auth/user | 获取当前用户 |

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/tenants | 租户列表 |
| POST | /api/admin/tenants | 创建租户 |
| PUT | /api/admin/tenants/:id | 更新租户 |
| GET | /api/admin/modules | 系统模块列表 |
| POST | /api/admin/modules/tenant/:id/enable | 启用模块 |
| POST | /api/admin/sync/all | 触发全量同步 |

### 租户接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tenant/dashboard | Dashboard 数据 |
| GET | /api/tenant/devices | 设备列表 |
| GET | /api/tenant/analytics | 数据分析 |
| POST | /api/tenant/export | 创建导出任务 |

## 开发指南

### 添加新模块

1. 创建模块目录 `cloud/modules/xxx/`
2. 定义类型 `types.ts`
3. 实现数据层 `repository.ts`
4. 实现业务层 `service.ts`
5. 定义路由 `routes.ts`
6. 在 `index.ts` 中注册路由

### 添加新功能开关

```typescript
// 在 modules/module-manager/types.ts 中添加
{
  id: 'new-feature',
  name: '新功能',
  version: '1.0.0',
  permissions: ['tenant:new-feature:view'],
  is_core: false,
  status: 'active',
}
```

## 许可证

MIT
