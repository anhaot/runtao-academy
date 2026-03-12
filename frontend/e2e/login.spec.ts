import { test, expect } from '@playwright/test';
import { adminUser, loginByUi } from './utils';

test('管理员可以通过登录页完成登录', async ({ page }) => {
  await loginByUi(page, adminUser.username, adminUser.password);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('润涛题苑')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(`(早上好|中午好|下午好|晚上好)，${adminUser.username}`) })).toBeVisible();
});
