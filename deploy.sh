#!/bin/bash
# ========================================
# 支付宝 IoT SaaS 系统 - 一键部署脚本
# ========================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  支付宝 IoT SaaS 系统部署脚本${NC}"
echo -e "${GREEN}=======================================${NC}"

# 检查环境变量
if [ -z "$TCB_ENV_ID" ]; then
    echo -e "${YELLOW}请设置 TCB_ENV_ID 环境变量:${NC}"
    echo "  export TCB_ENV_ID=your-env-id"
    exit 1
fi

echo -e "\n${GREEN}[1/5] 编译云函数...${NC}"
cd cloud
npm install
npm run build

echo -e "\n${GREEN}[2/5] 部署云函数到 CloudBase...${NC}"

# 部署 gateway
echo -e "${YELLOW}  部署 gateway...${NC}"
tcb fn deploy gateway --envId $TCB_ENV_ID --force

# 部署 authCallback
echo -e "${YELLOW}  部署 authCallback...${NC}"
tcb fn deploy authCallback --envId $TCB_ENV_ID --force

# 部署 dataSync
echo -e "${YELLOW}  部署 dataSync...${NC}"
tcb fn deploy dataSync --envId $TCB_ENV_ID --force

# 部署 initAdmin
echo -e "${YELLOW}  部署 initAdmin...${NC}"
tcb fn deploy initAdmin --envId $TCB_ENV_ID --force

echo -e "\n${GREEN}[3/5] 初始化管理员账号...${NC}"
tcb fn invoke initAdmin --envId $TCB_ENV_ID

echo -e "\n${GREEN}[4/5] 构建前端...${NC}"
cd ../web
npm install

# 更新 API 地址
echo -e "${YELLOW}  请确保已更新 web/src/api/request.ts 中的 BASE_URL${NC}"
read -p "是否继续构建? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

npm run build

echo -e "\n${GREEN}[5/5] 部署前端到静态托管...${NC}"
tcb hosting deploy dist --envId $TCB_ENV_ID --force

echo -e "\n${GREEN}=======================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 配置云函数环境变量（如果尚未配置）"
echo "2. 在支付宝开放平台配置授权回调地址"
echo "3. 访问前端地址，使用管理员账号登录"
echo ""
echo -e "${YELLOW}管理员默认账号: admin / admin123${NC}"
echo -e "${YELLOW}请立即修改默认密码！${NC}"
