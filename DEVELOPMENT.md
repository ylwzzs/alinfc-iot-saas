# 开发指南

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- MySQL 8.0+
- Redis 6.0+

### 安装依赖

```bash
# 安装所有依赖
npm run install:all

# 或分别安装
npm install
cd web && npm install
cd ../cloud && npm install
```

### 本地开发

```bash
# 启动后端服务（端口 3000）
npm run dev:cloud

# 启动前端服务（端口 5173）
npm run dev:web
```

### 环境变量配置

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

关键配置项：
- `JWT_SECRET`: JWT 签名密钥（至少 32 字符）
- `DB_*`: 数据库连接配置
- `ALIPAY_*`: 支付宝开放平台配置
- `SENTRY_DSN`: Sentry 错误追踪（可选）

---

## 代码规范

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**类型（type）**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `build`: 构建系统
- `ci`: CI/CD 配置
- `chore`: 其他杂项

**示例**：
```bash
feat(tenant): 添加租户批量导入功能
fix(auth): 修复 Token 过期时间计算错误
docs: 更新部署文档
```

### 代码格式化

```bash
# 格式化所有代码
npm run format

# 检查格式
npm run format:check
```

### 代码检查

```bash
# 运行所有 lint
npm run lint

# 自动修复
npm run lint:fix
```

---

## 测试

### 运行测试

```bash
# 运行所有测试
npm run test

# 运行前端测试
npm run test:web

# 运行后端测试
npm run test:cloud

# 生成覆盖率报告
npm run test:coverage
```

### 测试目录结构

```
web/src/__tests__/          # 前端测试
  ├── login.test.tsx        # 登录测试
  └── tenant.test.tsx       # 租户管理测试

cloud/__tests__/            # 后端测试
  ├── auth.test.ts          # 认证测试
  ├── tenant.test.ts        # 租户测试
  └── sync.test.ts          # 同步测试
```

---

## 构建与部署

### 构建

```bash
# 构建所有
npm run build

# 分别构建
npm run build:cloud
npm run build:web
```

### 版本发布

```bash
# 发布补丁版本 (1.0.0 -> 1.0.1)
npm run release

# 发布次版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 发布主版本 (1.0.0 -> 2.0.0)
npm run release:major
```

### CI/CD 流程

项目使用 GitHub Actions 进行自动化：

1. **Pull Request**：运行 lint 和 test
2. **develop 分支**：自动部署到开发环境
3. **main 分支**：自动部署到生产环境（需手动确认）

---

## 项目结构

```
alinfc/
├── cloud/                  # 后端服务
│   ├── core/               # 核心模块（配置、日志、数据库、缓存）
│   ├── modules/            # 业务模块
│   │   ├── auth/           # 认证模块
│   │   ├── tenant/         # 租户管理
│   │   ├── sync/           # 数据同步
│   │   ├── device/         # 设备数据
│   │   ├── export/         # 数据导出
│   │   └── monitor/        # 监控模块
│   ├── shared/             # 共享代码
│   └── __tests__/          # 测试文件
│
├── web/                    # 前端应用
│   ├── src/
│   │   ├── api/            # API 请求
│   │   ├── pages/          # 页面组件
│   │   ├── layouts/        # 布局组件
│   │   ├── store/          # 状态管理
│   │   └── __tests__/      # 测试文件
│   └── public/
│
├── scripts/                # 部署脚本
├── mysql/                  # 数据库初始化
└── .github/workflows/      # CI/CD 配置
```

---

## 监控与告警

### Sentry 错误追踪

项目已集成 Sentry 进行错误追踪：

1. 在环境变量中设置 `SENTRY_DSN`
2. 前端错误自动上报
3. 后端未捕获异常自动上报

### 健康检查

- 后端健康检查：`/api/monitor/health`
- 系统状态：`/api/monitor/status`

---

## 常见问题

### Q: 本地开发时 API 请求跨域？

A: 前端开发服务器已配置代理，API 请求会自动转发到 `http://localhost:3000`。

### Q: 测试数据库如何配置？

A: 创建独立的测试数据库 `alinfc_test`，测试时会自动使用测试配置。

### Q: 如何添加新的业务模块？

A: 在 `cloud/modules/` 下创建新目录，包含：
- `routes.ts` - 路由定义
- `service.ts` - 业务逻辑
- `repository.ts` - 数据访问
- `types.ts` - 类型定义

---

## 相关链接

- [腾讯云 CloudBase 文档](https://cloud.tencent.com/document/product/876)
- [支付宝开放平台](https://open.alipay.com/)
- [Sentry 文档](https://docs.sentry.io/)
