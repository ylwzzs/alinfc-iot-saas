# 开发指南

## 分支策略

```
main (生产环境)
  ↑
  └── develop (开发主分支)
        ↑
        ├── feature/xxx (功能分支)
        ├── bugfix/xxx (修复分支)
        └── hotfix/xxx (紧急修复，直接合并到 main)
```

## 开发流程

### 1. 功能开发

```bash
# 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/your-feature

# 开发完成后提交 PR
git push origin feature/your-feature
```

### 2. 提交 PR

1. 在 GitHub 创建 PR，目标分支为 `develop`
2. 等待 CI 测试通过
3. 等待代码审查
4. 合并到 `develop`

### 3. 发布到生产

```bash
# 从 develop 合并到 main
git checkout main
git merge develop
git push origin main
```

## 环境说明

| 环境 | 分支 | 域名 | 用途 |
|------|------|------|------|
| Production | main | alinfc.vercel.app | 生产环境 |
| Preview | PR | pr-xxx.vercel.app | 每个 PR 自动预览 |
| Develop | develop | 自动部署 | 开发测试 |

## 测试策略

### 测试类型

| 类型 | 工具 | 触发时机 | 说明 |
|------|------|---------|------|
| Lint | ESLint + Prettier | 每次 push/PR | 代码规范检查 |
| 单元测试 | Vitest | 每次 push/PR | 功能测试 |
| E2E 测试 | Playwright | PR + main | 端到端测试 |
| 安全扫描 | npm audit | 定时 + 手动 | 依赖安全检查 |

### 本地测试命令

```bash
# 单元测试
npm run test

# 单元测试 + 覆盖率
npm run test:coverage

# E2E 测试
cd web && npm run test:e2e

# 冒烟测试
cd web && npm run test:e2e:smoke
```

## 分支保护规则

### main 分支

- ❌ 禁止直接推送
- ✅ 必须通过 PR 合并
- ✅ 必须通过 CI 测试
- ✅ 必须至少 1 人审核

### develop 分支

- ❌ 禁止直接推送
- ✅ 必须通过 PR 合并
- ✅ 必须通过 CI 测试

## 紧急修复流程

```bash
# 从 main 创建 hotfix 分支
git checkout main
git checkout -b hotfix/urgent-fix

# 修复后同时合并到 main 和 develop
git checkout main
git merge hotfix/urgent-fix
git push origin main

git checkout develop
git merge hotfix/urgent-fix
git push origin develop
```

## 提交规范

使用 Conventional Commits：

```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

示例：
```
feat: 添加用户登录功能
fix: 修复登录验证逻辑
docs: 更新 API 文档
```
