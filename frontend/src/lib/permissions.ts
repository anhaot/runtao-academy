import { User, UserPermissions } from '@/types';

const permissionCompatibilityMap: Partial<Record<keyof UserPermissions, Array<keyof UserPermissions>>> = {
  question_view: ['question_view', 'question_create', 'question_edit_content', 'question_edit_meta', 'question_delete', 'question_batch_edit'],
  category_view: ['category_view', 'category_manage'],
  ai_generate: ['ai_generate', 'ai_use'],
  ai_config_manage: ['ai_config_manage', 'ai_use'],
  ai_chat: ['ai_chat', 'ai_use'],
  backup_export: ['backup_export', 'backup_restore'],
};

export const hasPermission = (user: User | null | undefined, permission: keyof UserPermissions): boolean => {
  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.permissions?.[permission]) {
    return true;
  }

  return Boolean(permissionCompatibilityMap[permission]?.some((key) => user.permissions?.[key]));
};
