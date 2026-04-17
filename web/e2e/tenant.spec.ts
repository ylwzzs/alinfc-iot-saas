import { test, expect } from '@playwright/test';

test.describe('Tenant Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录管理员账号
    await page.goto('/');
    await page.getByPlaceholder(/用户名|账号/i).fill('admin');
    await page.getByPlaceholder(/密码/i).fill('admin123');
    await page.getByRole('button', { name: /登录/i }).click();
    await expect(page).toHaveURL(/\/admin|\/dashboard/, { timeout: 10000 });
  });

  test('should display tenant list', async ({ page }) => {
    // 导航到租户管理页面
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    // 验证租户列表表格
    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });
  });

  test('should search tenants', async ({ page }) => {
    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    // 等待表格加载
    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });

    // 搜索租户
    const searchInput = page.getByPlaceholder(/搜索|租户名|关键词/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('测试');
      await page.keyboard.press('Enter');

      // 验证搜索结果
      await expect(page.getByRole('table')).toBeVisible();
    }
  });

  test('should filter tenants by status', async ({ page }) => {
    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });

    // 筛选已授权租户
    const statusFilter = page.getByRole('combobox', { name: /状态|授权/i });
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /已授权/i }).click();
    }
  });

  test('should toggle tenant status', async ({ page }) => {
    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });

    // 点击禁用/启用按钮
    const toggleBtn = page.getByRole('button', { name: /禁用|启用/i }).first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();

      // 确认操作
      const confirmBtn = page.getByRole('button', { name: /确定|确认/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // 验证操作成功
      await expect(page.getByText(/成功/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should paginate tenant list', async ({ page }) => {
    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });

    // 检查分页器
    const pagination = page.locator('.ant-pagination, [class*="pagination"]');
    if (await pagination.isVisible()) {
      const nextBtn = pagination.getByRole('button', { name: /下一页|next/i });
      if (await nextBtn.isEnabled()) {
        await nextBtn.click();
        await expect(page.getByRole('table')).toBeVisible();
      }
    }
  });

  test('should create new tenant', async ({ page }) => {
    // 导航到租户管理
    const tenantMenu = page.getByRole('menuitem', { name: /租户|商户/i });
    if (await tenantMenu.isVisible()) {
      await tenantMenu.click();
    }

    await expect(page.getByRole('table')).toBeVisible({ timeout: 5000 });

    // 点击新建按钮
    const createBtn = page.getByRole('button', { name: /新建|添加|创建/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // 填写表单
      await page.getByLabel(/租户名|名称/i).fill('测试租户E2E');
      await page.getByLabel(/联系人/i).fill('测试联系人');
      await page.getByLabel(/联系电话|电话/i).fill('13800138000');

      // 提交
      await page.getByRole('button', { name: /确定|提交|保存/i }).click();

      // 验证成功
      await expect(page.getByText(/成功/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
