import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { authMiddleware, AuthRequest, getLibraryOwnerId, hasCategoryScopeAccess, requirePermission } from '../middleware/auth.js';
import { aiService } from '../services/ai.js';
import { config } from '../config/index.js';
import { User } from '../types/index.js';
import { validateAIBaseUrl } from '../utils/aiConfigSecurity.js';
import { normalizeTagsInput, parseStoredTags, parseTagAliasMap, TagAliasMap } from '../utils/tags.js';

const router = Router();
router.use(authMiddleware, requirePermission('ai_use', '没有AI使用权限'));

const aiConfigSchema = z.object({
  provider: z.string().min(1).max(50),
  displayName: z.string().max(100).optional(),
  baseUrl: z.string().url().max(500).optional().or(z.literal('')),
  apiKey: z.string().min(1).max(200),
  model: z.string().min(1).max(100),
  isCustom: z.boolean().optional(),
});

const aiSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  defaultProvider: z.string().max(50).optional(),
});

const batchGenerateSchema = z.object({
  topic: z.string().min(2).max(200),
  count: z.number().int().min(1).max(20).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  mode: z.enum(['quick', 'practice', 'teaching']).default('practice'),
  requirements: z.string().max(2000).optional(),
  provider: z.string().max(100).optional(),
  categoryName: z.string().max(100).optional(),
});

const polishQuestionSchema = z.object({
  questionId: z.string().uuid(),
  mode: z.enum(['light', 'deep']).default('light'),
  provider: z.string().max(100).optional(),
});

const answerDraftSchema = z.object({
  questionId: z.string().uuid(),
  mode: z.enum(['quick', 'practice', 'teaching']).default('practice'),
  provider: z.string().max(100).optional(),
});

const batchTagsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  mode: z.enum(['add', 'replace']).default('add'),
  provider: z.string().max(100).optional(),
});

function sanitizePrompt(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .substring(0, 10000);
}

function tryParseJson<T>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function normalizeGeneratedQuestionList(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (
    parsed
    && typeof parsed === 'object'
    && 'questions' in parsed
    && Array.isArray((parsed as { questions?: unknown[] }).questions)
  ) {
    return (parsed as { questions: unknown[] }).questions;
  }

  return null;
}

function extractGeneratedQuestions(result: string): Array<{
  title: string;
  content: string;
  answer: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}> {
  const directParsed = normalizeGeneratedQuestionList(tryParseJson(result));
  const fencedParsed = normalizeGeneratedQuestionList(
    tryParseJson(result.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] || '')
  );
  const objectParsed = normalizeGeneratedQuestionList(
    tryParseJson(result.match(/\{[\s\S]*\}/)?.[0] || '')
  );
  const arrayParsed = normalizeGeneratedQuestionList(
    tryParseJson(result.match(/\[[\s\S]*\]/)?.[0] || '')
  );

  const parsed = directParsed || fencedParsed || objectParsed || arrayParsed;
  if (!parsed) {
    throw new Error('AI 未返回可解析的题目数组');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('AI 未返回有效题目');
  }

  return parsed.map((item: any, index: number) => {
    if (!item?.content || !item?.answer) {
      throw new Error(`第 ${index + 1} 道题缺少 content 或 answer`);
    }

    return {
      title: sanitizePrompt(item.title || item.content.slice(0, 100)),
      content: sanitizePrompt(item.content),
      answer: sanitizePrompt(item.answer),
      explanation: item.explanation ? sanitizePrompt(item.explanation) : '',
      difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
      tags: normalizeTagsInput(Array.isArray(item.tags) ? item.tags.map((tag: string) => sanitizePrompt(String(tag))) : []),
    };
  });
}

function applyTagAliasesToGeneratedQuestions(
  questions: Array<{
    title: string;
    content: string;
    answer: string;
    explanation?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    tags?: string[];
  }>,
  aliases: TagAliasMap
) {
  return questions.map((question) => ({
    ...question,
    tags: normalizeTagsInput(question.tags || [], aliases),
  }));
}

function extractJsonObject(result: string, errorMessage: string) {
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(errorMessage);
  }
  return JSON.parse(jsonMatch[0]);
}

