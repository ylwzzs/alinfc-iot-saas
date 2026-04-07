# 支付宝 IoT 数据分析 SaaS 系统

一个完整的支付宝 IoT 设备数据多租户 SaaS 分析平台，支持租户管理、数据同步、报表导出等功能。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Ant Design + Zustand
- **后端**: Vercel Serverless Functions + MySQL
- **部署**: Vercel
- **监控**: Sentry 错误追踪

## 部署状态

部署到 Vercel：自动部署（main 分支）

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

# 本地开发
npm run dev:web    # 前端服务
npm run dev:cloud  # 后端服务
```

## 部署到 Vercel

### 方式一：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 部署到生产环境
vercel --prod
```

### 方式二：通过 GitHub 自动部署

1. 在 Vercel 导入 GitHub 仓库
2. 配置环境变量（见下方）
3. 推送代码自动触发部署

### Vercel 环境变量配置

在 Vercel Dashboard → Settings → Environment Variables 中配置：

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `DB_HOST` | MySQL 数据库地址 | ✅ |
| `DB_PORT` | MySQL 端口 | ✅ |
| `DB_USER` | 数据库用户名 | ✅ |
| `DB_PASSWORD` | 数据库密码 | ✅ |
| `DB_NAME` | 数据库名 | ✅ |
| `JWT_SECRET` | JWT 签名密钥（至少32字符） | ✅ |
| `JWT_EXPIRES_IN` | Token 过期时间 | ❌ |
| `SENTRY_DSN` | Sentry 错误追踪 DSN | ❌ |

### 推荐数据库方案

由于 Vercel 是 Serverless，需要使用云数据库：

- **PlanetScale**: MySQL 兼容，免费额度充足
- **Neon**: PostgreSQL，Serverless 友好
- **AWS RDS**: 企业级稳定
- **阿里云 RDS**: 国内访问快

## 项目结构

```
alinfc/
├── api/                    # Vercel Serverless Functions
│   ├── health.ts           # 健康检查
│   ├── auth.ts             # 认证 API
│   ├── admin.ts            # 管理员 API
│   └── tenant.ts           # 租户 API
│
├── web/                    # 前端应用
│   └── src/
│       ├── api/            # API 请求
│       ├── pages/          # 页面
│       ├── layouts/        # 布局
│       └── store/          # 状态管理
│
├── cloud/                  # 本地开发后端（备用）
├── scripts/                # 脚本
└── .github/workflows/      # CI/CD
```

## 开发命令

```bash
# 开发
npm run dev:web          # 启动前端开发服务
npm run dev:cloud        # 启动后端开发服务（本地）

# 构建
npm run build            # 构建前后端

# 代码质量
npm run lint             # 代码检查
npm run format           # 代码格式化
npm run test             # 运行测试

# 发布
npm run release          # 发布补丁版本
```

## CI/CD

项目使用 GitHub Actions 自动化：

- **Pull Request**: 自动运行 lint 和 test，部署预览环境
- **main 分支**: 自动部署到生产环境

### 需要的 GitHub Secrets

| Secret | 说明 |
|--------|------|
| `VERCEL_TOKEN` | Vercel API Token |
| `VERCEL_ORG_ID` | Vercel 组织 ID |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID |

## 系统访问

- **管理员账号**: `admin` / `admin123`（请立即修改密码）

## 文档

- [开发指南](./DEVELOPMENT.md)
- [更新日志](./CHANGELOG.md)

## 更新日志

- 2026-04-07: 迁移到 Vercel 部署
- 2026-04-07: 工程化改造（代码规范、测试、CI/CD、Sentry）
- 2026-04-02: 初始部署完成
