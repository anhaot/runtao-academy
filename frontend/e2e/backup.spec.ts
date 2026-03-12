import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { adminUser, apiLogin, primeAuth } from './utils';

test('管理员可以导出并恢复备份', async ({ page, request }, testInfo) => {
  const login = await apiLogin(request, adminUser.username, adminUser.password);

  await primeAuth(page, login);
  await page.goto('/settings');
  await page.getByTestId('settings-tab-system').click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('backup-export-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('runtao-academy-backup-');

  const backupPath = path.join(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(backupPath);
  const backupText = await fs.readFile(backupPath, 'utf-8');
  const backupJson = JSON.parse(backupText);
  expect(backupJson.meta).toBeTruthy();
  expect(backupJson.dataset).toBeTruthy();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByTestId('backup-restore-input').setInputFiles(backupPath);

  await expect(page.getByText('备份已恢复')).toBeVisible();
});