async function getAccessibleQuestion(user: User, questionId: string) {
  const ownerId = getLibraryOwnerId(user);
  const question = await db.getQuestionByIdForUser(questionId, ownerId, user.role === 'admin');
  if (!question) {
    return null;
  }

  if (!hasCategoryScopeAccess(user, question.category_id)) {
    return null;
  }

  return question;
}

router.get('/status', authMiddleware, requirePermission('ai_use', '没有AI使用权限'), async (req: AuthRequest, res: Response) => {
  const userConfigs = await db.getAIConfigsByUserId(req.user!.id);
  const activeConfig = userConfigs.find(c => c.is_active);
  
  res.json({
    enabled: config.ai.enabled,
    defaultProvider: activeConfig?.provider || config.ai.defaultProvider,
    availableProviders: userConfigs.filter(c => c.is_active).map(c => c.display_name || c.provider),
  });
});

router.put('/settings', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = aiSettingsSchema.parse(req.body);
    
    if (data.enabled !== undefined) {
      config.ai.enabled = data.enabled;
    }
    
    res.json({
      enabled: config.ai.enabled,
      defaultProvider: config.ai.defaultProvider,
      availableProviders: aiService.getAvailableProviders(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '更新AI设置失败' });
  }
});

router.get('/config', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const configs = await db.getAIConfigsByUserId(req.user!.id);
    res.json(configs.map(c => ({
      id: c.id,
      provider: c.provider,
      displayName: c.display_name,
      baseUrl: c.base_url,
      model: c.model,
      isActive: c.is_active,
      isCustom: c.is_custom,
      createdAt: c.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: '获取AI配置失败' });
  }
});

router.post('/config', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = aiConfigSchema.parse(req.body);
    const normalizedBaseUrl = validateAIBaseUrl(data.baseUrl, req.user!, Boolean(data.isCustom));

    await db.run('UPDATE ai_configs SET is_active = 0 WHERE user_id = ?', [req.user!.id]);

    const aiConfig = await db.createAIConfig({
      id: uuidv4(),
      user_id: req.user!.id,
      provider: data.provider,
      display_name: data.displayName,
      base_url: normalizedBaseUrl,
      api_key: data.apiKey,
      model: data.model,
      is_active: true,
      is_custom: data.isCustom ? true : false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.status(201).json({
      id: aiConfig.id,
      provider: aiConfig.provider,
      displayName: aiConfig.display_name,
      baseUrl: aiConfig.base_url,
      model: aiConfig.model,
      isActive: aiConfig.is_active,
      isCustom: aiConfig.is_custom,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '创建AI配置失败' });
  }
});

router.put('/config/:id', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = aiConfigSchema.partial().parse(req.body);
    const existing = await db.getAIConfigByIdForUser(req.params.id, req.user!.id);
    if (!existing) {
      res.status(404).json({ error: '配置不存在' });
      return;
    }
    
    const nextIsCustom = data.isCustom ?? existing.is_custom;
    const nextBaseUrl = data.baseUrl !== undefined
      ? validateAIBaseUrl(data.baseUrl, req.user!, Boolean(nextIsCustom))
      : existing.base_url;

    const updated = await db.updateAIConfig(req.params.id, {
      provider: data.provider,
      display_name: data.displayName,
      base_url: nextBaseUrl,
      api_key: data.apiKey,
      model: data.model,
    });

    if (!updated) {
      res.status(404).json({ error: '配置不存在' });
      return;
    }

    res.json({
      id: updated.id,
      provider: updated.provider,
      displayName: updated.display_name,
      baseUrl: updated.base_url,
      model: updated.model,
      isActive: updated.is_active,
      isCustom: updated.is_custom,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '更新AI配置失败' });
  }
});

router.delete('/config/:id', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await db.deleteAIConfigForUser(req.params.id, req.user!.id);
    if (!deleted) {
      res.status(404).json({ error: '配置不存在' });
      return;
    }
    res.json({ message: '配置已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除AI配置失败' });
  }
});

router.put('/config/:id/active', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const configs = await db.getAIConfigsByUserId(req.user!.id);
    const config = configs.find(c => c.id === req.params.id);
    
    if (!config) {
      res.status(404).json({ error: '配置不存在' });
      return;
    }
    
    await db.run('UPDATE ai_configs SET is_active = 0 WHERE user_id = ?', [req.user!.id]);
    await db.run('UPDATE ai_configs SET is_active = 1 WHERE id = ?', [req.params.id]);
    
    res.json({ message: '已切换为当前使用的配置' });
  } catch (error) {
    res.status(500).json({ error: '设置活跃配置失败' });
  }
});

