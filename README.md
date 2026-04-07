# 支付宝 IoT 数据分析 SaaS 系统

一个完整的支付宝 IoT 设备数据多租户 SaaS 分析平台，支持租户管理、数据同步、报表导出等功能。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Ant Design + Zustand
- **后端**: Koa + TypeScript + MySQL + Redis
- **部署**: 腾讯云 CloudBase + Docker
- **监控**: Sentry 错误追踪

## 部署状态

### ✅ 已部署到 CloudBase

| 服务 | 状态 | 说明 |
|------|------|------|
| 前端静态网站 | ✅ 已部署 | https://alinfc-1gqk3fty54919e7a-1332643701.tcloudbaseapp.com |
| gateway 云函数 | ✅ 已部署 | API 网关 |
| authCallback 云函数 | ✅ 已部署 | 支付宝授权回调 |
| dataSync 云函数 | ✅ 已部署 | 定时数据同步（每日凌晨 2:00） |
| initAdmin 云函数 | ✅ 已部署 | 管理员初始化 |

## 快速开始

```bash
# 克隆项目
git clone <repository-url>
cd alinfc

# 安装依赖
npm run install:all

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写实际配置

# 启动后端服务
npm run dev:cloud

# 启动前端服务（新终端）
npm run dev:web
```

## 主要功能

### 管理员后台
- 租户管理（创建、编辑、启用/禁用、删除）
- 授权链接生成
- 全局数据概览
- 同步状态监控
- 模块管理

### 租户端
- 数据大屏
- 设备数据列表
- 图表分析
- 报表导出（Excel/PDF/Word）
- 同步状态

## 项目结构

```
alinfc/
├── cloud/                  # 后端服务
│   ├── core/               # 核心模块
│   ├── modules/            # 业务模块
│   │   ├── auth/           # 认证
│   │   ├── tenant/         # 租户管理
│   │   ├── sync/           # 数据同步
│   │   ├── device/         # 设备数据
│   │   ├── export/         # 数据导出
│   │   └── monitor/        # 监控
│   └── shared/             # 共享代码
│
├── web/                    # 前端应用
│   └── src/
│       ├── api/            # API 请求
│       ├── pages/          # 页面
│       ├── layouts/        # 布局
│       └── store/          # 状态管理
│
├── scripts/                # 部署脚本
├── mysql/                  # 数据库初始化
└── .github/workflows/      # CI/CD
```

## 开发命令

```bash
# 开发
npm run dev:web          # 启动前端开发服务
npm run dev:cloud        # 启动后端开发服务

# 构建
npm run build            # 构建前后端

# 代码质量
npm run lint             # 代码检查
npm run format           # 代码格式化
npm run test             # 运行测试

# 发布
npm run release          # 发布补丁版本
npm run release:minor    # 发布次版本
npm run release:major    # 发布主版本
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `DB_HOST` | 数据库地址 | ✅ |
| `DB_USER` | 数据库用户名 | ✅ |
| `DB_PASSWORD` | 数据库密码 | ✅ |
| `DB_NAME` | 数据库名 | ✅ |
| `ALIPAY_APP_ID` | 支付宝应用 ID | ✅ |
| `ALIPAY_PRIVATE_KEY` | 支付宝私钥 | ✅ |
| `ALIPAY_PUBLIC_KEY` | 支付宝公钥 | ✅ |
| `SENTRY_DSN` | Sentry DSN | ❌ |

### Sentry 配置（可选）

用于生产环境错误追踪：

1. 在 [Sentry](https://sentry.io/) 创建项目
2. 设置环境变量：
   - `SENTRY_DSN`: Sentry 项目 DSN
   - `SENTRY_AUTH_TOKEN`: SourceMap 上传 Token
   - `SENTRY_ORG`: 组织名
   - `SENTRY_PROJECT`: 项目名

## CI/CD

项目使用 GitHub Actions 自动化：

- **Pull Request**: 自动运行 lint 和 test
- **develop 分支**: 自动部署到开发环境
- **main 分支**: 自动部署到生产环境

## 系统访问

- **前端地址**: https://alinfc-1gqk3fty54919e7a-1332643701.tcloudbaseapp.com
- **管理员账号**: `admin` / `admin123`（请立即修改密码）

## 文档

- [开发指南](./DEVELOPMENT.md)
- [更新日志](./CHANGELOG.md)

## 更新日志

- 2026-04-02: 初始部署完成
- 2026-04-07: 工程化改造（代码规范、测试、CI/CD、Sentry）
