import { expect, test } from '@playwright/test';
import { apiLogin, primeAuth, registerUser } from './utils';

test.use({ viewport: { width: 390, height: 844 } });

test('手机端可批量记录题目并离线保留草稿', async ({ page, request }) => {
  const suffix = `${Date.now()}_capture`;
  const user = await registerUser(request, suffix);
  const login = await apiLogin(request, user.username, user.password);
  await primeAuth(page, login);

  await page.goto('/capture');
  await expect(page.getByRole('button', { name: '打开个人资料' })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();

  await page.getByRole('button', { name: '打开个人资料' }).click();
  const profileDialog = page.getByRole('dialog', { name: '个人资料' });
  await expect(profileDialog).toBeVisible();
  await expect(profileDialog.getByRole('button', { name: '显示新密码' })).toBeVisible();
  await expect(profileDialog.getByRole('button', { name: '显示确认密码' })).toBeVisible();
  await profileDialog.getByRole('button', { name: '关闭个人资料' }).click();
  await expect(profileDialog).toBeHidden();

  await page.getByPlaceholder(/每行一道题/).fill('Linux load 高怎么排查？\nPod Pending 怎么排查？');
  await page.getByRole('button', { name: '保存到草稿箱' }).click();
  await expect(page.getByText('草稿箱（2）')).toBeVisible();
  const layout = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(layout.scroll).toBeLessThanOrEqual(layout.viewport);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
    }
  });

  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByText('离线草稿模式')).toBeVisible();
  await expect(page.getByText('草稿箱（2）')).toBeVisible();
  await page.context().setOffline(false);
});
