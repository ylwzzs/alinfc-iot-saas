#!/bin/bash

# 数据库备份脚本
# 用法: ./scripts/backup.sh [tenant_id]

set -e

# 配置
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-root}
DB_PASSWORD=${DB_PASSWORD:-}
DB_NAME=${DB_NAME:-alinfc}

BACKUP_DIR=${BACKUP_DIR:-./backups}
DATE=$(date +%Y%m%d_%H%M%S)
TENANT_ID=$1

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份文件名
if [ -n "$TENANT_ID" ]; then
    BACKUP_FILE="$BACKUP_DIR/alinfc_tenant_${TENANT_ID}_${DATE}.sql"
    TABLES="device_metrics_${TENANT_ID}"
else
    BACKUP_FILE="$BACKUP_DIR/alinfc_full_${DATE}.sql"
    TABLES=""
fi

echo "开始备份: $BACKUP_FILE"

# 执行备份
if [ -n "$TABLES" ]; then
    # 备份单个租户分表
    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        "$DB_NAME" $TABLES > "$BACKUP_FILE"
else
    # 全量备份
    mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --all-databases > "$BACKUP_FILE"
fi

# 压缩
gzip "$BACKUP_FILE"
echo "备份完成: ${BACKUP_FILE}.gz"

# 清理旧备份（保留最近 7 天）
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "已清理 7 天前的备份文件"

# 计算文件大小
SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "文件大小: $SIZE"