router.post('/analyze', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, provider } = req.body;
    
    if (!questionId || typeof questionId !== 'string') {
      res.status(400).json({ error: '无效的题目ID' });
      return;
    }

    const question = await getAccessibleQuestion(req.user!, questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = sanitizePrompt(provider || userConfig?.provider || config.ai.defaultProvider);
    
    console.log('AI Analyze request:', { questionId, provider, providerName, userConfig });

    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });
    
    const prompt = `请分析以下题目，提供详细的解题思路和知识点：

题目：${sanitizePrompt(question.title)}
内容：${sanitizePrompt(question.content)}
答案：${sanitizePrompt(question.answer)}

请提供：
1. 题目分析
2. 解题思路
3. 相关知识点
4. 易错点提示`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    res.json({ result });
  } catch (error) {
    console.error('AI Analyze error:', error);
    res.status(500).json({ error: 'AI分析失败: ' + (error as Error).message });
  }
});

router.post('/expand', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, provider } = req.body;
    
    const question = await getAccessibleQuestion(req.user!, questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = provider || userConfig?.provider || config.ai.defaultProvider;
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });

    const prompt = `请扩展以下题目的答案，提供更详细的解释：

题目：${question.title}
内容：${question.content}
答案：${question.answer}

请提供更详细的答案解释，包括：
1. 详细解答过程
2. 相关概念解释
3. 实际应用场景`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'AI扩展失败: ' + (error as Error).message });
  }
});

router.post('/recommend', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, provider } = req.body;
    
    const question = await getAccessibleQuestion(req.user!, questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = provider || userConfig?.provider || config.ai.defaultProvider;
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });

    const prompt = `基于以下题目，推荐相关的学习知识点：

题目：${question.title}
内容：${question.content}
答案：${question.answer}

请推荐：
1. 相关知识点
2. 学习资源建议
3. 练习建议`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'AI推荐失败: ' + (error as Error).message });
  }
});

router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, count, provider } = req.body;
    
    const question = await getAccessibleQuestion(req.user!, questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = provider || userConfig?.provider || config.ai.defaultProvider;
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });

    const prompt = `请基于以下题目生成${count || 3}道类似的练习题：

题目：${question.title}
内容：${question.content}
答案：${question.answer}

请生成${count || 3}道类似的题目，每道题包含：
1. 题目内容
2. 参考答案
3. 解析`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'AI生成失败: ' + (error as Error).message });
  }
});

router.post('/explain', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { concept, context, provider } = req.body;

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = provider || userConfig?.provider || config.ai.defaultProvider;
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });

    const prompt = context
      ? `请解释以下概念：${concept}

上下文：${context}

请提供详细的解释，包括定义、特点、应用场景等。`
      : `请解释以下概念：${concept}

请提供详细的解释，包括定义、特点、应用场景等。`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'AI解释失败: ' + (error as Error).message });
  }
});

router.post('/chat', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { questionId, message, provider } = req.body;
    
    const question = await getAccessibleQuestion(req.user!, questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = provider || userConfig?.provider || config.ai.defaultProvider;
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });

    const prompt = `关于以下题目，用户提出了一个问题，请详细回答：

题目：${question.title}
内容：${question.content}
答案：${question.answer}

用户问题：${message}

请提供详细、有帮助的回答。`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: 'AI对话失败: ' + (error as Error).message });
  }
});

