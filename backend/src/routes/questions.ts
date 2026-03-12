import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { authMiddleware, AuthRequest, getLibraryOwnerId, hasCategoryScopeAccess, hasPermission, requirePermission } from '../middleware/auth.js';
import { Question, LearningProgress, PaginatedResult, QuestionFilter, TagSummary, TagHealthPair, TagHealthReport, User } from '../types/index.js';
import { normalizeTagName, normalizeTagsInput, parseStoredTags, parseTagAliasMap } from '../utils/tags.js';

const router = Router();

function validateId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function levenshteinDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function simplifyTag(tag: string): string {
  return tag.replace(/[\s\-_./]/g, '');
}

function normalizeQuestionText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_=+[\]{}\\|;:'",.<>/?，。！？；：“”‘’、（）【】《》\s-]/g, '');
}

function buildBigrams(text: string): Set<string> {
  const normalized = normalizeQuestionText(text);
  if (normalized.length < 2) {
    return new Set(normalized ? [normalized] : []);
  }

  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index++) {
    result.add(normalized.slice(index, index + 2));
  }

  return result;
}

function diceCoefficient(left: string, right: string): number {
  const leftSet = buildBigrams(left);
  const rightSet = buildBigrams(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  return (2 * intersection) / (leftSet.size + rightSet.size);
}

const createQuestionSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  answer: z.string().min(1),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const updateQuestionSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  explanation: z.string().optional().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  categoryId: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const batchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

const batchTagsSchema = z.object({
  ids: z.array(z.string()).min(1),
  mode: z.enum(['add', 'remove', 'replace']),
  tags: z.array(z.string()).min(1),
});

const mergeDuplicateSchema = z.object({
  keepId: z.string().uuid(),
  removeId: z.string().uuid(),
});

const renameTagSchema = z.object({
  fromTag: z.string().min(1).max(100),
  toTag: z.string().min(1).max(100),
});

const deleteTagSchema = z.object({
  tagName: z.string().min(1).max(100),
});

const normalizeTagsSchema = z.object({});

function getAllowedCategoryIds(user: User): string[] | undefined {
  return user.user_type === 'integrated' && user.category_scopes.length > 0
    ? user.category_scopes
    : undefined;
}

async function ensureAccessibleCategory(user: User, ownerId: string, categoryId: string | null | undefined) {
  if (!categoryId) {
    return { ok: true as const };
  }

  const category = await db.getCategoryById(categoryId);
  if (!category || (category.user_id !== ownerId && user.role !== 'admin')) {
    return { ok: false as const, status: 400, error: '分类不存在或不属于当前题库' };
  }

  if (!hasCategoryScopeAccess(user, categoryId)) {
    return { ok: false as const, status: 403, error: '没有该分类的操作权限' };
  }

  return { ok: true as const };
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

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const tagQuery = req.query.tags;
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const tags = typeof tagQuery === 'string'
      ? normalizeTagsInput(tagQuery, tagAliases)
      : Array.isArray(tagQuery)
        ? normalizeTagsInput(tagQuery, tagAliases)
        : [];
    const filter: QuestionFilter = {
      categoryId: req.query.categoryId as string,
      difficulty: req.query.difficulty as 'easy' | 'medium' | 'hard',
      keyword: req.query.keyword as string,
      tags,
    };
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions, total } = await db.getQuestions(ownerId, page, pageSize, filter, allowedCategoryIds);
    
    const result: PaginatedResult<Question> = {
      data: questions,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '获取题目列表失败' });
  }
});

router.get('/tags', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const filter = {
      categoryId: req.query.categoryId as string,
      difficulty: req.query.difficulty as 'easy' | 'medium' | 'hard',
      keyword: req.query.keyword as string,
    };

    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const tags = await db.getQuestionTags(ownerId, filter, allowedCategoryIds);
    const result: TagSummary[] = tags;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '获取标签失败' });
  }
});

