import { chromium } from '@playwright/test';

const baseUrl = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:10089';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.getByTestId('login-username').fill('admin');
  await page.getByTestId('login-password').fill('admin');
  const captcha = await page.getByTestId('login-captcha-svg').locator('text').allTextContents();
  await page.getByTestId('login-captcha').fill(captcha.join('').trim());
  await page.locator('form').evaluate((form) => form.requestSubmit());
  await page.waitForURL(`${baseUrl}/change-password`, { timeout: 15_000 });
  const protectedApiStatus = await page.evaluate(async () => {
    const response = await fetch('/api/questions?page=1&pageSize=1', { credentials: 'include' });
    return response.status;
  });
  const result = {
    redirectedToPasswordChange: page.url().endsWith('/change-password'),
    protectedApiStatus,
  };
  console.log(JSON.stringify(result));
  if (!result.redirectedToPasswordChange || result.protectedApiStatus !== 428) process.exitCode = 1;
} finally {
  await browser.close();
}