router.post('/test-config', authMiddleware, requirePermission('ai_config_manage', '没有AI配置权限'), async (req: AuthRequest, res: Response) => {
  try {
    const { configId } = req.body;
    
    const configs = await db.getAIConfigsByUserId(req.user!.id);
    const config = configs.find(c => c.id === configId);
    
    if (!config) {
      res.status(404).json({ error: '配置不存在' });
      return;
    }

    const { OpenAICompatibleProvider } = await import('../services/ai.js');
    const defaultBaseUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      doubao: 'https://ark.cn-beijing.volces.com/api/v3',
      wenxin: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    };

    const baseUrl = validateAIBaseUrl(config.base_url || defaultBaseUrls[config.provider] || 'https://api.openai.com/v1', req.user!, Boolean(config.is_custom));
    const aiProvider = new OpenAICompatibleProvider(
      config.display_name || config.provider,
      config.api_key,
      config.model,
      baseUrl,
      30000
    );
    
    const testPrompt = '请回复"测试成功"';
    const result = await aiProvider.chat([{ role: 'user', content: testPrompt }]);
    
    res.json({ success: true, message: '配置测试成功', result });
  } catch (error) {
    console.error('Config test error:', error);
    const errorMessage = (error as Error).message;
    
    if (errorMessage.includes('连接超时')) {
      res.status(500).json({ error: '配置测试失败：连接超时，请检查网络或API地址是否正确' });
    } else if (errorMessage.includes('连接被拒绝')) {
      res.status(500).json({ error: '配置测试失败：连接被拒绝，请检查API地址和端口' });
    } else if (errorMessage.includes('无法解析API地址')) {
      res.status(500).json({ error: '配置测试失败：无法解析API地址，请检查base_url是否正确' });
    } else if (errorMessage.includes('API error')) {
      res.status(500).json({ error: '配置测试失败：API密钥无效或模型名称错误' });
    } else {
      res.status(500).json({ error: '配置测试失败：' + errorMessage });
    }
  }
});

router.post('/batch-generate', authMiddleware, requirePermission('ai_generate', '没有AI生题权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = batchGenerateSchema.parse(req.body);
    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = sanitizePrompt(data.provider || userConfig?.provider || config.ai.defaultProvider);
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });

    const modeInstructionMap: Record<'quick' | 'practice' | 'teaching', string> = {
      quick: [
        '生成模式：速记版',
        'answer 以关键词、短句或结论为主，优先控制在 1 到 2 行内，便于快速记忆。',
        'explanation 保持简短，只补充最必要的理解线索，不要展开长篇说明。',
      ].join('\n'),
      practice: [
        '生成模式：练习版',
        'answer 保持完整、准确、适中，尽量比速记版更具体，可补足关键定义、结论或步骤，适合日常刷题和复习。',
        'explanation 提供中等偏丰富的解析，可包含 2 到 4 个关键点，适当补充背景、常见误区或记忆提示，但整体不要像教学版那样过长。',
      ].join('\n'),
      teaching: [
        '生成模式：教学版',
        'answer 需要更完整具体，尽量分点表达，说明关键步骤、要点或组成部分。',
        'explanation 需要明显更详细，可补充背景、易错点、对比说明或记忆提示，帮助初学者理解。',
      ].join('\n'),
    };

    const prompt = `你是一个专业出题助手。请围绕主题“${sanitizePrompt(data.topic)}”生成 ${data.count} 道适合记忆背题的题目。

输出要求：
1. 只返回 JSON 数组，不要输出 markdown，不要输出解释文字
2. 每道题包含 title、content、answer、explanation、difficulty、tags
3. difficulty 只能是 easy、medium、hard
4. answer 要准确、精炼、适合背诵
5. explanation 用于快速理解和记忆
6. tags 必须是字符串数组，且每道题最多 5 个标签
7. 题目不要重复，尽量覆盖不同考点

附加条件：
- 目标难度：${data.difficulty === 'mixed' ? '混合难度，按 easy/medium/hard 合理分布' : data.difficulty}
- ${modeInstructionMap[data.mode]}
- 目标分类：${sanitizePrompt(data.categoryName || '未指定')}
- 额外要求：${sanitizePrompt(data.requirements || '无')}

返回格式示例：
[
  {
    "title": "HTTP 常见状态码",
    "content": "说出 200、301、404、500 的含义。",
    "answer": "200 成功；301 永久重定向；404 资源不存在；500 服务器内部错误。",
    "explanation": "这是最常见的一组 HTTP 状态码，适合记忆排障。",
    "difficulty": "easy",
    "tags": ["HTTP", "状态码"]
  }
]`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const questions = applyTagAliasesToGeneratedQuestions(extractGeneratedQuestions(result), tagAliases);

    res.json({ questions, raw: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    console.error('AI batch generate error:', error);
    res.status(500).json({ error: 'AI批量生题失败: ' + (error as Error).message });
  }
});

