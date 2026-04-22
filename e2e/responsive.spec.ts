import { test, expect } from '@playwright/test';

async function login(page: ReturnType<typeof test['page']>) {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill('admin@shop.com');
  await page.getByLabel('密码').fill('admin123');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Responsive Design', () => {
  test('mobile layout (375x812)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
    await expect(page.getByText('今日订单')).toBeVisible();
  });

  test('tablet layout (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await login(page);
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
    await expect(page.getByText('今日收入')).toBeVisible();
  });

  test('desktop layout (1280x720)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await login(page);
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
    await expect(page.getByText('店铺管理')).toBeVisible();
  });

  test('product list table on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.getByRole('link', { name: '商品管理' }).click();
    await expect(page.getByRole('heading', { name: '商品管理' })).toBeVisible();
    const tableContainer = page.locator('.overflow-x-auto').first();
    await expect(tableContainer).toBeVisible();
  });

  test('order list table on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.getByRole('link', { name: '订单管理' }).click();
    await expect(page.getByRole('heading', { name: '订单管理' })).toBeVisible();
  });

  test('bill summary on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.getByRole('link', { name: '账单汇总' }).click();
    await expect(page.getByRole('heading', { name: '账单汇总' })).toBeVisible();
  });
});
