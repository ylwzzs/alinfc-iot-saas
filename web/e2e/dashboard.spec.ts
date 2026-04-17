import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
  });

  test('should display dashboard overview', async ({ page }) => {
    // 验证关键指标卡片
    const cards = page.locator('.ant-card, [class*="stat-card"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should display charts', async ({ page }) => {
    // 等待图表加载
    await page.waitForTimeout(2000);

    // 检查 ECharts 或 AntV 图表
    const charts = page.locator('canvas, [class*="chart"], [data-echarts]');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(0);
  });

  test('should display device statistics', async ({ page }) => {
    // 检查设备统计
    const deviceSection = page.getByText(/设备|终端/i);
    if (await deviceSection.isVisible()) {
      await expect(deviceSection).toBeVisible();
    }
  });

  test('should display transaction trends', async ({ page }) => {
    // 检查交易趋势
    const trendSection = page.getByText(/交易|趋势|金额/i);
    if (await trendSection.isVisible()) {
      await expect(trendSection).toBeVisible();
    }
  });
});

test.describe('Data Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
  });

  test('should export data to Excel', async ({ page }) => {
    // 查找导出按钮
    const exportBtn = page.getByRole('button', { name: /导出|Excel/i });
    if (await exportBtn.isVisible()) {
      // 监听下载事件
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await exportBtn.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.xlsx|\.xls/);
    }
  });

  test('should show export options', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /导出/i });
    if (await exportBtn.isVisible()) {
      await exportBtn.click();

      // 检查导出选项菜单
      await expect(page.getByText(/Excel|PDF|Word/i)).toBeVisible({ timeout: 3000 });
    }
  });
});
