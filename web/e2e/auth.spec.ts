import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/支付宝 IoT/);
    await expect(page.getByRole('heading', { name: /登录/i })).toBeVisible();
  });

  test('should login as admin successfully', async ({ page }) => {
    // 等待登录表单加载
    await expect(page.getByPlaceholder(/用户名|账号/i)).toBeVisible();

    // 填写管理员账号
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');

    // 点击登录
    await page.getByRole('button', { name: /登录/i }).click();

    // 验证跳转到管理页面
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByPlaceholder(/用户名|账号/i).fill('invalid_user');
    await page.getByPlaceholder(/密码/i).fill('wrong_password');
    await page.getByRole('button', { name: /登录/i }).click();

    // 验证错误提示
    await expect(page.getByText(/错误|失败|不正确/i)).toBeVisible({ timeout: 5000 });
  });

  test('should validate required fields', async ({ page }) => {
    const loginBtn = page.getByRole('button', { name: /登录/i });

    // 直接点击登录，不填写任何信息
    await loginBtn.click();

    // 验证表单验证提示
    await expect(page.getByText(/请输入|必填|不能为空/i)).toBeVisible();
  });

  test('should switch between admin and tenant login', async ({ page }) => {
    // 检查是否有登录类型切换
    const tenantTab = page.getByRole('tab', { name: /租户/i });
    const adminTab = page.getByRole('tab', { name: /管理员/i });

    if (await tenantTab.isVisible()) {
      await tenantTab.click();
      await expect(page.getByPlaceholder(/租户|商户/i)).toBeVisible();
    }
  });

  test('should logout successfully', async ({ page }) => {
    // 先登录
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();

    // 等待登录成功
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 查找登出按钮（可能在用户菜单中）
    const userMenu = page.getByRole('button', { name: /admin|用户|头像/i });
    if (await userMenu.isVisible()) {
      await userMenu.click();
      await page.getByRole('menuitem', { name: /退出|登出|注销/i }).click();
    } else {
      // 直接查找登出按钮
      const logoutBtn = page.getByRole('button', { name: /退出|登出|注销/i });
      if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
      }
    }

    // 验证返回登录页
    await expect(page).toHaveURL(/\/login|\/$/, { timeout: 5000 });
  });
});

test.describe('Session Management', () => {
  test('should persist login session', async ({ page, context }) => {
    // 登录
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });

    // 刷新页面
    await page.reload();

    // 验证仍然保持登录状态
    await expect(page).toHaveURL(/\/admin|\/dashboard/);
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // 清除所有存储
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());

    // 访问受保护页面
    await page.goto('/admin');

    // 验证重定向到登录页
    await expect(page).toHaveURL(/\/login|\/$/, { timeout: 5000 });
  });
});
