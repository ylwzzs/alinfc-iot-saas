/**
 * 冒烟测试 - 快速验证核心功能
 * 用于每次部署后快速验证系统可用性
 */
import { test, expect } from '@playwright/test';

// 冒烟测试使用更短的超时时间
test.describe.configure({ mode: 'parallel' });

test.describe('Smoke Tests', () => {
  const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

  test('health check - API is responding', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`, {
      timeout: 10000,
    });
    expect(response.status()).toBeLessThan(500);
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible({ timeout: 5000 });
  });

  test('admin login works', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();

    // 快速验证登录成功
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
  });

  test('tenant list loads', async ({ page }) => {
    // 先登录
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
      await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });
    }
  });

  test('dashboard displays metrics', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 验证页面有内容
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 过滤掉已知的非关键错误
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('extension')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('responsive design - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Critical Path Tests', () => {
  // 这些是系统最关键的功能路径
  test('complete login flow', async ({ page }) => {
    // 1. 访问登录页
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible();

    // 2. 登录
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 3. 验证用户菜单显示
    const userMenu = page.getByRole('button', { name: /admin|用户|头像/i });
    await expect(userMenu).toBeVisible({ timeout: 5000 });
  });
});