router.post('/polish-question', authMiddleware, requirePermission('ai_polish', '没有AI润色权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = polishQuestionSchema.parse(req.body);
    const question = await getAccessibleQuestion(req.user!, data.questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = sanitizePrompt(data.provider || userConfig?.provider || config.ai.defaultProvider);
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));

    const polishInstructionMap: Record<'light' | 'deep', string> = {
      light: [
        '润色模式：轻润色。',
        '优先做轻量优化，减少大改。',
        '主要修正表达、结构、可读性和明显遗漏。',
        'answer 和 explanation 保持精炼，不要过度展开。',
      ].join('\n'),
      deep: [
        '润色模式：深润色。',
        '可以在不改变核心考点的前提下更充分优化题干、答案和解析。',
        'answer 可以更完整，必要时分点。',
        'explanation 可以补充关键原理、背景、易错点和记忆提示。',
      ].join('\n'),
    };

    const prompt = `请润色这道题，返回 JSON 对象，不要输出解释文字。

只返回字段：title、content、answer、explanation、difficulty、tags

规则：
1. 不改变核心考点
2. 优化题干表达与结构
3. answer 要更清晰完整，不能比原题更简略
4. explanation 补充关键原理、易错点或记忆提示，控制在精炼范围内
5. difficulty 只能是 easy、medium、hard
6. tags 最多 5 个
7. ${polishInstructionMap[data.mode]}

原题：
title: ${sanitizePrompt(question.title)}
content: ${sanitizePrompt(question.content)}
answer: ${sanitizePrompt(question.answer)}
explanation: ${sanitizePrompt(question.explanation || '')}
difficulty: ${sanitizePrompt(question.difficulty)}
tags: ${JSON.stringify(parseStoredTags(question.tags, tagAliases))}`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    const parsed = extractJsonObject(result, 'AI 未返回可解析的题目对象');
    const draft = {
      title: sanitizePrompt(parsed.title || question.title),
      content: sanitizePrompt(parsed.content || question.content),
      answer: sanitizePrompt(parsed.answer || question.answer),
      explanation: parsed.explanation ? sanitizePrompt(parsed.explanation) : '',
      difficulty: ['easy', 'medium', 'hard'].includes(parsed.difficulty) ? parsed.difficulty : question.difficulty,
      tags: normalizeTagsInput(Array.isArray(parsed.tags) ? parsed.tags : parseStoredTags(question.tags, tagAliases), tagAliases),
    };
    res.json({ question, draft, raw: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'AI题目润色失败: ' + (error as Error).message });
  }
});

router.post('/answer-draft', authMiddleware, requirePermission('ai_polish', '没有AI润色权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = answerDraftSchema.parse(req.body);
    const question = await getAccessibleQuestion(req.user!, data.questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = sanitizePrompt(data.provider || userConfig?.provider || config.ai.defaultProvider);
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const existingTags = parseStoredTags(question.tags, tagAliases);

    const modeInstructionMap: Record<'quick' | 'practice' | 'teaching', string> = {
      quick: [
        '答案版本：速记版。',
        'answer 必须短，但必须是一句或两句完整、能独立理解的话，不能只堆关键词。',
        'answer 必须严格按“原有限制/问题 + 解决方式/能力 + 最终效果/意义”的顺序组织，允许压缩表达，但三段信息都不能缺。',
        'answer 必须写成约 5 个短分句，优先用分号、顿号或逗号连接；不要明显少于 4 个，也不要明显多于 6 个，每个短分句都要承载有效信息，避免空泛概括。',
        'explanation 仅补一段很短的记忆提示，可为空，不要展开。',
      ].join('\n'),
      practice: [
        '答案版本：练习版。',
        'answer 保持完整、准确，适合刷题后直接对照，可按要点分行。',
        'explanation 提供适中的补充说明，突出关键步骤、判断依据或易错点，不要过长。',
      ].join('\n'),
      teaching: [
        '答案版本：教学版。',
        'answer 需要更完整清晰，适合给学生讲解，可分点表达，覆盖定义、关键步骤、原因或注意事项。',
        'explanation 需要比练习版更详细，可补充背景、对比、常见误区和记忆方法，但仍要围绕当前题目。',
      ].join('\n'),
    };

    const prompt = `请只为这道题生成新的答案草稿，返回 JSON 对象，不要输出任何解释文字。

要求：
1. 返回字段必须包含 answer、explanation、tags
2. 只允许改写答案和解析，不要改写题目标题、题干、分类和难度
3. 答案必须准确，且严格围绕当前题干作答，不要发散
4. explanation 用于辅助理解，可为空字符串
5. 不要参考原题已有答案和解析，不要改写、压缩或复述原答案；你需要仅根据题目标题和题干独立作答
6. tags 为字符串数组，返回 0 到 5 个最合适的标签
7. 如果原题没有标签，请主动生成 2 到 5 个高相关标签；如果原题已有标签，可保留或补充更合适的标签建议
8. 输出必须是合法 JSON 对象

${modeInstructionMap[data.mode]}

当前题目：
title: ${sanitizePrompt(question.title)}
content: ${sanitizePrompt(question.content)}
difficulty: ${sanitizePrompt(question.difficulty)}
existingTags: ${JSON.stringify(existingTags)}

返回示例：
{
  "answer": "示例答案",
  "explanation": "示例解析",
  "tags": ["tag1", "tag2"]
}`;

    const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
    const parsed = extractJsonObject(result, 'AI 未返回可解析的答案对象');
    const draft = {
      answer: sanitizePrompt(parsed.answer || question.answer),
      explanation: parsed.explanation ? sanitizePrompt(parsed.explanation) : '',
      tags: normalizeTagsInput(Array.isArray(parsed.tags) ? parsed.tags : existingTags, tagAliases),
      mode: data.mode,
    };

    res.json({ question, draft, raw: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'AI答案生成失败: ' + (error as Error).message });
  }
});

