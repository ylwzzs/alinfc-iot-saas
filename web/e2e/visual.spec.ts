import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  // 使用较小的容差值来检测细微变化
  test.use({
    viewport: { width: 1280, height: 720 },
  });

  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
  });

  test('login page snapshot', async ({ page }) => {
    // 先登出
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible();

    // 等待页面稳定
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 全页面截图
    expect(await page.screenshot()).toMatchSnapshot('login-page.png', {
      maxDiffPixels: 100,
    });
  });

  test('dashboard snapshot', async ({ page }) => {
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 等待数据加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 仪表盘截图
    expect(await page.screenshot()).toMatchSnapshot('dashboard.png', {
      maxDiffPixels: 200,
    });
  });

  test('tenant list snapshot', async ({ page }) => {
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 租户列表截图
    expect(await page.screenshot()).toMatchSnapshot('tenant-list.png', {
      maxDiffPixels: 200,
    });
  });

  test('sidebar snapshot', async ({ page }) => {
    const sidebar = page.locator('.ant-layout-sider, [class*="sidebar"], nav');
    if (await sidebar.isVisible()) {
      expect(await sidebar.screenshot()).toMatchSnapshot('sidebar.png', {
        maxDiffPixels: 100,
      });
    }
  });

  test('header snapshot', async ({ page }) => {
    const header = page.locator('.ant-layout-header, header, [class*="header"]');
    if (await header.isVisible()) {
      expect(await header.screenshot()).toMatchSnapshot('header.png', {
        maxDiffPixels: 100,
      });
    }
  });
});

test.describe('Component Visual Tests', () => {
  test('login form components', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 单独测试登录表单
    const loginForm = page.getByRole('form');
    if (await loginForm.isVisible()) {
      expect(await loginForm.screenshot()).toMatchSnapshot('login-form.png', {
        maxDiffPixels: 50,
      });
    }
  });

  test('table component', async ({ page }) => {
    // 登录
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    const table = page.getByRole('table');
    if (await table.isVisible()) {
      await page.waitForLoadState('networkidle');
      expect(await table.screenshot()).toMatchSnapshot('table-component.png', {
        maxDiffPixels: 100,
      });
    }
  });
});

test.describe('Responsive Visual Tests', () => {
  test('mobile login page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(await page.screenshot()).toMatchSnapshot('mobile-login.png', {
      maxDiffPixels: 100,
    });
  });

  test('tablet dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    // 登录
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    expect(await page.screenshot()).toMatchSnapshot('tablet-dashboard.png', {
      maxDiffPixels: 200,
    });
  });
});
