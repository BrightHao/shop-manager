import { test, expect } from '@playwright/test';

async function login(page: ReturnType<typeof test['page']>) {
  await page.goto('/login');
  await page.getByLabel('邮箱').fill('admin@shop.com');
  await page.getByLabel('密码').fill('admin123');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('dashboard loads with KPIs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
    await expect(page.locator('text=今日订单').first()).toBeVisible();
    await expect(page.locator('text=今日收入').first()).toBeVisible();
    await expect(page.locator('text=库存预警').first()).toBeVisible();
  });

  test('recent orders section visible', async ({ page }) => {
    await expect(page.getByText('最近订单')).toBeVisible();
  });
});

test.describe('Product CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: '商品管理' }).click();
  });

  test('product list loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '商品管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新增商品' })).toBeVisible();
  });

  test('create new product', async ({ page }) => {
    await page.getByRole('button', { name: '新增商品' }).click();
    await page.getByLabel('商品名称').fill('E2E测试商品');
    await page.getByLabel('单位').fill('个');
    await page.getByLabel('单价').fill('99.99');
    await page.getByLabel('库存').fill('100');
    await page.getByRole('button', { name: '创建' }).click();
    await expect(page).toHaveURL(/\/products/);
    await expect(page.locator('text=E2E测试商品').first()).toBeVisible();
  });
});

test.describe('Orders', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: '订单管理' }).click();
  });

  test('order list loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '订单管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新增订单' })).toBeVisible();
  });

  test('create order flow', async ({ page }) => {
    await page.getByRole('button', { name: '新增订单' }).click();
    await expect(page).toHaveURL(/\/orders\/new/);
    await page.getByLabel('购买人').fill('E2E买家');
    await page.getByRole('combobox').first().click();
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await page.getByRole('option').first().click();
    await page.locator('input[type="number"]').first().fill('1');
    await page.getByRole('button', { name: '创建订单' }).click();
    await expect(page).toHaveURL(/\/orders\/\d+/, { timeout: 10000 });
  });
});