router.get('/tags/health', authMiddleware, requirePermission('tag_manage', '没有标签管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const tags = await db.getQuestionTags(ownerId, undefined, allowedCategoryIds);
    const aliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const lowFrequency = tags.filter((tag) => tag.count <= 1);
    const aliased = Object.entries(aliases).map(([alias, target]) => ({ alias, target }));
    const similarPairs: TagHealthPair[] = [];

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const left = tags[i].name;
        const right = tags[j].name;
        const leftSimple = simplifyTag(left);
        const rightSimple = simplifyTag(right);

        let reason = '';
        if (leftSimple && leftSimple === rightSimple) {
          reason = '仅符号或空格不同';
        } else if (leftSimple.length >= 3 && rightSimple.length >= 3 && (leftSimple.includes(rightSimple) || rightSimple.includes(leftSimple))) {
          reason = '名称包含关系';
        } else if (Math.abs(left.length - right.length) <= 2 && levenshteinDistance(left, right) <= 2) {
          reason = '编辑距离较近';
        }

        if (reason) {
          similarPairs.push({ left, right, reason });
        }
      }
    }

    const report: TagHealthReport = {
      lowFrequency,
      aliased,
      similarPairs: similarPairs.slice(0, 20),
    };

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: '获取标签健康检查失败' });
  }
});

router.put('/tags/rename', authMiddleware, requirePermission('tag_manage', '没有标签管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = renameTagSchema.parse(req.body);
    const fromTag = normalizeTagName(data.fromTag);
    const toTag = normalizeTagName(data.toTag);

    if (fromTag === toTag) {
      res.status(400).json({ error: '新旧标签不能相同' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 100000, undefined, allowedCategoryIds);
    let updated = 0;

    for (const question of questions) {
      const parsedTags = parseStoredTags(question.tags);
      if (!parsedTags.includes(fromTag)) {
        continue;
      }

      const nextTags = Array.from(new Set(
        parsedTags
          .map((tag) => (tag === fromTag ? toTag : normalizeTagName(tag)))
          .filter(Boolean)
      ));
      await db.updateQuestion(question.id, { tags: JSON.stringify(nextTags) });
      updated += 1;
    }

    res.json({ updated, message: `已更新 ${updated} 道题目` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '重命名标签失败' });
  }
});

router.delete('/tags', authMiddleware, requirePermission('tag_manage', '没有标签管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = deleteTagSchema.parse(req.body);
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const normalizedTagName = normalizeTagName(data.tagName);
    const { questions } = await db.getQuestions(ownerId, 1, 100000, undefined, allowedCategoryIds);
    let updated = 0;

    for (const question of questions) {
      const parsedTags = parseStoredTags(question.tags);
      if (!parsedTags.includes(normalizedTagName)) {
        continue;
      }

      const nextTags = parsedTags.filter((tag) => tag !== normalizedTagName);
      await db.updateQuestion(question.id, { tags: JSON.stringify(nextTags) });
      updated += 1;
    }

    res.json({ updated, message: `已从 ${updated} 道题目中移除标签` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '删除标签失败' });
  }
});

router.post('/tags/normalize', authMiddleware, requirePermission('tag_manage', '没有标签管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    normalizeTagsSchema.parse(req.body ?? {});
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 100000, undefined, allowedCategoryIds);
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    let updated = 0;

    for (const question of questions) {
      const normalizedTags = parseStoredTags(question.tags, tagAliases);
      const nextValue = JSON.stringify(normalizedTags);
      if (nextValue !== (question.tags || '[]')) {
        await db.updateQuestion(question.id, { tags: nextValue });
        updated += 1;
      }
    }

    res.json({ updated, message: `已规范化 ${updated} 道题目的标签` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '规范化标签失败' });
  }
});

