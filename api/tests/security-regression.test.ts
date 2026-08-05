import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { UserPermissions } from '../src/types/index.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.AI_CONFIG_ENCRYPTION_KEY = '1111111111111111111111111111111111111111111111111111111111111111';
process.env.DATABASE_TYPE = 'sqlite';
process.env.SQLITE_PATH = path.join(os.tmpdir(), `tech-growth-hub-test-${Date.now()}.db`);
process.env.AI_ENABLED = 'false';
process.env.TRUST_PROXY = '1';
process.env.AUTH_COOKIE_SECURE = 'auto';
process.env.INIT_ADMIN_USERNAME = 'admin';
process.env.INIT_ADMIN_EMAIL = 'admin@localhost';
process.env.INIT_ADMIN_PASSWORD = 'admin';
process.env.INIT_ADMIN_FORCE_PASSWORD_CHANGE = 'true';

type LoginResult = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    must_change_password: boolean;
  };
};

let app: ReturnType<typeof request>;
let db: Awaited<typeof import('../src/database/index.js')>['db'];
let testIpSequence = 30;

function nextTestIp(): string {
  testIpSequence += 1;
  return `203.0.113.${testIpSequence}`;
}

const NO_PERMISSIONS: UserPermissions = {
  question_view: false,
  question_create: false,
  question_edit_content: false,
  question_edit_meta: false,
  question_delete: false,
  question_batch_edit: false,
  category_view: false,
  category_manage: false,
  import_manage: false,
  question_export: false,
  ai_use: false,
  ai_generate: false,
  ai_config_manage: false,
  ai_chat: false,
  tag_manage: false,
  duplicate_manage: false,
  backup_export: false,
  backup_restore: false,
  ai_polish: false,
  system_manage: false,
  user_manage: false,
};

async function createUser(username: string, email: string, password: string): Promise<LoginResult> {
  const registerResponse = await app
    .post('/api/auth/register')
    .set('X-Forwarded-For', nextTestIp())
    .send({ username, email, password });

  assert.equal(registerResponse.status, 201);
  return registerResponse.body as LoginResult;
}

