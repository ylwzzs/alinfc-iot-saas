# 后端服务 Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY cloud/package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY cloud/ ./

# 构建
RUN npm run build

# 生产镜像
FROM node:20-alpine

WORKDIR /app

# 复制构建产物和依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY cloud/package*.json ./

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
