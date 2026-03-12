import { Router, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { authMiddleware, AuthRequest, getLibraryOwnerId, hasCategoryScopeAccess, requirePermission } from '../middleware/auth.js';
import { ImportResult, Question, User } from '../types/index.js';
import { normalizeTagsInput, parseTagAliasMap } from '../utils/tags.js';

const router = Router();

const allowedUploadExtensions = new Set(['.csv', '.json', '.md', '.markdown', '.txt']);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: unknown, file: Express.MulterFile, callback: (error: Error | null, acceptFile?: boolean) => void) => {
    const extension = file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
      : '';

    if (!allowedUploadExtensions.has(extension)) {
      callback(new Error('仅支持 csv、json、md、markdown、txt 文件'));
      return;
    }

    callback(null, true);
  },
});

function cleanupUploadedFile(filePath?: string) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }
  fs.unlinkSync(filePath);
}

const normalizeDifficulty = (diff: string | undefined): 'easy' | 'medium' | 'hard' => {
  if (!diff) return 'medium';
  const d = diff.toLowerCase().trim();
  if (d === 'easy' || d === '简单') return 'easy';
  if (d === 'medium' || d === '中等') return 'medium';
  if (d === 'hard' || d === '困难') return 'hard';
  return 'medium';
};

const questionImportSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1),
  answer: z.string().min(1),
  explanation: z.string().optional().default(''),
  difficulty: z.string().optional().default('medium'),
  categoryId: z.string().optional().nullable(),
  tags: z.union([z.string(), z.array(z.string())]).optional().transform(v => normalizeTagsInput(v)),
});

async function validateImportCategory(user: User, ownerId: string, categoryId: string | null | undefined) {
  if (!categoryId) {
    return { ok: true as const };
  }

  const category = await db.getCategoryById(categoryId);
  if (!category || (category.user_id !== ownerId && user.role !== 'admin')) {
    return { ok: false as const, error: '分类不存在或不属于当前题库' };
  }

  if (!hasCategoryScopeAccess(user, categoryId)) {
    return { ok: false as const, error: '没有该分类的导入权限' };
  }

  return { ok: true as const };
}

router.post('/csv', authMiddleware, requirePermission('import_manage', '没有导入权限'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const categoryId = req.body.categoryId || null;
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const ownerId = getLibraryOwnerId(req.user!);

    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        const content = record.content || record.内容 || '';
        const answer = record.answer || record.答案 || '';
        
        if (!content || !answer) {
          result.failed++;
          result.errors.push({ row: i + 2, error: '题目内容或答案不能为空' });
          continue;
        }

        const parsedData = questionImportSchema.parse({
          title: record.title || record.标题 || content.substring(0, 100),
          content,
          answer,
          explanation: record.explanation || record.解析 || '',
          difficulty: normalizeDifficulty(record.difficulty || record.难度),
          categoryId: categoryId || record.categoryId || record.分类ID,
          tags: normalizeTagsInput(record.tags || record.标签 || '', tagAliases),
        });

        const categoryAccess = await validateImportCategory(req.user!, ownerId, parsedData.categoryId || null);
        if (!categoryAccess.ok) {
          result.failed++;
          result.errors.push({ row: i + 2, error: categoryAccess.error });
          continue;
        }

        const question: Question = {
          id: uuidv4(),
          title: parsedData.title || content.substring(0, 100),
          content: parsedData.content,
          answer: parsedData.answer,
          explanation: parsedData.explanation || null,
          difficulty: normalizeDifficulty(parsedData.difficulty),
          category_id: parsedData.categoryId || null,
          user_id: ownerId,
          tags: JSON.stringify(parsedData.tags),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.createQuestion(question);
        result.success++;
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof z.ZodError 
          ? error.errors.map(e => e.message).join(', ')
          : String(error);
        result.errors.push({ row: i + 2, error: errorMsg });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('CSV import error:', error);
    res.status(500).json({ error: 'CSV导入失败: ' + (error as Error).message });
  } finally {
    cleanupUploadedFile(req.file?.path);
  }
});

