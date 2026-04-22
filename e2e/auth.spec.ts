import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login and see dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('邮箱').fill('admin@shop.com');
    await page.getByLabel('密码').fill('admin123');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: '仪表盘' })).toBeVisible();
  });

  test('login with wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('邮箱').fill('admin@shop.com');
    await page.getByLabel('密码').fill('wrongpassword');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
  });
});
