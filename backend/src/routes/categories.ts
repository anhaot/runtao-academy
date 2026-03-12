import { Router, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/index.js';
import { authMiddleware, AuthRequest, getLibraryOwnerId, hasCategoryScopeAccess, requirePermission } from '../middleware/auth.js';

const router = Router();

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = getLibraryOwnerId(req.user!);
    const allowedCategoryIds = req.user!.user_type === 'integrated' ? req.user!.category_scopes : undefined;
    const categories = await db.getCategoriesByUserId(ownerId, allowedCategoryIds);
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: '获取分类失败' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const category = await db.getCategoryById(req.params.id);
    if (!category) {
      res.status(404).json({ error: '分类不存在' });
      return;
    }
    const ownerId = getLibraryOwnerId(req.user!);
    if ((category.user_id !== ownerId && req.user!.role !== 'admin') || !hasCategoryScopeAccess(req.user!, category.id)) {
      res.status(403).json({ error: '无权访问此分类' });
      return;
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: '获取分类失败' });
  }
});

router.post('/', authMiddleware, requirePermission('category_manage', '没有分类管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createCategorySchema.parse(req.body);

    const category = await db.createCategory({
      id: uuidv4(),
      name: data.name,
      description: data.description || null,
      parent_id: data.parentId || null,
      user_id: getLibraryOwnerId(req.user!),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '创建分类失败' });
  }
});

router.put('/:id', authMiddleware, requirePermission('category_manage', '没有分类管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const data = updateCategorySchema.parse(req.body);
    const category = await db.getCategoryById(req.params.id);

    if (!category) {
      res.status(404).json({ error: '分类不存在' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    if ((category.user_id !== ownerId && req.user!.role !== 'admin') || !hasCategoryScopeAccess(req.user!, category.id)) {
      res.status(403).json({ error: '无权修改此分类' });
      return;
    }

    const updatedCategory = await db.updateCategory(req.params.id, {
      name: data.name,
      description: data.description,
      parent_id: data.parentId,
    });

    res.json(updatedCategory);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: '输入验证失败', details: error.errors });
      return;
    }
    res.status(500).json({ error: '更新分类失败' });
  }
});

router.delete('/:id', authMiddleware, requirePermission('category_manage', '没有分类管理权限'), async (req: AuthRequest, res: Response) => {
  try {
    const category = await db.getCategoryById(req.params.id);

    if (!category) {
      res.status(404).json({ error: '分类不存在' });
      return;
    }

    const ownerId = getLibraryOwnerId(req.user!);
    if ((category.user_id !== ownerId && req.user!.role !== 'admin') || !hasCategoryScopeAccess(req.user!, category.id)) {
      res.status(403).json({ error: '无权删除此分类' });
      return;
    }

    await db.deleteCategory(req.params.id);
    res.json({ message: '分类已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除分类失败' });
  }
});

export default router;
