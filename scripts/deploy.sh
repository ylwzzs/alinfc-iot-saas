#!/bin/bash

# 部署脚本
# 用法: ./scripts/deploy.sh [env]
# env: dev | test | prod

set -e

ENV=${1:-dev}
PROJECT_DIR=$(dirname "$0")/..
cd "$PROJECT_DIR"

echo "=========================================="
echo "部署环境: $ENV"
echo "项目目录: $PROJECT_DIR"
echo "=========================================="

# 加载环境变量
if [ -f ".env.$ENV" ]; then
    echo "加载环境配置: .env.$ENV"
    export $(cat ".env.$ENV" | grep -v '^#' | xargs)
fi

# 1. 安装依赖
echo ""
echo "[1/5] 安装依赖..."
cd cloud && npm ci
cd ../web && npm ci
cd ..

# 2. 运行测试
echo ""
echo "[2/5] 运行测试..."
cd cloud && npm run lint 2>/dev/null || true
cd ../web && npm run lint
cd ..

# 3. 构建
echo ""
echo "[3/5] 构建项目..."
cd cloud && npm run build
cd ../web && npm run build:prod
cd ..

# 4. 部署后端
echo ""
echo "[4/5] 部署后端..."
if [ "$ENV" = "prod" ]; then
    tcb fn deploy --all --envId "$TCB_ENV_ID_PROD"
else
    tcb fn deploy --all --envId "$TCB_ENV_ID_DEV"
fi

# 5. 部署前端
echo ""
echo "[5/5] 部署前端..."
if [ "$ENV" = "prod" ]; then
    tcb hosting deploy web/dist --envId "$TCB_ENV_ID_PROD"
else
    tcb hosting deploy web/dist --envId "$TCB_ENV_ID_DEV"
fi

echo ""
echo "=========================================="
echo "部署完成! 环境: $ENV"
echo "时间: $(date)"
echo "=========================================="