router.post('/batch-tags', authMiddleware, requirePermission('tag_manage', '没有标签管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = batchTagsSchema.parse(req.body);
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const nextTagsInput = normalizeTagsInput(data.tags, tagAliases);
    let updated = 0;

    for (const id of data.ids) {
      const question = await getAccessibleQuestion(req.user!, id);
      if (!question) {
        continue;
      }

      const currentTags = parseStoredTags(question.tags, tagAliases);
      const resultTags = data.mode === 'add'
        ? normalizeTagsInput([...currentTags, ...nextTagsInput], tagAliases)
        : data.mode === 'remove'
          ? currentTags.filter((tag) => !nextTagsInput.includes(tag))
          : nextTagsInput;

      const nextValue = JSON.stringify(resultTags);
      if (nextValue !== (question.tags || '[]')) {
        await db.updateQuestion(question.id, { tags: nextValue });
        updated += 1;
      }
    }

    res.json({ updated, message: `已更新 ${updated} 道题目的标签` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '批量更新标签失败' });
  }
});

router.get('/duplicates/similar', authMiddleware, requirePermission('duplicate_manage', '没有查重权限'), async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 5000, undefined, allowedCategoryIds);
    const pairs: Array<{ left: Question; right: Question; titleScore: number; contentScore: number; score: number }> = [];

    for (let i = 0; i < questions.length; i++) {
      for (let j = i + 1; j < questions.length; j++) {
        const left = questions[i];
        const right = questions[j];
        const titleScore = diceCoefficient(left.title, right.title);
        const contentScore = diceCoefficient(left.content, right.content);
        const score = Math.max(titleScore, contentScore);

        if (titleScore >= 0.86 || contentScore >= 0.72) {
          pairs.push({ left, right, titleScore, contentScore, score });
        }
      }
    }

    pairs.sort((a, b) => b.score - a.score);
    res.json({ total: pairs.length, pairs: pairs.slice(0, 50) });
  } catch (error) {
    res.status(500).json({ error: '相似题查重失败' });
  }
});

router.post('/duplicates/merge', authMiddleware, requirePermission('duplicate_manage', '没有查重权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = mergeDuplicateSchema.parse(req.body);
    const keepQuestion = await getAccessibleQuestion(req.user!, data.keepId);
    const removeQuestion = await getAccessibleQuestion(req.user!, data.removeId);
    if (!keepQuestion || !removeQuestion) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const mergedTags = Array.from(new Set([...parseStoredTags(keepQuestion.tags), ...parseStoredTags(removeQuestion.tags)]));
    const keepExplanation = (keepQuestion.explanation || '').trim();
    const removeExplanation = (removeQuestion.explanation || '').trim();

    await db.updateQuestion(keepQuestion.id, {
      explanation: keepExplanation || removeExplanation || null,
      category_id: keepQuestion.category_id || removeQuestion.category_id,
      tags: JSON.stringify(mergedTags),
    });
    await db.deleteQuestion(removeQuestion.id);

    res.json({ message: '已合并题目并删除重复题', keepId: keepQuestion.id, removeId: removeQuestion.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '合并重复题失败' });
  }
});

router.get('/bookmarked', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'study';
    const questions = await db.getBookmarkedQuestions(req.user!.id, mode);
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: '获取收藏题目失败' });
  }
});

router.get('/last-viewed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'study';
    const categoryId = req.query.categoryId as string | undefined;
    const progress = await db.getLastViewedQuestion(req.user!.id, mode, categoryId);
    res.json(progress || null);
  } catch (error) {
    res.status(500).json({ error: '获取学习进度失败' });
  }
});

router.delete('/progress/reset', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cleared = await db.clearLearningProgress(req.user!.id);
    res.json({ cleared, message: `已清空 ${cleared} 条学习记录` });
  } catch (error) {
    res.status(500).json({ error: '清空学习记录失败' });
  }
});

router.delete('/clear-all', authMiddleware, requirePermission('question_delete', '没有删题权限'), async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    let deletedCount = 0;

    if (allowedCategoryIds && allowedCategoryIds.length > 0) {
      const { questions } = await db.getQuestions(ownerId, 1, 100000, undefined, allowedCategoryIds);
      deletedCount = await db.deleteQuestions(questions.map((question) => question.id));
    } else {
      deletedCount = await db.clearAllQuestions(ownerId);
    }

    res.json({ message: `已清空 ${deletedCount} 道题目` });
  } catch (error) {
    res.status(500).json({ error: '清空题库失败' });
  }
});