router.post('/batch-tags', authMiddleware, requirePermission('tag_manage', '没有标签管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = batchTagsSchema.parse(req.body);
    const userConfig = await db.getActiveAIConfig(req.user!.id);
    const providerName = sanitizePrompt(data.provider || userConfig?.provider || config.ai.defaultProvider);
    const aiProvider = await aiService.getProvider(providerName, { userId: req.user!.id, role: req.user!.role });
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const results: Array<{ questionId: string; tags: string[] }> = [];
    let updated = 0;

    for (const questionId of data.ids) {
      const question = await getAccessibleQuestion(req.user!, questionId);
      if (!question) {
        continue;
      }

      const existingTags = parseStoredTags(question.tags, tagAliases);
      const prompt = `请只为这道题生成标签建议，返回 JSON 对象，不要输出任何解释文字。

要求：
1. 返回字段必须包含 tags
2. tags 为字符串数组，返回 2 到 5 个最合适的标签
3. 标签要短、清晰、可复用，优先使用知识点、技术名词、场景词
4. 不要返回“题目”“答案”“练习”这类空泛标签
5. 如果已有标签不准确，可以给出更合适的新标签
6. 输出必须是合法 JSON 对象

当前题目：
title: ${sanitizePrompt(question.title)}
content: ${sanitizePrompt(question.content)}
answer: ${sanitizePrompt(question.answer)}
explanation: ${sanitizePrompt(question.explanation || '')}
difficulty: ${sanitizePrompt(question.difficulty)}
existingTags: ${JSON.stringify(existingTags)}

返回示例：
{
  "tags": ["tag1", "tag2", "tag3"]
}`;

      const result = await aiProvider.chat([{ role: 'user', content: prompt }]);
      const parsed = extractJsonObject(result, 'AI 未返回可解析的标签对象');
      const generatedTags = normalizeTagsInput(Array.isArray(parsed.tags) ? parsed.tags : [], tagAliases);
      if (generatedTags.length === 0) {
        continue;
      }

      const nextTags = data.mode === 'replace'
        ? generatedTags
        : normalizeTagsInput([...existingTags, ...generatedTags], tagAliases);

      const nextValue = JSON.stringify(nextTags);
      if (nextValue !== (question.tags || '[]')) {
        await db.updateQuestion(question.id, { tags: nextValue });
        updated += 1;
      }

      results.push({ questionId: question.id, tags: nextTags });
    }

    res.json({
      updated,
      total: data.ids.length,
      message: `已为 ${updated} 道题目更新 AI 标签`,
      results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'AI批量生成标签失败: ' + (error as Error).message });
  }
});

export default router;
