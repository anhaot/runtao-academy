import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:10089';
const outputDir = new URL('../../output/playwright/', import.meta.url).pathname;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const issues = [];

try {
  await mkdir(outputDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      issues.push(`console: ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    const expectedAnonymousProbe = response.status() === 401 && response.url().endsWith('/api/auth/me');
    if (response.status() >= 400 && response.url().includes('/api/') && !expectedAnonymousProbe) {
      issues.push(`http ${response.status()}: ${response.url()}`);
    }
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outputDir}login-desktop.png`, fullPage: true });
  await page.getByTestId('login-username').fill('admin');
  await page.getByTestId('login-password').fill('admin');
  const captcha = await page.getByTestId('login-captcha-svg').locator('text').allTextContents();
  await page.getByTestId('login-captcha').fill(captcha.join('').trim());
  await page.locator('form').evaluate((form) => form.requestSubmit());
  await page.waitForURL(`${baseUrl}/`, { timeout: 15_000 });

  const routes = [
    ['home', '/'],
    ['questions', '/questions'],
    ['capture', '/capture'],
    ['study', '/study'],
    ['quiz', '/quiz'],
    ['bookmarks', '/bookmarks'],
    ['settings', '/settings'],
  ];

  for (const [name, path] of routes) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${outputDir}${name}-desktop.png`, fullPage: true });
  }

  const memoryLinks = await page.getByRole('link', { name: /记忆/ }).count();
  if (memoryLinks !== 0) issues.push(`memory navigation remains: ${memoryLinks}`);

  await page.goto(`${baseUrl}/study`, { waitUntil: 'networkidle' });
  const questionCount = await page.getByText('/ 215', { exact: true }).count();
  if (questionCount === 0) issues.push('study page did not expose the migrated 215-question total');
  if (await page.getByText('题库暂时加载失败').count()) issues.push('study page reported a load failure');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, path] of [['capture', '/capture'], ['study', '/study']]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${outputDir}${name}-mobile.png`, fullPage: true });
  }

  const anonymousContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const anonymousPage = await anonymousContext.newPage();
  await anonymousPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await anonymousPage.screenshot({ path: `${outputDir}login-mobile.png`, fullPage: true });
  await anonymousContext.close();

  console.log(JSON.stringify({ routes: routes.length, migratedQuestionsVisible: questionCount > 0, issues }));
  if (issues.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