router.get('/export', authMiddleware, requirePermission('question_export', '没有导出权限'), async (req: AuthRequest, res: Response) => {
  try {
    const categoryId = req.query.categoryId as string | undefined;
    if (!hasCategoryScopeAccess(req.user!, categoryId)) {
      res.status(403).json({ error: '没有该分类的导出权限' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 10000, { categoryId }, allowedCategoryIds);
    
    const exportData = questions.map(q => ({
      title: q.title,
      content: q.content,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      tags: q.tags,
    }));
    
    res.json({ questions: exportData, total: exportData.length });
  } catch (error) {
    res.status(500).json({ error: '导出题目失败' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!validateId(req.params.id)) {
      res.status(400).json({ error: '无效的题目ID' });
      return;
    }
    const question = await getAccessibleQuestion(req.user!, req.params.id);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: '获取题目失败' });
  }
});

router.post('/', authMiddleware, requirePermission('question_create', '没有新增题目权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createQuestionSchema.parse(req.body);
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const ownerId = getLibraryOwnerId(req.user!);
    const categoryAccess = await ensureAccessibleCategory(req.user!, ownerId, data.categoryId || null);
    if (!categoryAccess.ok) {
      res.status(categoryAccess.status).json({ error: categoryAccess.error });
      return;
    }

    const question = await db.createQuestion({
      id: uuidv4(),
      title: data.title,
      content: data.content,
      answer: data.answer,
      explanation: data.explanation || null,
      difficulty: data.difficulty,
      category_id: data.categoryId || null,
      user_id: ownerId,
      tags: JSON.stringify(normalizeTagsInput(data.tags || [], tagAliases)),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.status(201).json(question);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '创建题目失败' });
  }
});

router.put('/:id', authMiddleware, requirePermission('question_edit_content', '没有编辑题目权限'), async (req: AuthRequest, res: Response) => {
  try {
    if (!validateId(req.params.id)) {
      res.status(400).json({ error: '无效的题目ID' });
      return;
    }
    const data = updateQuestionSchema.parse(req.body);
    const question = await getAccessibleQuestion(req.user!, req.params.id);

    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const isMetaUpdate = data.difficulty !== undefined || data.categoryId !== undefined || data.tags !== undefined;
    if (isMetaUpdate && !hasPermission(req.user, 'question_edit_meta')) {
      res.status(403).json({ error: '没有编辑题目属性权限' });
      return;
    }

    const nextCategoryId = data.categoryId !== undefined ? (data.categoryId || null) : question.category_id;
    const ownerId = getLibraryOwnerId(req.user!);
    const categoryAccess = await ensureAccessibleCategory(req.user!, ownerId, nextCategoryId);
    if (!categoryAccess.ok) {
      res.status(categoryAccess.status).json({ error: categoryAccess.error });
      return;
    }

    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));

    const updateData: Partial<Question> = {
      title: data.title,
      content: data.content,
      answer: data.answer,
      explanation: data.explanation,
      difficulty: data.difficulty,
      category_id: data.categoryId,
      tags: data.tags ? JSON.stringify(normalizeTagsInput(data.tags, tagAliases)) : undefined,
    };

    const updatedQuestion = await db.updateQuestion(req.params.id, updateData);
    res.json(updatedQuestion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '更新题目失败' });
  }
});

router.delete('/:id', authMiddleware, requirePermission('question_delete', '没有删题权限'), async (req: AuthRequest, res: Response) => {
  try {
    if (!validateId(req.params.id)) {
      res.status(400).json({ error: '无效的题目ID' });
      return;
    }
    const question = await getAccessibleQuestion(req.user!, req.params.id);

    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    await db.deleteQuestion(req.params.id);
    res.json({ message: '题目已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除题目失败' });
  }
});

