import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATABASE_TYPE = 'sqlite';
process.env.SQLITE_PATH = path.join(os.tmpdir(), `runtao-academy-test-${Date.now()}.db`);
process.env.AI_ENABLED = 'false';

type LoginResult = {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
};

let app: ReturnType<typeof request>;
let db: Awaited<typeof import('../src/database/index.js')>['db'];

async function createUser(username: string, email: string, password: string): Promise<LoginResult> {
  const registerResponse = await app
    .post('/api/auth/register')
    .send({ username, email, password });

  assert.equal(registerResponse.status, 201);
  return registerResponse.body as LoginResult;
}

async function createQuestion(userId: string, title: string) {
  return db.createQuestion({
    id: uuidv4(),
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
    id: uuidv4(),
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
