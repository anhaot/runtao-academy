import { expect, test } from '@playwright/test';
import { adminUser, apiLogin, createQuestion, primeAuth } from './utils';

test('管理员可以完成数据库迁移和校验流程', async ({ page, request }) => {
  const login = await apiLogin(request, adminUser.username, adminUser.password);
  await createQuestion(request, login.token, {
    title: '数据库迁移验收题目',
    content: '用于确认迁移后题目数据完整',
    answer: '迁移并校验源库和目标库记录数',
  });
  await primeAuth(page, login);

  await page.goto('/settings');
  await page.getByTestId('settings-tab-database').click();
  await page.getByTestId('open-database-migration').click();
  await expect(page.getByTestId('database-migration-dialog')).toBeVisible();

  await page.getByLabel('目标名称').fill('SQLite 迁移验收');
  await page.getByLabel('数据库类型').selectOption('sqlite');
  await page.getByLabel('数据库文件路径').fill('/tmp/tech-growth-hub-e2e-migration.db');
  await page.getByRole('button', { name: '保存迁移目标' }).click();
  await expect(page.getByText('SQLite 迁移验收')).toBeVisible();

  await page.getByRole('button', { name: '1. 测试连接' }).click();
  await page.getByRole('button', { name: '2. 初始化' }).click();
  await page.getByRole('button', { name: '3. 迁移数据' }).click();
  await expect(page.getByRole('heading', { name: '数据校验通过' })).toBeVisible();

  await page.getByRole('button', { name: '4. 校验数据' }).click();
  await expect(page.getByText('数值顺序：源数据库 / 目标数据库')).toBeVisible();

  await page.getByRole('button', { name: '5. 重启后使用' }).click();
  await expect(page.getByText('重启后使用', { exact: true })).toBeVisible();
});
