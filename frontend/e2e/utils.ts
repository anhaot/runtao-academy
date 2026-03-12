import { APIRequestContext, expect, Page } from '@playwright/test';

export const adminUser = {
  username: 'e2e_admin',
  email: 'e2e_admin@example.com',
  password: 'AdminPass123',
};

const apiBaseUrl = 'http://127.0.0.1:3102/api';

type LoginResult = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'user';
    permissions: Record<string, boolean>;
  };
};

export async function readCaptchaText(page: Page, testId: string): Promise<string> {
  const captcha = await page.locator(`[data-testid="${testId}"]`).evaluate((element) => {
    return Array.from(element.querySelectorAll('text'))
      .map((node) => node.textContent || '')
      .join('')
      .trim();
  });
  expect(captcha).not.toBe('');
  return captcha;
}

export async function loginByUi(page: Page, username: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  const captcha = await readCaptchaText(page, 'login-captcha-svg');
  await expect(page.getByTestId('login-captcha')).toBeVisible();
  await page.getByTestId('login-captcha').fill(captcha);
  await page.locator('form').evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });
}

export async function registerUser(request: APIRequestContext, suffix: string): Promise<{ username: string; email: string; password: string }> {
  const user = {
    username: `e2e_user_${suffix}`,
    email: `e2e_user_${suffix}@example.com`,
    password: 'Password123',
  };

  const response = await request.post(`${apiBaseUrl}/auth/register`, {
    data: user,
  });
  expect(response.ok()).toBeTruthy();
  return user;
}

export async function apiLogin(request: APIRequestContext, username: string, password: string): Promise<LoginResult> {
  const response = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { username, password },
  });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

export async function primeAuth(page: Page, login: LoginResult): Promise<void> {
  await page.addInitScript((payload) => {
    localStorage.setItem('token', payload.token);
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({
        state: {
          user: payload.user,
          token: payload.token,
          isAuthenticated: true,
        },
        version: 0,
      })
    );
  }, login);
}

export async function createQuestion(request: APIRequestContext, token: string, payload: {
  title: string;
  content: string;
  answer: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}) {
  const response = await request.post(`${apiBaseUrl}/questions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: payload,
  });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}

export async function getQuestion(request: APIRequestContext, token: string, questionId: string) {
  const response = await request.get(`${apiBaseUrl}/questions/${questionId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}