router.post('/json', authMiddleware, requirePermission('import_manage', '没有导入权限'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const questions = Array.isArray(jsonData) ? jsonData : [jsonData];

    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const categoryId = req.body.categoryId || null;
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const ownerId = getLibraryOwnerId(req.user!);

    for (let i = 0; i < questions.length; i++) {
      try {
        const q = questions[i];
        const content = q.content || q.内容 || '';
        const answer = q.answer || q.答案 || '';
        
        if (!content || !answer) {
          result.failed++;
          result.errors.push({ row: i + 1, error: '题目内容或答案不能为空' });
          continue;
        }

        const parsedData = questionImportSchema.parse({
          title: q.title || q.标题 || content.substring(0, 100),
          content,
          answer,
          explanation: q.explanation || q.解析 || '',
          difficulty: normalizeDifficulty(q.difficulty || q.难度),
          categoryId: categoryId || q.categoryId || q.分类ID,
          tags: normalizeTagsInput(q.tags || q.标签 || '', tagAliases),
        });

        const categoryAccess = await validateImportCategory(req.user!, ownerId, parsedData.categoryId || null);
        if (!categoryAccess.ok) {
          result.failed++;
          result.errors.push({ row: i + 1, error: categoryAccess.error });
          continue;
        }

        const question: Question = {
          id: uuidv4(),
          title: parsedData.title || content.substring(0, 100),
          content: parsedData.content,
          answer: parsedData.answer,
          explanation: parsedData.explanation || null,
          difficulty: normalizeDifficulty(parsedData.difficulty),
          category_id: parsedData.categoryId || null,
          user_id: ownerId,
          tags: JSON.stringify(parsedData.tags),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.createQuestion(question);
        result.success++;
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof z.ZodError 
          ? error.errors.map(e => e.message).join(', ')
          : String(error);
        result.errors.push({ row: i + 1, error: errorMsg });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('JSON import error:', error);
    res.status(500).json({ error: 'JSON导入失败: ' + (error as Error).message });
  } finally {
    cleanupUploadedFile(req.file?.path);
  }
});

router.post('/markdown', authMiddleware, requirePermission('import_manage', '没有导入权限'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const categoryId = req.body.categoryId || null;
    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const ownerId = getLibraryOwnerId(req.user!);
    const categoryAccess = await validateImportCategory(req.user!, ownerId, categoryId);
    if (!categoryAccess.ok) {
      res.status(403).json({ error: categoryAccess.error });
      return;
    }

    const lines = fileContent.split('\n');
    let currentQuestion: { content: string; answer: string; explanation: string } | null = null;
    let currentSection = 'content';
    let questionIndex = 0;

    const saveQuestion = async () => {
      if (currentQuestion && currentQuestion.content && currentQuestion.answer) {
        questionIndex++;
        try {
          const question: Question = {
            id: uuidv4(),
            title: currentQuestion.content.substring(0, 100),
            content: currentQuestion.content.trim(),
            answer: currentQuestion.answer.trim(),
            explanation: currentQuestion.explanation.trim() || null,
            difficulty: 'medium',
            category_id: categoryId,
            user_id: ownerId,
            tags: JSON.stringify([]),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await db.createQuestion(question);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push({ row: questionIndex, error: String(error) });
        }
      }
      currentQuestion = null;
      currentSection = 'content';
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('## ')) {
        continue;
      }

      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        await saveQuestion();
        currentQuestion = { content: '', answer: '', explanation: '' };
        currentQuestion.content = trimmedLine.slice(2, -2);
        currentSection = 'content';
        continue;
      }

      if (!currentQuestion) continue;

      if (trimmedLine.startsWith('答案') || trimmedLine.startsWith('答案：') || trimmedLine.startsWith('答案:')) {
        currentSection = 'answer';
        const answerContent = trimmedLine.replace(/^答案[：:]\s*/, '');
        if (answerContent) {
          currentQuestion.answer = answerContent;
        }
        continue;
      }

      if (trimmedLine.startsWith('解析') || trimmedLine.startsWith('解析：') || trimmedLine.startsWith('解析:')) {
        currentSection = 'explanation';
        const explanationContent = trimmedLine.replace(/^解析[：:]\s*/, '');
        if (explanationContent) {
          currentQuestion.explanation = explanationContent;
        }
        continue;
      }

      if (trimmedLine === '') continue;

      if (currentSection === 'answer') {
        currentQuestion.answer += (currentQuestion.answer ? '\n' : '') + trimmedLine;
      } else if (currentSection === 'explanation') {
        currentQuestion.explanation += (currentQuestion.explanation ? '\n' : '') + trimmedLine;
      }
    }

    await saveQuestion();

    res.json(result);
  } catch (error) {
    console.error('Markdown import error:', error);
    res.status(500).json({ error: 'Markdown导入失败: ' + (error as Error).message });
  } finally {
    cleanupUploadedFile(req.file?.path);
  }
});

router.post('/text', authMiddleware, requirePermission('import_manage', '没有导入权限'), async (req: AuthRequest, res: Response) => {
  try {
    const { questions: questionsData, categoryId } = req.body;
    
    if (!Array.isArray(questionsData) || questionsData.length === 0) {
      res.status(400).json({ error: '请提供题目数据' });
      return;
    }

    const result: ImportResult = { success: 0, failed: 0, errors: [] };
    const tagAliases = parseTagAliasMap(await db.getSetting('tag_aliases'));
    const ownerId = getLibraryOwnerId(req.user!);

    for (let i = 0; i < questionsData.length; i++) {
      try {
        const q = questionsData[i];
        const content = q.content || q.内容 || '';
        const answer = q.answer || q.答案 || '';
        
        if (!content || !answer) {
          result.failed++;
          result.errors.push({ row: i + 1, error: '题目内容或答案不能为空' });
          continue;
        }

        const parsedData = questionImportSchema.parse({
          title: q.title || q.标题 || content.substring(0, 100),
          content,
          answer,
          explanation: q.explanation || q.解析 || '',
          difficulty: normalizeDifficulty(q.difficulty || q.难度),
          categoryId: categoryId || q.categoryId || q.分类ID,
          tags: normalizeTagsInput(q.tags || q.标签 || '', tagAliases),
        });

        const categoryAccess = await validateImportCategory(req.user!, ownerId, parsedData.categoryId || null);
        if (!categoryAccess.ok) {
          result.failed++;
          result.errors.push({ row: i + 1, error: categoryAccess.error });
          continue;
        }

        const question: Question = {
          id: uuidv4(),
          title: parsedData.title || content.substring(0, 100),
          content: parsedData.content,
          answer: parsedData.answer,
          explanation: parsedData.explanation || null,
          difficulty: normalizeDifficulty(parsedData.difficulty),
          category_id: parsedData.categoryId || null,
          user_id: ownerId,
          tags: JSON.stringify(parsedData.tags),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await db.createQuestion(question);
        result.success++;
      } catch (error) {
        result.failed++;
        const errorMsg = error instanceof z.ZodError 
          ? error.errors.map(e => e.message).join(', ')
          : String(error);
        result.errors.push({ row: i + 1, error: errorMsg });
      }
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '批量导入失败' });
  }
});

export default router;