async function createQuestion(userId: string, title: string) {
  return db.createQuestion({
    id: randomUUID(),
    title,
    content: `${title} content`,
    answer: `${title} answer`,
    explanation: null,
    difficulty: 'medium',
    category_id: null,
    user_id: userId,
    tags: '[]',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

async function createAiConfig(userId: string) {
  return db.createAIConfig({
    id: randomUUID(),
    user_id: userId,
    provider: 'openai',
    display_name: 'test-openai',
    base_url: 'https://api.openai.com/v1',
    api_key: 'secret-key',
    model: 'gpt-4o-mini',
    is_active: true,
    is_custom: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

test.before(async () => {
  const [{ createApp }, databaseModule] = await Promise.all([
    import('../src/app.js'),
    import('../src/database/index.js'),
  ]);

  db = databaseModule.db;
  await db.connect();
  app = request(createApp());
});

test.after(async () => {
  await db.close();
  if (fs.existsSync(process.env.SQLITE_PATH!)) {
    fs.unlinkSync(process.env.SQLITE_PATH!);
  }
});

test('default admin must change the initial password before using protected APIs', async () => {
  const initialLogin = await app
    .post('/api/auth/login')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ username: 'admin', password: 'admin' });

  assert.equal(initialLogin.status, 200);
  assert.equal(initialLogin.body.user.role, 'admin');
  assert.equal(initialLogin.body.user.must_change_password, true);

  const token = initialLogin.body.token as string;
  const blocked = await app
    .get('/api/questions')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(blocked.status, 428);
  assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const changed = await app
    .put('/api/auth/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ password: 'AdminPass123' });
  assert.equal(changed.status, 200);
  assert.equal(changed.body.must_change_password, false);

  const allowed = await app
    .get('/api/questions')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(allowed.status, 200);

  const oldPasswordLogin = await app
    .post('/api/auth/login')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ username: 'admin', password: 'admin' });
  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await app
    .post('/api/auth/login')
    .set('X-Forwarded-For', '203.0.113.10')
    .send({ username: 'admin', password: 'AdminPass123' });
  assert.equal(newPasswordLogin.status, 200);
  assert.equal(newPasswordLogin.body.user.must_change_password, false);
});

test('register endpoint is blocked when allow_register is disabled', async () => {
  await db.setSetting('allow_register', 'false');

  const response = await app
    .post('/api/auth/register')
    .send({
      username: 'blocked-user',
      email: 'blocked@example.com',
      password: 'Password123',
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, '当前已关闭注册');

  await db.setSetting('allow_register', 'true');
});

test('authentication cookies follow the actual HTTP or HTTPS request protocol', async () => {
  const httpResponse = await app
    .post('/api/auth/register')
    .set('X-Forwarded-For', '203.0.113.20')
    .send({
      username: 'http-cookie-user',
      email: 'http-cookie@example.com',
      password: 'Password123',
    });
  assert.equal(httpResponse.status, 201);
  const httpCookies = httpResponse.headers['set-cookie'] as unknown as string[];
  assert.equal(httpCookies.length, 2);
  assert.ok(httpCookies.every((cookie) => !cookie.includes('; Secure')));

  const httpsResponse = await app
    .post('/api/auth/register')
    .set('X-Forwarded-For', '203.0.113.21')
    .set('X-Forwarded-Proto', 'https')
    .send({
      username: 'https-cookie-user',
      email: 'https-cookie@example.com',
      password: 'Password123',
    });
  assert.equal(httpsResponse.status, 201);
  const httpsCookies = httpsResponse.headers['set-cookie'] as unknown as string[];
  assert.equal(httpsCookies.length, 2);
  assert.ok(httpsCookies.every((cookie) => cookie.includes('; Secure')));
});

test('batch delete only deletes questions owned by the current user', async () => {
  const owner = await createUser('owner-user', 'owner@example.com', 'Password123');
  const other = await createUser('other-user', 'other@example.com', 'Password123');

  const ownerQuestion = await createQuestion(owner.user.id, 'owner-question');
  const otherQuestion = await createQuestion(other.user.id, 'other-question');

  const response = await app
    .post('/api/questions/batch-delete')
    .set('Authorization', `Bearer ${owner.token}`)
    .send({ ids: [ownerQuestion.id, otherQuestion.id] });

  assert.equal(response.status, 200);
  assert.match(response.body.message, /已删除 1 道题目/);
  assert.equal(await db.getQuestionById(ownerQuestion.id), undefined);
  assert.notEqual(await db.getQuestionById(otherQuestion.id), undefined);
});

test('users cannot update or delete another user AI config', async () => {
  const configOwner = await createUser('config-owner', 'config-owner@example.com', 'Password123');
  const attacker = await createUser('config-attacker', 'config-attacker@example.com', 'Password123');
  const aiConfig = await createAiConfig(configOwner.user.id);

  const updateResponse = await app
    .put(`/api/ai/config/${aiConfig.id}`)
    .set('Authorization', `Bearer ${attacker.token}`)
    .send({ model: 'gpt-4.1-mini' });

  assert.equal(updateResponse.status, 404);

  const deleteResponse = await app
    .delete(`/api/ai/config/${aiConfig.id}`)
    .set('Authorization', `Bearer ${attacker.token}`);

  assert.equal(deleteResponse.status, 404);
  assert.notEqual(await db.getAIConfigById(aiConfig.id), undefined);
});

test('AI status lists every configured model and provider names prefer the active config', async () => {
  const owner = await createUser('model-selector', 'model-selector@example.com', 'Password123');
  const olderConfig = await db.createAIConfig({
    id: randomUUID(),
    user_id: owner.user.id,
    provider: 'openai',
    display_name: 'Older model',
    base_url: 'https://api.openai.com/v1',
    api_key: 'older-secret',
    model: 'older-model',
    is_active: false,
    is_custom: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  const activeConfig = await db.createAIConfig({
    id: randomUUID(),
    user_id: owner.user.id,
    provider: 'openai',
    display_name: 'Active model',
    base_url: 'https://api.openai.com/v1',
    api_key: 'active-secret',
    model: 'active-model',
    is_active: true,
    is_custom: false,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  });

  const status = await app
    .get('/api/ai/status')
    .set('Authorization', `Bearer ${owner.token}`);
  assert.equal(status.status, 200);
  assert.equal(status.body.defaultConfigId, activeConfig.id);
  assert.equal(status.body.availableModels.length, 2);
  assert.deepEqual(
    new Set(status.body.availableModels.map((model: { id: string }) => model.id)),
    new Set([olderConfig.id, activeConfig.id])
  );

  const { aiService } = await import('../src/services/ai.js');
  const selectedByLegacyName = await aiService.getProvider('openai', { userId: owner.user.id, role: 'user' });
  assert.equal(selectedByLegacyName.name, 'Active model');
  const selectedById = await aiService.getProvider(olderConfig.id, { userId: owner.user.id, role: 'user' });
  assert.equal(selectedById.name, 'Older model');
});

test('custom AI models reference separately managed credentials', async () => {
  const login = await app
    .post('/api/auth/login')
    .set('X-Forwarded-For', nextTestIp())
    .send({ username: 'admin', password: 'AdminPass123' });
  assert.equal(login.status, 200);
  const token = login.body.token as string;

  const invalidCredential = await app
    .post('/api/ai/credentials')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Invalid NVIDIA', baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: 'not-a-key' });
  assert.equal(invalidCredential.status, 400);
  assert.match(invalidCredential.body.error, /nvapi-/);

  const credential = await app
    .post('/api/ai/credentials')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'NVIDIA test', baseUrl: 'https://integrate.api.nvidia.com/v1', apiKey: 'nvapi-test-secret' });
  assert.equal(credential.status, 201);
  assert.equal(credential.body.apiKey, undefined);

  const aiConfig = await app
    .post('/api/ai/config')
    .set('Authorization', `Bearer ${token}`)
    .send({
      provider: 'nvidia',
      displayName: 'Test model',
      model: 'test/model',
      isCustom: true,
      credentialId: credential.body.id,
    });
  assert.equal(aiConfig.status, 201);
  assert.equal(aiConfig.body.credentialId, credential.body.id);

  const cannotDeleteInUse = await app
    .delete(`/api/ai/credentials/${credential.body.id}`)
    .set('Authorization', `Bearer ${token}`);
  assert.equal(cannotDeleteInUse.status, 409);
});

test('stored AI credentials and exported backups are encrypted at rest', async () => {
  const owner = await createUser('encrypted-config', 'encrypted-config@example.com', 'Password123');
  const aiConfig = await createAiConfig(owner.user.id);

  const loaded = await db.getAIConfigById(aiConfig.id);
  assert.equal(loaded?.api_key, 'secret-key');

  const backup = await db.exportAllData();
  const rawConfig = backup.ai_configs.find((item) => item.id === aiConfig.id);
  assert.equal(typeof rawConfig?.api_key, 'string');
  assert.match(String(rawConfig?.api_key), /^enc:v1:/);
  assert.notEqual(rawConfig?.api_key, 'secret-key');
});

test('AI question endpoints cannot access another user question', async () => {
  const questionOwner = await createUser('question-owner', 'question-owner@example.com', 'Password123');
  const attacker = await createUser('question-attacker', 'question-attacker@example.com', 'Password123');
  const question = await createQuestion(questionOwner.user.id, 'private-question');

  const response = await app
    .post('/api/ai/analyze')
    .set('Authorization', `Bearer ${attacker.token}`)
    .send({ questionId: question.id });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, '题目不存在');
});

test('cookie authenticated writes require a matching CSRF token', async () => {
  const registerResponse = await app
    .post('/api/auth/register')
    .send({ username: 'csrf-user', email: 'csrf@example.com', password: 'Password123' });
  assert.equal(registerResponse.status, 201);

  const setCookies = registerResponse.headers['set-cookie'] as unknown as string[];
  const cookieHeader = setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
  const csrfToken = setCookies
    .map((cookie) => cookie.split(';')[0])
    .find((cookie) => cookie.startsWith('tgh_csrf='))
    ?.slice('tgh_csrf='.length);
  assert.ok(csrfToken);

  const rejected = await app
    .post('/api/questions')
    .set('Cookie', cookieHeader)
    .send({ title: 'csrf rejected', content: 'csrf rejected' });
  assert.equal(rejected.status, 403);

  const accepted = await app
    .post('/api/questions')
    .set('Cookie', cookieHeader)
    .set('X-CSRF-Token', csrfToken)
    .send({ title: 'csrf accepted', content: 'csrf accepted' });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.answer, '');
});

test('question viewing and content or metadata edits honor their individual permissions', async () => {
  const user = await createUser('metadata-editor', 'metadata-editor@example.com', 'Password123');
  const question = await createQuestion(user.user.id, 'metadata-edit-question');

  await db.updateUser(user.user.id, {
    permissions: {
      ...NO_PERMISSIONS,
      question_edit_meta: true,
    },
  });

  const visible = await app
    .get('/api/questions')
    .set('Authorization', `Bearer ${user.token}`);
  assert.equal(visible.status, 200);

  const metadataUpdate = await app
    .put(`/api/questions/${question.id}`)
    .set('Authorization', `Bearer ${user.token}`)
    .send({ difficulty: 'hard' });
  assert.equal(metadataUpdate.status, 200);
  assert.equal(metadataUpdate.body.difficulty, 'hard');

  const contentUpdate = await app
    .put(`/api/questions/${question.id}`)
    .set('Authorization', `Bearer ${user.token}`)
    .send({ content: 'not allowed' });
  assert.equal(contentUpdate.status, 403);
  assert.equal(contentUpdate.body.error, '没有编辑题目内容权限');

  await db.updateUser(user.user.id, { permissions: NO_PERMISSIONS });
  const hidden = await app
    .get('/api/questions')
    .set('Authorization', `Bearer ${user.token}`);
  assert.equal(hidden.status, 403);
});

test('specialized AI permissions imply AI use without letting AI use bypass them', async () => {
  const aiUser = await createUser('ai-use-only', 'ai-use-only@example.com', 'Password123');
  await db.updateUser(aiUser.user.id, {
    permissions: {
      ...NO_PERMISSIONS,
      ai_use: true,
    },
  });

  const statusResponse = await app
    .get('/api/ai/status')
    .set('Authorization', `Bearer ${aiUser.token}`);
  assert.equal(statusResponse.status, 200);

  const configResponse = await app
    .get('/api/ai/config')
    .set('Authorization', `Bearer ${aiUser.token}`);
  assert.equal(configResponse.status, 403);

  const settingsResponse = await app
    .put('/api/ai/settings')
    .set('Authorization', `Bearer ${aiUser.token}`)
    .send({ enabled: true });
  assert.equal(settingsResponse.status, 403);

  const generateResponse = await app
    .post('/api/ai/batch-generate')
    .set('Authorization', `Bearer ${aiUser.token}`)
    .send({ topic: 'HTTP', count: 1 });
  assert.equal(generateResponse.status, 403);

  const generator = await createUser('ai-generator-only', 'ai-generator-only@example.com', 'Password123');
  await db.updateUser(generator.user.id, {
    permissions: {
      ...NO_PERMISSIONS,
      ai_generate: true,
    },
  });
  const generatorStatus = await app
    .get('/api/ai/status')
    .set('Authorization', `Bearer ${generator.token}`);
  assert.equal(generatorStatus.status, 200);
});

test('demoting an administrator through the user editor revokes administrator permissions', async () => {
  const adminLogin = await app
    .post('/api/auth/login')
    .set('X-Forwarded-For', nextTestIp())
    .send({ username: 'admin', password: 'AdminPass123' });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.body.token as string;

  const created = await app
    .post('/api/admin/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      username: 'demoted-admin',
      email: 'demoted-admin@example.com',
      password: 'Password123',
      role: 'admin',
      userType: 'independent',
    });
  assert.equal(created.status, 201);

  const demoted = await app
    .put(`/api/admin/users/${created.body.id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ role: 'user', permissions: NO_PERMISSIONS });
  assert.equal(demoted.status, 200);
  assert.equal(demoted.body.role, 'user');
  assert.equal(demoted.body.permissions.system_manage, false);
  assert.equal(demoted.body.permissions.user_manage, false);

  const demotedLogin = await app
    .post('/api/auth/login')
    .set('X-Forwarded-For', nextTestIp())
    .send({ username: 'demoted-admin', password: 'Password123' });
  assert.equal(demotedLogin.status, 200);

  const denied = await app
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${demotedLogin.body.token}`);
  assert.equal(denied.status, 403);
});

test('integrated user dashboard counts the visible shared library', async () => {
  const owner = await createUser('stats-owner', 'stats-owner@example.com', 'Password123');
  const member = await createUser('stats-member', 'stats-member@example.com', 'Password123');
  const category = await db.createCategory({
    id: randomUUID(),
    name: 'Shared stats category',
    description: null,
    parent_id: null,
    user_id: owner.user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await db.createQuestion({
    id: randomUUID(),
    title: 'shared-stats-question',
    content: 'shared-stats-question content',
    answer: 'shared-stats-question answer',
    explanation: null,
    difficulty: 'medium',
    category_id: category.id,
    user_id: owner.user.id,
    tags: '[]',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await db.updateUser(member.user.id, {
    user_type: 'integrated',
    library_owner_id: owner.user.id,
    category_scopes: [category.id],
    permissions: {
      ...NO_PERMISSIONS,
      question_view: true,
      category_view: true,
    },
  });

  const questions = await app
    .get('/api/questions')
    .set('Authorization', `Bearer ${member.token}`);
  assert.equal(questions.status, 200);
  assert.equal(questions.body.total, 1);

  const stats = await app
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${member.token}`);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.questionCount, 1);
  assert.equal(stats.body.categoryCount, 1);
});