router.post('/batch-delete', authMiddleware, requirePermission('question_delete', '没有删题权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = batchDeleteSchema.parse(req.body);
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedIds: string[] = [];

    for (const id of data.ids) {
      const question = await db.getQuestionByIdForUser(id, ownerId, req.user!.role === 'admin');
      if (!question || !hasCategoryScopeAccess(req.user!, question.category_id)) {
        continue;
      }
      allowedIds.push(id);
    }

    const deletedCount = await db.deleteQuestionsForUser(
      allowedIds,
      ownerId,
      req.user!.role === 'admin'
    );
    res.json({ message: `已删除 ${deletedCount} 道题目` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '批量删除失败' });
  }
});

router.post('/:id/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { mode, isBookmarked } = req.body;
    const questionId = req.params.id;

    const question = await getAccessibleQuestion(req.user!, questionId);
    if (!question) {
      res.status(404).json({ error: '题目不存在' });
      return;
    }

    const progress: LearningProgress = {
      id: uuidv4(),
      user_id: req.user!.id,
      question_id: questionId,
      mode: mode || 'study',
      last_viewed_at: new Date().toISOString(),
      view_count: 0,
      is_bookmarked: isBookmarked || false,
    };

    const savedProgress = await db.upsertLearningProgress(progress);
    res.json(savedProgress);
  } catch (error) {
    res.status(500).json({ error: '保存进度失败' });
  }
});

router.get('/:id/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'study';
    const progress = await db.getLearningProgress(req.user!.id, req.params.id, mode);
    res.json(progress || null);
  } catch (error) {
    res.status(500).json({ error: '获取进度失败' });
  }
});

router.get('/navigate/:id/next', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const currentId = req.params.id;
    const categoryId = req.query.categoryId as string;

    const currentQuestion = await getAccessibleQuestion(req.user!, currentId);
    if (!currentQuestion) {
      res.status(404).json({ error: '当前题目不存在' });
      return;
    }

    if (!hasCategoryScopeAccess(req.user!, categoryId || currentQuestion.category_id)) {
      res.status(403).json({ error: '没有该分类的访问权限' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 1000, { categoryId }, allowedCategoryIds);
    const currentIndex = questions.findIndex(q => q.id === currentId);
    
    if (currentIndex === -1 || currentIndex === questions.length - 1) {
      res.json({ nextQuestion: null });
      return;
    }

    const nextQuestion = questions[currentIndex + 1];
    res.json({ nextQuestion });
  } catch (error) {
    res.status(500).json({ error: '获取下一题失败' });
  }
});

router.get('/navigate/:id/prev', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const currentId = req.params.id;
    const categoryId = req.query.categoryId as string;

    const currentQuestion = await getAccessibleQuestion(req.user!, currentId);
    if (!currentQuestion) {
      res.status(404).json({ error: '当前题目不存在' });
      return;
    }

    if (!hasCategoryScopeAccess(req.user!, categoryId || currentQuestion.category_id)) {
      res.status(403).json({ error: '没有该分类的访问权限' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 1000, { categoryId }, allowedCategoryIds);
    const currentIndex = questions.findIndex(q => q.id === currentId);
    
    if (currentIndex <= 0) {
      res.json({ prevQuestion: null });
      return;
    }

    const prevQuestion = questions[currentIndex - 1];
    res.json({ prevQuestion });
  } catch (error) {
    res.status(500).json({ error: '获取上一题失败' });
  }
});

router.get('/navigate/random', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const categoryId = req.query.categoryId as string;
    if (!hasCategoryScopeAccess(req.user!, categoryId)) {
      res.status(403).json({ error: '没有该分类的访问权限' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = getAllowedCategoryIds(req.user!);
    const { questions } = await db.getQuestions(ownerId, 1, 1000, { categoryId }, allowedCategoryIds);
    
    if (questions.length === 0) {
      res.json({ randomQuestion: null });
      return;
    }

    const randomIndex = Math.floor(Math.random() * questions.length);
    res.json({ randomQuestion: questions[randomIndex] });
  } catch (error) {
    res.status(500).json({ error: '获取随机题目失败' });
  }
});

export default router;
