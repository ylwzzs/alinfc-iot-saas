/**
 * 导出模块 - 路由
 */
import Router from '@koa/router';
import fs from 'fs';
import { authMiddleware, tenantGuard } from '../../core/middleware';
import { exportService } from './service';

const router = new Router({ prefix: '/api/tenant/export' });

/**
 * 创建导出任务
 */
router.post('/', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const { exportType, fileName, filterConfig } = ctx.request.body as {
    exportType: 'excel' | 'pdf';
    fileName: string;
    filterConfig: {
      startDate: string;
      endDate: string;
      sn?: string;
      storeId?: string;
      provinceCode?: string;
    };
  };

  if (!exportType || !fileName || !filterConfig) {
    ctx.status = 400;
    ctx.body = { success: false, message: '参数不完整' };
    return;
  }

  const recordId = await exportService.createExport({
    tenantId,
    userType: 'tenant',
    exportType,
    fileName,
    filterConfig,
  });

  ctx.body = { success: true, data: { id: recordId } };
});

/**
 * 获取导出进度
 */
router.get('/progress/:id', authMiddleware(), tenantGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);
  const progress = await exportService.getProgress(id);

  if (!progress) {
    ctx.status = 404;
    ctx.body = { success: false, message: '导出任务不存在' };
    return;
  }

  ctx.body = { success: true, data: progress };
});

/**
 * 获取导出记录列表
 */
router.get('/records', authMiddleware(), tenantGuard(), async (ctx) => {
  const tenantId = ctx.state.tenantId!;
  const records = await exportService.getRecords(tenantId);
  ctx.body = { success: true, data: records };
});

/**
 * 下载导出文件
 */
router.get('/download/:id', authMiddleware(), tenantGuard(), async (ctx) => {
  const id = parseInt(ctx.params.id);

  const filePath = await exportService.getFilePath(id);
  if (!filePath || !fs.existsSync(filePath)) {
    ctx.status = 404;
    ctx.body = { success: false, message: '文件不存在' };
    return;
  }

  const stat = fs.statSync(filePath);
  ctx.set('Content-Type', 'application/octet-stream');
  ctx.set('Content-Disposition', `attachment; filename="${id}.xlsx"`);
  ctx.set('Content-Length', stat.size.toString());
  ctx.body = fs.createReadStream(filePath);
});

export { router as exportRoutes };
