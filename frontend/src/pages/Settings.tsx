import React, { useState, useEffect } from 'react';
import { useAuthStore, useAIStore } from '@/store';
import { categoryApi, aiApi, adminApi, questionApi } from '@/api';
import { getTagColorClasses } from '@/lib/tagColors';
import { getSingleValueSuggestions } from '@/lib/tagSuggestions';
import {
  Category,
  AIConfig,
  AIStatus,
  User,
  UserPermissions,
  TagSummary,
  TagHealthReport,
  DatabaseProfilesResponse,
  DatabaseValidationReport,
  DatabaseProfile,
  DatabaseCounts,
} from '@/types';
import { LoadingSpinner } from '@/components/ui';
import { toast } from 'react-hot-toast';
import {
  Database,
  Brain,
  FolderOpen,
  Tags,
  Plus,
  Edit,
  Trash2,
  Settings,
  Shield,
  Sparkles,
  X,
  Check,
  Server,
  Key,
  Cpu,
  Play,
  Users,
  UserCog,
  Download,
  Upload,
} from 'lucide-react';

const DEFAULT_USER_PERMISSIONS: UserPermissions = {
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

const ADMIN_PERMISSIONS: UserPermissions = {
  question_view: true,
  question_create: true,
  question_edit_content: true,
  question_edit_meta: true,
  question_delete: true,
  question_batch_edit: true,
  category_view: true,
  category_manage: true,
  import_manage: true,
  question_export: true,
  ai_use: true,
  ai_generate: true,
  ai_config_manage: true,
  ai_chat: true,
  tag_manage: true,
  duplicate_manage: true,
  backup_export: true,
  backup_restore: true,
  ai_polish: true,
  system_manage: true,
  user_manage: true,
};

const PERMISSION_OPTIONS: Array<{ key: keyof UserPermissions; label: string; description: string }> = [
  { key: 'question_view', label: '题目查看', description: '查看题库和题目详情' },
  { key: 'question_create', label: '新增题目', description: '创建单题和写入题库' },
  { key: 'question_edit_content', label: '编辑题目内容', description: '修改题干、答案、解析' },
  { key: 'question_edit_meta', label: '编辑题目属性', description: '修改分类、难度、标签等元信息' },
  { key: 'question_delete', label: '删除题目', description: '删除单题和批量删除' },
  { key: 'question_batch_edit', label: '批量改题', description: '批量标签和批量题目处理' },
  { key: 'question_export', label: '导出题目', description: '导出题库内容' },
  { key: 'category_view', label: '分类查看', description: '查看分类列表和分类结构' },
  { key: 'category_manage', label: '分类管理', description: '新增、编辑、删除分类' },
  { key: 'import_manage', label: '导入权限', description: '批量导入、单题导入' },
  { key: 'ai_use', label: 'AI 基础使用', description: '基础 AI 助手与解析能力' },
  { key: 'ai_generate', label: 'AI 生题', description: '批量生题和相似题生成' },
  { key: 'ai_polish', label: 'AI 润色', description: '对单题进行 AI 润色并写回题库' },
  { key: 'ai_chat', label: 'AI 对话', description: 'AI 助手深度对话和问答' },
  { key: 'ai_config_manage', label: 'AI 配置管理', description: '管理模型、密钥和默认配置' },
  { key: 'tag_manage', label: '标签管理', description: '批量标签操作、标签整理与维护' },
  { key: 'duplicate_manage', label: '查重功能', description: '精确查重、相似题查重处理' },
  { key: 'backup_export', label: '备份导出', description: '导出完整系统备份' },
  { key: 'backup_restore', label: '备份恢复', description: '恢复完整系统备份' },
  { key: 'system_manage', label: '系统管理', description: '系统设置、数据库信息' },
  { key: 'user_manage', label: '用户管理', description: '创建用户、编辑用户、删除用户' },
];

const PERMISSION_GROUPS: Array<{
  title: string;
  description: string;
  keys: Array<keyof UserPermissions>;
}> = [
  {
    title: '题库权限',
    description: '控制题目查看、录入、编辑、删除、批量处理和导出。',
    keys: ['question_view', 'question_create', 'question_edit_content', 'question_edit_meta', 'question_delete', 'question_batch_edit', 'question_export', 'import_manage'],
  },
  {
    title: '分类与治理',
    description: '控制分类、标签和查重等题库治理能力。',
    keys: ['category_view', 'category_manage', 'tag_manage', 'duplicate_manage'],
  },
  {
    title: 'AI 权限',
    description: '控制 AI 助手、生题、润色、对话和配置。',
    keys: ['ai_use', 'ai_generate', 'ai_polish', 'ai_chat', 'ai_config_manage'],
  },
  {
    title: '系统权限',
    description: '控制备份、系统设置和用户管理。',
    keys: ['backup_export', 'backup_restore', 'system_manage', 'user_manage'],
  },
];

const hasPermission = (user: User | null, permission: keyof UserPermissions) => {
  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  return Boolean(user.permissions?.[permission]);
};

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { setStatus: setAIStoreStatus } = useAIStore();
  const [activeTab, setActiveTab] = useState<'system' | 'categories' | 'ai' | 'database'>('system');
  const [categories, setCategories] = useState<Category[]>([]);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([]);
  const [dbInfo, setDbInfo] = useState<{ databaseType: string; version: string; runtime?: { source: 'env' | 'profile'; profileId: string | null; selectedProfileId: string | null } } | null>(null);
  const [dbProfiles, setDbProfiles] = useState<DatabaseProfilesResponse | null>(null);

  const handleAIStatusChange = (status: AIStatus) => {
    setAIStatus(status);
    setAIStoreStatus({
      enabled: status.enabled,
      defaultProvider: status.defaultProvider,
      availableProviders: status.availableProviders,
    });
  };

  useEffect(() => {
    fetchCategories();
    fetchAIStatus();
    fetchAIConfigs();
    fetchDbInfo();
    fetchDbProfiles();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getAll();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchAIStatus = async () => {
    try {
      const response = await aiApi.getStatus();
      setAIStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch AI status:', error);
    }
  };

  const fetchAIConfigs = async () => {
    try {
      const response = await aiApi.getConfigs();
      setAIConfigs(response.data);
    } catch (error) {
      console.error('Failed to fetch AI configs:', error);
    }
  };

  const fetchDbInfo = async () => {
    try {
      const response = await adminApi.getInfo();
      setDbInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch db info:', error);
    }
  };

  const fetchDbProfiles = async () => {
    try {
      const response = await adminApi.getDatabaseProfiles();
      setDbProfiles(response.data);
    } catch (error) {
      console.error('Failed to fetch database profiles:', error);
    }
  };

  const tabs = [
    ...(hasPermission(user, 'system_manage') || hasPermission(user, 'user_manage') || hasPermission(user, 'backup_export') || hasPermission(user, 'backup_restore')
      ? [{ id: 'system' as const, label: '系统管理', icon: Shield, color: 'from-rose-500 to-pink-600' }]
      : []),
    ...(hasPermission(user, 'category_manage')
      ? [{ id: 'categories' as const, label: '分类管理', icon: FolderOpen, color: 'from-amber-500 to-orange-600' }]
      : []),
    ...(hasPermission(user, 'ai_use')
      ? [{ id: 'ai' as const, label: 'AI设置', icon: Brain, color: 'from-violet-500 to-purple-600' }]
      : []),
    ...(hasPermission(user, 'system_manage')
      ? [{ id: 'database' as const, label: '数据库', icon: Database, color: 'from-emerald-500 to-teal-600' }]
      : []),
  ] as const;

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab) && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTab, tabs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl shadow-lg p-3">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
          <p className="text-sm text-gray-500">统一管理权限、标签、AI、数据库和系统级配置。</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 rounded-xl p-4 transition-all ${
                isActive
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              <span className="truncate text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'system' && (hasPermission(user, 'system_manage') || hasPermission(user, 'user_manage') || hasPermission(user, 'backup_export') || hasPermission(user, 'backup_restore')) && <SystemSettings />}
      {activeTab === 'categories' && (
        <CategorySettings
          categories={categories}
          onRefresh={fetchCategories}
        />
      )}
      {activeTab === 'ai' && (
        <AISettings
          aiStatus={aiStatus}
          aiConfigs={aiConfigs}
          onRefresh={() => {
            fetchAIStatus();
            fetchAIConfigs();
          }}
          onStatusChange={handleAIStatusChange}
        />
      )}
      {activeTab === 'database' && <DatabaseSettings dbInfo={dbInfo} dbProfiles={dbProfiles} onRefresh={() => { fetchDbInfo(); fetchDbProfiles(); }} />}
    </div>
  );
};

interface CategorySettingsProps {
  categories: Category[];
  onRefresh: () => void;
}

const CategorySettings: React.FC<CategorySettingsProps> = ({ categories, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [renamingTag, setRenamingTag] = useState<TagSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [normalizingTags, setNormalizingTags] = useState(false);
  const [tagAliases, setTagAliases] = useState<Array<{ alias: string; target: string }>>([]);
  const [aliasForm, setAliasForm] = useState({ alias: '', target: '' });
  const [savingAliases, setSavingAliases] = useState(false);
  const [tagHealth, setTagHealth] = useState<TagHealthReport | null>(null);
  const [loadingTagHealth, setLoadingTagHealth] = useState(true);
  const matchedAliasTargets = getSingleValueSuggestions(aliasForm.target, tags);

  const fetchTags = async () => {
    setLoadingTags(true);
    try {
      const response = await questionApi.getTags();
      setTags(response.data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  useEffect(() => {
    fetchTags();
    fetchTagAliases();
    fetchTagHealth();
  }, []);

  const fetchTagAliases = async () => {
    try {
      const response = await adminApi.getSettings();
      const aliases = Object.entries(response.data.tagAliases || {}).map(([alias, target]) => ({ alias, target }));
      aliases.sort((a, b) => a.alias.localeCompare(b.alias, 'zh-CN'));
      setTagAliases(aliases);
    } catch (error) {
      console.error('Failed to fetch tag aliases:', error);
    }
  };

  const fetchTagHealth = async () => {
    setLoadingTagHealth(true);
    try {
      const response = await questionApi.getTagHealth();
      setTagHealth(response.data);
    } catch (error) {
      console.error('Failed to fetch tag health:', error);
    } finally {
      setLoadingTagHealth(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此分类吗？')) return;

    try {
      await categoryApi.delete(id);
      toast.success('删除成功');
      onRefresh();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleDeleteTag = async (tagName: string) => {
    if (!confirm(`确定要删除标签“${tagName}”吗？这会把它从所有题目中移除。`)) return;

    try {
      const response = await questionApi.deleteTag(tagName);
      toast.success(response.data.message);
      fetchTags();
      fetchTagHealth();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '删除标签失败');
    }
  };

  const handleRenameTag = async () => {
    if (!renamingTag) return;

    const nextName = renameValue.trim();
    if (!nextName) {
      toast.error('请输入新标签名');
      return;
    }

    try {
      const response = await questionApi.renameTag(renamingTag.name, nextName);
      toast.success(response.data.message);
      setRenamingTag(null);
      setRenameValue('');
      fetchTags();
      fetchTagHealth();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '重命名标签失败');
    }
  };

  const renameTagDirectly = async (fromTag: string, toTag: string) => {
    if (fromTag === toTag) {
      return;
    }

    try {
      const response = await questionApi.renameTag(fromTag, toTag);
      toast.success(response.data.message);
      fetchTags();
      fetchTagHealth();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '合并标签失败');
    }
  };

  const handleNormalizeTags = async () => {
    setNormalizingTags(true);
    try {
      const response = await questionApi.normalizeTags();
      toast.success(response.data.message);
      fetchTags();
      fetchTagHealth();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '规范化标签失败');
    } finally {
      setNormalizingTags(false);
    }
  };

  const saveTagAliases = async (nextAliases: Array<{ alias: string; target: string }>) => {
    setSavingAliases(true);
    try {
      const payload = JSON.stringify(
        nextAliases.reduce<Record<string, string>>((acc, item) => {
          const alias = item.alias.trim().toLowerCase();
          const target = item.target.trim().toLowerCase();
          if (alias && target && alias !== target) {
            acc[alias] = target;
          }
          return acc;
        }, {})
      );
      await adminApi.updateSetting('tag_aliases', payload);
      setTagAliases(nextAliases);
      toast.success('标签别名已保存');
      fetchTagHealth();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '保存标签别名失败');
    } finally {
      setSavingAliases(false);
    }
  };

  const handleAddAlias = async () => {
    const alias = aliasForm.alias.trim().toLowerCase();
    const target = aliasForm.target.trim().toLowerCase();
    if (!alias || !target) {
      toast.error('请填写别名和主标签');
      return;
    }
    if (alias === target) {
      toast.error('别名和主标签不能相同');
      return;
    }
    const nextAliases = [...tagAliases.filter((item) => item.alias !== alias), { alias, target }]
      .sort((a, b) => a.alias.localeCompare(b.alias, 'zh-CN'));
    await saveTagAliases(nextAliases);
    setAliasForm({ alias: '', target: '' });
  };

  const handleDeleteAlias = async (alias: string) => {
    const nextAliases = tagAliases.filter((item) => item.alias !== alias);
    await saveTagAliases(nextAliases);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">分类管理</h2>
          </div>
          <button
            onClick={() => { setEditingCategory(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white text-sm font-medium hover:from-amber-600 hover:to-orange-700 transition-colors"
          >
            <Plus size={18} />
            添加分类
          </button>
        </div>

        <div className="p-6">
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-amber-50 rounded-2xl inline-flex mb-4">
                <FolderOpen size={32} className="text-amber-400" />
              </div>
              <p className="text-gray-600">暂无分类</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <div>
                    <p className="font-medium text-gray-900">{category.name}</p>
                    {category.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{category.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingCategory(category); setShowModal(true); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
            <Tags className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">标签健康检查</h2>
            <p className="text-sm text-gray-500">查看低频标签、已配置别名和疑似重复标签</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loadingTagHealth ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : tagHealth ? (
            <>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">低频标签</h3>
                {tagHealth.lowFrequency.length === 0 ? (
                  <p className="text-sm text-gray-500">没有低频标签。</p>
                ) : (
                  <div className="grid gap-3">
                    {tagHealth.lowFrequency.slice(0, 20).map((tag) => (
                      <div key={tag.name} className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-amber-800">
                          <span className="font-medium">{tag.name}</span>
                          <span className="text-xs text-amber-600">仅 {tag.count} 道题</span>
                        </div>
                        <button
                          onClick={() => handleDeleteTag(tag.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-200 text-amber-700 text-sm hover:bg-amber-100 transition-colors"
                        >
                          <Trash2 size={14} />
                          删除标签
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">已配置别名</h3>
                {tagHealth.aliased.length === 0 ? (
                  <p className="text-sm text-gray-500">暂无别名规则。</p>
                ) : (
                  <div className="grid gap-3">
                    {tagHealth.aliased.slice(0, 20).map((item) => (
                      <div key={item.alias} className="rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                        <span className="font-medium">{item.alias}</span>
                        <span className="mx-2 text-gray-400">{'->'}</span>
                        <span className="font-medium text-violet-700">{item.target}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">疑似重复标签</h3>
                {tagHealth.similarPairs.length === 0 ? (
                  <p className="text-sm text-gray-500">暂未发现疑似重复标签。</p>
                ) : (
                  <div className="grid gap-3">
                    {tagHealth.similarPairs.map((pair, index) => (
                      <div key={`${pair.left}-${pair.right}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700">{pair.left}</span>
                          <span className="text-gray-400">{'vs'}</span>
                          <span className="inline-flex px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700">{pair.right}</span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">原因：{pair.reason}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => renameTagDirectly(pair.right, pair.left)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-sm hover:bg-violet-100 transition-colors"
                          >
                            合并为 {pair.left}
                          </button>
                          <button
                            onClick={() => renameTagDirectly(pair.left, pair.right)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-sm hover:bg-violet-100 transition-colors"
                          >
                            合并为 {pair.right}
                          </button>
                          <button
                            onClick={() => {
                              setAliasForm({ alias: pair.left, target: pair.right });
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition-colors"
                          >
                            设为别名
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">标签健康检查暂不可用。</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="p-2 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-lg">
            <Tags className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">标签管理</h2>
            <p className="text-sm text-gray-500">重命名、合并或删除题目标签</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={handleNormalizeTags}
              disabled={normalizingTags}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              <Tags size={16} />
              {normalizingTags ? '规范化中...' : '一键规范化'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {loadingTags ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-sky-50 rounded-2xl inline-flex mb-4">
                <Tags size={32} className="text-sky-400" />
              </div>
              <p className="text-gray-600">暂无标签</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tags.map((tag) => (
                <div key={tag.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${getTagColorClasses(tag.name)}`}>
                      {tag.name}
                    </span>
                    <span className="text-sm text-gray-500">关联 {tag.count} 道题</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRenamingTag(tag);
                        setRenameValue(tag.name);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.name)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-lg">
            <Tags className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">标签别名</h2>
            <p className="text-sm text-gray-500">把常见别名自动归并到主标签，例如 js {'->'} javascript</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              value={aliasForm.alias}
              onChange={(e) => setAliasForm((prev) => ({ ...prev, alias: e.target.value }))}
              placeholder="别名，例如 js"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
            />
            <input
              type="text"
              value={aliasForm.target}
              onChange={(e) => setAliasForm((prev) => ({ ...prev, target: e.target.value }))}
              placeholder="主标签，例如 javascript"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
            />
            <button
              onClick={handleAddAlias}
              disabled={savingAliases}
              className="px-4 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-xl text-white hover:from-violet-600 hover:to-fuchsia-700 transition-all disabled:opacity-50"
            >
              添加别名
            </button>
          </div>
          {matchedAliasTargets.length > 0 ? (
            <div className="-mt-1 rounded-xl border border-gray-200 bg-white p-2">
              <div className="flex flex-wrap gap-2">
                {matchedAliasTargets.map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => setAliasForm((prev) => ({ ...prev, target: tag.name }))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span>{tag.name}</span>
                    <span className="text-[11px] text-gray-400">{tag.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tagAliases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
              暂无别名规则。添加后，新建题目、导入题目、AI 生题和一键规范化都会自动应用这些规则。
            </div>
          ) : (
            <div className="grid gap-3">
              {tagAliases.map((item) => (
                <div key={item.alias} className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700">{item.alias}</span>
                    <span className="text-gray-400">{'->'}</span>
                    <span className="inline-flex px-3 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-violet-700">{item.target}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteAlias(item.alias)}
                    disabled={savingAliases}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CategoryModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        category={editingCategory}
        onSuccess={() => { setShowModal(false); onRefresh(); }}
      />

      {renamingTag ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-transparent" onClick={() => { setRenamingTag(null); setRenameValue(''); }} />
          <div className="relative flex min-h-full items-center justify-center px-4 py-6">
            <div className="app-modal-panel w-full max-w-md overflow-hidden">
              <div className="app-modal-header flex items-center justify-between px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">重命名标签</h2>
                <button onClick={() => { setRenamingTag(null); setRenameValue(''); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">原标签</label>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-500">{renamingTag.name}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">新标签</label>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 focus:bg-white transition-all"
                  />
                  <p className="mt-2 text-xs text-gray-500">如果新标签已存在，会自动合并到已有标签。</p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => { setRenamingTag(null); setRenameValue(''); }}
                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleRenameTag}
                    className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-cyan-600 rounded-xl text-white hover:from-sky-600 hover:to-cyan-700 transition-all"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  onSuccess: () => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ isOpen, onClose, category, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    if (category) {
      setFormData({ name: category.name, description: category.description || '' });
    } else {
      setFormData({ name: '', description: '' });
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (category) {
        await categoryApi.update(category.id, { name: formData.name, description: formData.description || undefined });
        toast.success('更新成功');
      } else {
        await categoryApi.create({ name: formData.name, description: formData.description || undefined });
        toast.success('创建成功');
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
      <div className="app-modal-panel w-full max-w-md overflow-hidden">
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{category ? '编辑分类' : '添加分类'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">分类名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">描述（可选）</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all">
              取消
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? '保存中...' : category ? '更新' : '创建'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};

interface AISettingsProps {
  aiStatus: AIStatus | null;
  aiConfigs: AIConfig[];
  onRefresh: () => void;
  onStatusChange: (status: AIStatus) => void;
}

const AISettings: React.FC<AISettingsProps> = ({ aiStatus, aiConfigs, onRefresh, onStatusChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [updating, setUpdating] = useState(false);

  const handleToggleEnabled = async () => {
    if (!aiStatus) return;
    setUpdating(true);
    try {
      const response = await aiApi.updateSettings({ enabled: !aiStatus.enabled });
      onStatusChange(response.data);
      toast.success(aiStatus.enabled ? 'AI已禁用' : 'AI已启用');
    } catch (error) {
      toast.error('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const handleDefaultProviderChange = async (provider: string) => {
    setUpdating(true);
    try {
      const config = aiConfigs.find(c => c.provider === provider);
      if (config) {
        await aiApi.setActiveConfig(config.id);
        onRefresh();
        toast.success('已切换默认模型');
      }
    } catch (error) {
      toast.error('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此配置吗？')) return;

    try {
      await aiApi.deleteConfig(id);
      toast.success('删除成功');
      onRefresh();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const providerOptions = [
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'qwen', label: '千问' },
    { value: 'doubao', label: '豆包' },
    { value: 'wenxin', label: '文心一言' },
    { value: 'zhipu', label: '智谱AI' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="p-2 bg-primary-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">AI设置</h2>
        </div>
        
        {aiStatus ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
                  <Cpu size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">AI功能</p>
                  <p className="text-sm text-gray-500">启用后可在学习模式中使用AI辅助功能</p>
                </div>
              </div>
              <button
                onClick={handleToggleEnabled}
                disabled={updating}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  aiStatus.enabled ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${aiStatus.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Key size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">默认模型</p>
                  <p className="text-sm text-gray-500">选择默认使用的AI模型</p>
                </div>
              </div>
              <select
                value={aiConfigs.find(c => c.isActive)?.provider || ''}
                onChange={(e) => handleDefaultProviderChange(e.target.value)}
                disabled={updating}
                className="select-field min-w-[140px] px-4 pr-10 py-2 bg-white text-gray-700 cursor-pointer"
              >
                {aiConfigs.filter(c => c.isActive).map((config) => (
                  <option key={config.id} value={config.provider}>
                    {providerOptions.find(o => o.value === config.provider)?.label || config.provider}
                  </option>
                ))}
                {aiConfigs.filter(c => !c.isActive).map((config) => (
                  <option key={config.id} value={config.provider}>
                    {providerOptions.find(o => o.value === config.provider)?.label || config.provider}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-700 rounded-lg">
              <Key className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">API配置</h2>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 rounded-lg text-white text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus size={18} />
            添加配置
          </button>
        </div>

        <div className="p-6">
          {aiConfigs.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-4 bg-gray-100 rounded-xl inline-flex mb-4">
                <Key size={32} className="text-gray-400" />
              </div>
              <p className="text-gray-600">暂无AI配置</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {aiConfigs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg border border-gray-200">
                      <Cpu size={18} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{config.displayName || config.provider}</p>
                      <p className="text-sm text-gray-500">模型：{config.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {config.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                        <Check size={12} />
                        当前使用
                      </span>
                    ) : (
                      <button
                        onClick={async () => {
                          try {
                            await aiApi.setActiveConfig(config.id);
                            onRefresh();
                            toast.success('已切换配置');
                          } catch (error) {
                            toast.error('切换失败');
                          }
                        }}
                        className="px-3 py-1 text-xs font-medium text-primary-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        设为当前
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const response = await aiApi.testConfig(config.id);
                          toast.success(response.data.message);
                        } catch (error: any) {
                          toast.error(error.response?.data?.error || '测试失败');
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="测试配置"
                    >
                      <Play size={16} />
                    </button>
                    <button
                      onClick={() => { setEditingConfig(config); setShowModal(true); }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(config.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AIConfigModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingConfig(null); }}
          onSuccess={() => { setShowModal(false); setEditingConfig(null); onRefresh(); }}
          editingConfig={editingConfig}
        />
      </div>
    </div>
  );
};

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingConfig?: AIConfig | null;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose, onSuccess, editingConfig }) => {
  const [loading, setLoading] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'deepseek',
    displayName: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    isCustom: false,
  });

  const presetProviders: Record<string, { label: string; model: string }> = {
    deepseek: { label: 'DeepSeek', model: 'deepseek-chat' },
    openai: { label: 'OpenAI', model: 'gpt-4o-mini' },
    qwen: { label: '千问', model: 'qwen-turbo' },
    doubao: { label: '豆包', model: 'doubao-pro-4k' },
    wenxin: { label: '文心一言', model: 'ernie-bot-4' },
    zhipu: { label: '智谱AI', model: 'glm-4' },
  };

  useEffect(() => {
    if (editingConfig) {
      setIsCustom(editingConfig.isCustom || false);
      setFormData({
        provider: editingConfig.provider,
        displayName: editingConfig.displayName || '',
        baseUrl: editingConfig.baseUrl || '',
        apiKey: '',
        model: editingConfig.model,
        isCustom: editingConfig.isCustom || false,
      });
    } else {
      setIsCustom(false);
      setFormData({
        provider: 'deepseek',
        displayName: '',
        baseUrl: '',
        apiKey: '',
        model: '',
        isCustom: false,
      });
    }
  }, [editingConfig]);

  useEffect(() => {
    if (!isCustom && formData.provider && presetProviders[formData.provider]) {
      setFormData((prev) => ({ 
        ...prev, 
        model: presetProviders[formData.provider].model,
        displayName: presetProviders[formData.provider].label,
        isCustom: false 
      }));
    }
  }, [formData.provider, isCustom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingConfig) {
        const updateData = {
          provider: isCustom ? formData.displayName?.toLowerCase().replace(/\s+/g, '-') : formData.provider,
          displayName: formData.displayName || presetProviders[formData.provider]?.label,
          baseUrl: isCustom ? formData.baseUrl : undefined,
          apiKey: formData.apiKey || undefined,
          model: formData.model,
        };
        await aiApi.updateConfig(editingConfig.id, updateData);
        toast.success('配置更新成功');
      } else {
        const submitData = {
          provider: isCustom ? formData.displayName?.toLowerCase().replace(/\s+/g, '-') : formData.provider,
          displayName: formData.displayName || presetProviders[formData.provider]?.label,
          baseUrl: isCustom ? formData.baseUrl : undefined,
          apiKey: formData.apiKey,
          model: formData.model,
          isCustom: isCustom,
        };
        await aiApi.createConfig(submitData);
        toast.success('配置创建成功');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Config save error:', error);
      toast.error(error.response?.data?.error || (editingConfig ? '更新失败' : '创建失败'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
      <div className="app-modal-panel w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="app-modal-header sticky top-0 flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{editingConfig ? '编辑AI配置' : '添加AI配置'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              type="button"
              onClick={() => { setIsCustom(false); setFormData(prev => ({ ...prev, provider: 'deepseek' })); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${!isCustom ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              预设提供商
            </button>
            <button
              type="button"
              onClick={() => { setIsCustom(true); setFormData(prev => ({ ...prev, provider: '', displayName: '', baseUrl: '' })); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${isCustom ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              自定义提供商
            </button>
          </div>

          {!isCustom ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI提供商</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-700 focus:bg-white cursor-pointer"
              >
                {Object.entries(presetProviders).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">显示名称</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                  placeholder="例如：我的AI助手"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API地址 (Base URL)</label>
                <input
                  type="url"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="例如：https://api.example.com/v1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">OpenAI兼容的API地址，留空则使用默认地址</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">API密钥</label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              required={!editingConfig}
              placeholder={editingConfig ? '留空保持原密钥不变' : '请输入API密钥'}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
            />
            {editingConfig && (
              <p className="text-xs text-gray-500 mt-1">留空则保持原密钥不变</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">模型名称</label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              required
              placeholder="例如：gpt-4o-mini"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all">
              取消
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl text-white hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (editingConfig ? '保存中...' : '创建中...') : (editingConfig ? '保存' : '创建')}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};

interface DatabaseSettingsProps {
  dbInfo: { databaseType: string; version: string; runtime?: { source: 'env' | 'profile'; profileId: string | null; selectedProfileId: string | null } } | null;
  dbProfiles: DatabaseProfilesResponse | null;
  onRefresh: () => void;
}

const DatabaseSettings: React.FC<DatabaseSettingsProps> = ({ dbInfo, dbProfiles, onRefresh }) => {
  const [editingProfile, setEditingProfile] = useState<DatabaseProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [operatingId, setOperatingId] = useState<string | null>(null);
  const [validationReport, setValidationReport] = useState<DatabaseValidationReport | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'sqlite' as 'sqlite' | 'mysql',
    sqlitePath: './data/runtao-academy-secondary.db',
    mysqlHost: '127.0.0.1',
    mysqlPort: '3306',
    mysqlUser: 'root',
    mysqlPassword: '',
    mysqlDatabase: 'runtao_academy',
  });

  const resetForm = () => {
    setEditingProfile(null);
    setValidationReport(null);
    setFormData({
      name: '',
      type: 'sqlite',
      sqlitePath: './data/runtao-academy-secondary.db',
      mysqlHost: '127.0.0.1',
      mysqlPort: '3306',
      mysqlUser: 'root',
      mysqlPassword: '',
      mysqlDatabase: 'runtao_academy',
    });
  };

  useEffect(() => {
    if (!editingProfile) {
      return;
    }

    setFormData({
      name: editingProfile.name,
      type: editingProfile.type,
      sqlitePath: editingProfile.sqlite?.path || './data/runtao-academy-secondary.db',
      mysqlHost: editingProfile.mysql?.host || '127.0.0.1',
      mysqlPort: String(editingProfile.mysql?.port || 3306),
      mysqlUser: editingProfile.mysql?.user || 'root',
      mysqlPassword: '',
      mysqlDatabase: editingProfile.mysql?.database || 'runtao_academy',
    });
  }, [editingProfile]);

  const submitProfile = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入数据库配置名称');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        sqlite: formData.type === 'sqlite' ? { path: formData.sqlitePath.trim() } : undefined,
        mysql: formData.type === 'mysql'
          ? {
              host: formData.mysqlHost.trim(),
              port: Number(formData.mysqlPort || 3306),
              user: formData.mysqlUser.trim(),
              password: formData.mysqlPassword,
              database: formData.mysqlDatabase.trim(),
            }
          : undefined,
      };

      if (editingProfile) {
        await adminApi.updateDatabaseProfile(editingProfile.id, payload);
        toast.success('数据库配置已更新');
      } else {
        await adminApi.createDatabaseProfile(payload);
        toast.success('数据库配置已创建');
      }
      resetForm();
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '保存数据库配置失败');
    } finally {
      setSaving(false);
    }
  };

  const runProfileAction = async (profileId: string, action: () => Promise<any>, successMessage?: string) => {
    setOperatingId(profileId);
    try {
      const response = await action();
      if (successMessage) {
        toast.success(successMessage);
      } else if (response.data?.message) {
        toast.success(response.data.message);
      }
      return response;
    } catch (error: any) {
      toast.error(error.response?.data?.error || '数据库操作失败');
      return null;
    } finally {
      setOperatingId(null);
    }
  };

  const handleDeleteProfile = async (profile: DatabaseProfile) => {
    if (!confirm(`确定要删除数据库配置“${profile.name}”吗？`)) {
      return;
    }
    const response = await runProfileAction(profile.id, () => adminApi.deleteDatabaseProfile(profile.id));
    if (response) {
      onRefresh();
      if (editingProfile?.id === profile.id) {
        resetForm();
      }
    }
  };

  const renderCounts = (counts: DatabaseCounts) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Object.entries(counts).map(([key, value]) => (
        <div key={key} className="rounded-xl bg-gray-50 p-3">
          <p className="text-xs text-gray-500 mb-1">{key}</p>
          <p className="text-lg font-semibold text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">当前数据库</h2>
            <p className="text-sm text-gray-500">查看当前连接状态，并通过配置向导准备下次切换的数据库</p>
          </div>
        </div>

        {dbInfo && dbProfiles ? (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">当前数据库类型</p>
                <p className="text-lg font-semibold text-gray-900">{dbInfo.databaseType === 'sqlite' ? 'SQLite' : 'MySQL'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">配置来源</p>
                <p className="text-lg font-semibold text-gray-900">{dbInfo.runtime?.source === 'profile' ? '系统设置' : '环境变量'}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">系统版本</p>
                <p className="text-lg font-semibold text-gray-900">{dbInfo.version}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-800">
                <span>当前进程连接：{dbProfiles.current.databaseType === 'sqlite' ? 'SQLite' : 'MySQL'}</span>
                <span className="text-emerald-500">|</span>
                <span>下次启动目标：{dbProfiles.selectedProfileId ? '系统设置中的数据库配置' : '环境变量默认数据库'}</span>
                {dbProfiles.needsRestart ? (
                  <>
                    <span className="text-emerald-500">|</span>
                    <span className="font-medium">已选择新数据库，重启后生效</span>
                  </>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => runProfileAction('env-reset', async () => {
                    const response = await adminApi.useEnvDatabase();
                    onRefresh();
                    return response;
                  })}
                  disabled={operatingId === 'env-reset'}
                  className="px-3 py-2 rounded-xl bg-white border border-emerald-200 text-sm text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                >
                  恢复环境变量默认库
                </button>
              </div>
              {renderCounts(dbProfiles.current.counts)}
            </div>
          </div>
        ) : (
          <div className="p-6 flex justify-center">
            <LoadingSpinner />
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">数据库配置</h2>
                <p className="text-sm text-gray-500">支持保存多个目标数据库，先测试再迁移</p>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-all"
            >
              <Plus size={16} />
              新建配置
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">配置名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：正式 MySQL / 备份 SQLite"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">数据库类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value as 'sqlite' | 'mysql' }))}
                  className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-900 focus:bg-white cursor-pointer"
                >
                  <option value="sqlite">SQLite</option>
                  <option value="mysql">MySQL</option>
                </select>
              </div>

              {formData.type === 'sqlite' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">SQLite 文件路径</label>
                  <input
                    type="text"
                    value={formData.sqlitePath}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sqlitePath: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">主机</label>
                    <input type="text" value={formData.mysqlHost} onChange={(e) => setFormData((prev) => ({ ...prev, mysqlHost: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">端口</label>
                    <input type="number" value={formData.mysqlPort} onChange={(e) => setFormData((prev) => ({ ...prev, mysqlPort: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                    <input type="text" value={formData.mysqlUser} onChange={(e) => setFormData((prev) => ({ ...prev, mysqlUser: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">数据库名</label>
                    <input type="text" value={formData.mysqlDatabase} onChange={(e) => setFormData((prev) => ({ ...prev, mysqlDatabase: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">密码 {editingProfile?.mysql?.hasPassword ? '(留空表示保持不变)' : ''}</label>
                    <input type="password" value={formData.mysqlPassword} onChange={(e) => setFormData((prev) => ({ ...prev, mysqlPassword: e.target.value }))} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                {editingProfile ? (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    取消编辑
                  </button>
                ) : null}
                <button
                  onClick={submitProfile}
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl text-white hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50"
                >
                  {saving ? '保存中...' : editingProfile ? '更新配置' : '保存配置'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">迁移向导</h2>
              <p className="text-sm text-gray-500">按“测试连接 → 初始化 → 迁移数据 → 校验 → 设为生效”的顺序操作</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {!dbProfiles ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : dbProfiles.profiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                还没有数据库配置。先在左侧创建一个 SQLite 或 MySQL 目标库配置。
              </div>
            ) : (
              dbProfiles.profiles.map((profile) => {
                const isOperating = operatingId === profile.id;
                const isSelected = dbProfiles.selectedProfileId === profile.id;
                return (
                  <div key={profile.id} className={`rounded-2xl border p-4 ${isSelected ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-semibold text-gray-900">{profile.name}</h3>
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600">
                            {profile.type === 'sqlite' ? 'SQLite' : 'MySQL'}
                          </span>
                          {isSelected ? (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                              下次启动生效
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {profile.type === 'sqlite'
                            ? profile.sqlite?.path
                            : `${profile.mysql?.host}:${profile.mysql?.port}/${profile.mysql?.database} (${profile.mysql?.user})`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingProfile(profile)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDeleteProfile(profile)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                      <button
                        onClick={() => runProfileAction(profile.id, () => adminApi.testDatabaseProfile(profile.id))}
                        disabled={isOperating}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        测试连接
                      </button>
                      <button
                        onClick={() => runProfileAction(profile.id, async () => {
                          const response = await adminApi.initDatabaseProfile(profile.id);
                          setValidationReport(null);
                          return response;
                        })}
                        disabled={isOperating}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        初始化结构
                      </button>
                      <button
                        onClick={() => runProfileAction(profile.id, () => adminApi.migrateDatabaseProfile(profile.id, false))}
                        disabled={isOperating}
                        className="px-3 py-2 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 transition-all disabled:opacity-50"
                      >
                        迁移数据
                      </button>
                      <button
                        onClick={() => runProfileAction(profile.id, async () => {
                          const response = await adminApi.validateDatabaseProfile(profile.id);
                          setValidationReport(response.data);
                          toast.success(response.data.matches ? '校验通过' : '校验完成，发现差异');
                          return response;
                        })}
                        disabled={isOperating}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                      >
                        校验数据
                      </button>
                      <button
                        onClick={() => runProfileAction(profile.id, async () => {
                          const response = await adminApi.selectDatabaseProfile(profile.id);
                          onRefresh();
                          return response;
                        })}
                        disabled={isOperating}
                        className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-sm text-white hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50"
                      >
                        设为生效
                      </button>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => runProfileAction(profile.id, () => adminApi.migrateDatabaseProfile(profile.id, true))}
                        disabled={isOperating}
                        className="text-sm text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50"
                      >
                        覆盖迁移目标库
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {validationReport ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className={`p-2 rounded-lg ${validationReport.matches ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">迁移校验结果</h2>
              <p className="text-sm text-gray-500">{validationReport.matches ? '源库和目标库数量一致' : '源库和目标库存在数量差异'}</p>
            </div>
          </div>
          <div className="p-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">源数据库</h3>
              {renderCounts(validationReport.source)}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">目标数据库</h3>
              {renderCounts(validationReport.target)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const SystemSettings: React.FC = () => {
  const { user } = useAuthStore();
  const canManageSystem = hasPermission(user, 'system_manage');
  const canManageUsers = hasPermission(user, 'user_manage');
  const canBackupRestore = hasPermission(user, 'backup_export') || hasPermission(user, 'backup_restore');
  const [allowRegister, setAllowRegister] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [resetLearningBusy, setResetLearningBusy] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
    userType: 'independent' as 'independent' | 'integrated',
    libraryOwnerId: '' as string,
    categoryScopes: [] as string[],
    permissions: DEFAULT_USER_PERMISSIONS,
  });
  const [assignableCategories, setAssignableCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (canManageSystem) {
      fetchSettings();
    }
    if (canManageUsers) {
      fetchUsers();
    } else if (!canBackupRestore) {
      setLoading(false);
    }
  }, [canManageSystem, canManageUsers, canBackupRestore]);

  const fetchSettings = async () => {
    try {
      const response = await adminApi.getSettings();
      setAllowRegister(response.data.allowRegister);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await adminApi.getAllUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignableCategories = async (ownerId?: string) => {
    if (!ownerId) {
      setAssignableCategories([]);
      return;
    }

    try {
      const response = await adminApi.getUserCategories(ownerId);
      setAssignableCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch assignable categories:', error);
      setAssignableCategories([]);
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setAssignableCategories([]);
    setUserForm({
      username: '',
      email: '',
      password: '',
      role: 'user',
      userType: 'independent',
      libraryOwnerId: '',
      categoryScopes: [],
      permissions: DEFAULT_USER_PERMISSIONS,
    });
  };

  const openCreateUserModal = () => {
    resetUserForm();
    setUserModalMode('create');
  };

  const openEditUserModal = (targetUser: User) => {
    setEditingUser(targetUser);
    setUserForm({
      username: targetUser.username,
      email: targetUser.email,
      password: '',
      role: targetUser.role,
      userType: targetUser.user_type || 'independent',
      libraryOwnerId: targetUser.library_owner_id || '',
      categoryScopes: targetUser.category_scopes || [],
      permissions: targetUser.role === 'admin' ? ADMIN_PERMISSIONS : targetUser.permissions,
    });
    setUserModalMode('edit');
  };

  useEffect(() => {
    if (!canManageUsers || userForm.role !== 'user' || userForm.userType !== 'integrated') {
      setAssignableCategories([]);
      return;
    }

    const ownerId = userForm.libraryOwnerId || user?.id || '';
    void fetchAssignableCategories(ownerId);
  }, [canManageUsers, user?.id, userForm.role, userForm.userType, userForm.libraryOwnerId]);

  const closeUserModal = () => {
    setUserModalMode(null);
    resetUserForm();
  };

  const handleToggleRegister = async () => {
    setUpdating(true);
    try {
      const newValue = !allowRegister;
      await adminApi.updateSetting('allow_register', String(newValue));
      setAllowRegister(newValue);
      toast.success(newValue ? '已开放用户注册' : '已关闭用户注册');
    } catch (error) {
      toast.error('更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const handleExportBackup = async () => {
    setBackupBusy(true);
    try {
      const response = await adminApi.exportBackup();
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `runtao-academy-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('备份已导出');
    } catch (error: any) {
      toast.error(error.response?.data?.error || '导出备份失败');
    } finally {
      setBackupBusy(false);
      setLoading(false);
    }
  };

  const handleRestoreBackup = async (file: File | null) => {
    if (!file) return;

    setBackupBusy(true);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const counts = parsed?.meta?.counts;
      const preview = counts
        ? `用户 ${counts.users} / 分类 ${counts.categories} / 题目 ${counts.questions} / 学习记录 ${counts.learning_progress} / AI配置 ${counts.ai_configs} / 系统设置 ${counts.system_settings}`
        : '未提供数量摘要';
      if (!confirm(`将恢复以下备份数据：\n${preview}\n\n恢复会覆盖当前系统数据，确定继续吗？`)) {
        setBackupBusy(false);
        return;
      }
      await adminApi.restoreBackup(parsed.dataset || {});
      toast.success('备份已恢复');
      fetchSettings();
      if (canManageUsers) {
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || '恢复备份失败');
    } finally {
      setBackupBusy(false);
      setLoading(false);
    }
  };

  const handleResetLearningProgress = async () => {
    if (!confirm('确定要清空当前账号的学习相关信息吗？这会清除背题/答题进度、已查看次数、收藏标记和最近学习记录。')) {
      return;
    }

    setResetLearningBusy(true);
    try {
      const response = await questionApi.resetLearningProgress();
      toast.success(response.data.message || '学习记录已清空');
    } catch (error: any) {
      toast.error(error.response?.data?.error || '清空学习记录失败');
    } finally {
      setResetLearningBusy(false);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`确定要删除用户 "${username}" 吗？`)) return;

    try {
      await adminApi.deleteUser(id);
      toast.success('用户已删除');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await adminApi.updateUserRole(id, role);
      toast.success('角色已更新');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '更新失败');
    }
  };

  const handlePermissionChange = (permission: keyof UserPermissions, checked: boolean) => {
    if (userForm.role === 'admin') {
      return;
    }

    setUserForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked,
      },
    }));
  };

  const handleModalRoleChange = (role: 'admin' | 'user') => {
    setUserForm((prev) => ({
      ...prev,
      role,
      permissions: role === 'admin'
        ? ADMIN_PERMISSIONS
        : (editingUser?.role === 'user' ? editingUser.permissions : DEFAULT_USER_PERMISSIONS),
    }));
  };

  const handleSaveUser = async () => {
    try {
      if (!userForm.username.trim()) {
        toast.error('请输入用户名');
        return;
      }
      if (!userForm.email.trim()) {
        toast.error('请输入邮箱');
        return;
      }
      if (userModalMode === 'create' && !userForm.password.trim()) {
        toast.error('请输入初始密码');
        return;
      }

      if (userModalMode === 'create') {
        await adminApi.createUser({
          username: userForm.username.trim(),
          email: userForm.email.trim(),
          password: userForm.password,
          role: userForm.role,
          userType: userForm.role === 'admin' ? 'independent' : userForm.userType,
          libraryOwnerId: userForm.role === 'admin' || userForm.userType === 'independent' ? null : (userForm.libraryOwnerId || user?.id || null),
          categoryScopes: userForm.role === 'admin' || userForm.userType === 'independent' ? [] : userForm.categoryScopes,
          permissions: userForm.role === 'admin' ? ADMIN_PERMISSIONS : userForm.permissions,
        });
        toast.success('用户创建成功');
      } else if (editingUser) {
        const updateData: {
          username?: string;
          email?: string;
          password?: string;
          role?: 'admin' | 'user';
          userType?: 'independent' | 'integrated';
          libraryOwnerId?: string | null;
          categoryScopes?: string[];
          permissions?: UserPermissions;
        } = {
          username: userForm.username.trim(),
          email: userForm.email.trim(),
          role: userForm.role,
          userType: userForm.role === 'admin' ? 'independent' : userForm.userType,
          libraryOwnerId: userForm.role === 'admin' || userForm.userType === 'independent' ? null : (userForm.libraryOwnerId || user?.id || null),
          categoryScopes: userForm.role === 'admin' || userForm.userType === 'independent' ? [] : userForm.categoryScopes,
          permissions: userForm.role === 'admin' ? ADMIN_PERMISSIONS : userForm.permissions,
        };

        if (userForm.password.trim()) {
          updateData.password = userForm.password;
        }

        await adminApi.updateUser(editingUser.id, updateData);
        toast.success('用户信息已更新');
      }

      closeUserModal();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '保存失败');
    }
  };

  const getPermissionSummary = (targetUser: User) => {
    if (targetUser.role === 'admin') {
      return ['全部权限'];
    }

    return PERMISSION_GROUPS.map((group) => {
      const enabledCount = group.keys.filter((key) => targetUser.permissions?.[key]).length;
      return enabledCount > 0 ? `${group.title} ${enabledCount}项` : null;
    }).filter(Boolean) as string[];
  };

  return (
    <div className="space-y-6">
      {canManageSystem ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="p-2 bg-gradient-to-br from-rose-500 to-pink-600 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">系统设置</h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-pink-100 rounded-lg">
                  <UserCog size={20} className="text-pink-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">允许用户注册</p>
                  <p className="text-sm text-gray-500">关闭后登录页面将不显示注册链接</p>
                </div>
              </div>
              <button
                onClick={handleToggleRegister}
                disabled={updating}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  allowRegister ? 'bg-gradient-to-r from-rose-500 to-pink-600' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${allowRegister ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Play size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">清空学习相关信息</p>
                  <p className="text-sm text-gray-500">清除当前账号的背题/答题进度、已查看次数、收藏标记和最近学习记录。</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetLearningProgress}
                disabled={resetLearningBusy}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {resetLearningBusy ? '清空中...' : '一键清空'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canBackupRestore ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">备份与恢复</h2>
          </div>
          <div className="p-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-medium text-gray-900">导出完整备份</p>
              <p className="mt-1 text-sm text-gray-500">导出用户、分类、题目、学习记录、AI 配置和系统设置。</p>
              <button
                data-testid="backup-export-button"
                onClick={handleExportBackup}
                disabled={backupBusy}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={16} />
                {backupBusy ? '处理中...' : '导出备份'}
              </button>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="font-medium text-gray-900">恢复备份</p>
              <p className="mt-1 text-sm text-gray-500">上传备份 JSON 文件后会覆盖当前系统数据，请谨慎操作。</p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">
                <Upload size={16} />
                <span>{backupBusy ? '处理中...' : '选择备份文件'}</span>
                <input
                  data-testid="backup-restore-input"
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  disabled={backupBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    handleRestoreBackup(file);
                    e.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {canManageUsers ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">用户管理</h2>
            <span className="ml-auto text-sm text-gray-500">共 {users.length} 个用户</span>
            <button
              onClick={openCreateUserModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all"
            >
              <Plus size={16} />
              创建用户
            </button>
          </div>

          {loading ? (
            <div className="p-6 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center">
              <div className="p-4 bg-blue-50 rounded-2xl inline-flex mb-4">
                <Users size={32} className="text-blue-400" />
              </div>
              <p className="text-gray-600">暂无用户</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">题库模式</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">权限</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className={`select-field px-3 pr-8 py-1 text-sm font-medium border-0 cursor-pointer ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          <option value="user">普通用户</option>
                          <option value="admin">管理员</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {u.role === 'admin' ? (
                          <span className="inline-flex rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">系统管理员</span>
                        ) : u.user_type === 'independent' ? (
                          <span className="inline-flex rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">独立题库</span>
                        ) : (
                          <span className="inline-flex rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">集成题库</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {getPermissionSummary(u).map((summary) => (
                            <span
                              key={summary}
                              className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}
                            >
                              {summary}
                            </span>
                          ))}
                          {u.role !== 'admin' && getPermissionSummary(u).length === 0 ? (
                            <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">未授权</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditUserModal(u)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑用户"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除用户"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {userModalMode ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-transparent" onClick={closeUserModal} />
          <div className="relative flex min-h-full items-center justify-center px-4 py-6">
            <div className="app-modal-panel w-full max-w-2xl overflow-hidden max-h-[92vh]">
              <div className="app-modal-header flex items-center justify-between px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {userModalMode === 'create' ? '创建用户' : `编辑用户：${editingUser?.username}`}
                </h2>
                <button onClick={closeUserModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-72px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                    <input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {userModalMode === 'create' ? '初始密码' : '新密码（留空则不修改）'}
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder={userModalMode === 'create' ? '请输入初始密码' : '输入后将重置密码'}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">密码需超过9位，且包含字母和数字</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">角色</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => handleModalRoleChange(e.target.value as 'admin' | 'user')}
                      className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-700 focus:bg-white cursor-pointer"
                    >
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                </div>

                {userForm.role === 'user' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">用户模式</label>
                      <select
                        value={userForm.userType}
                        onChange={(e) => setUserForm((prev) => ({
                          ...prev,
                          userType: e.target.value as 'independent' | 'integrated',
                          libraryOwnerId: e.target.value === 'integrated' ? (prev.libraryOwnerId || user?.id || '') : '',
                          categoryScopes: e.target.value === 'integrated' ? prev.categoryScopes : [],
                        }))}
                        className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-700 focus:bg-white cursor-pointer"
                      >
                        <option value="independent">独立题库用户</option>
                        <option value="integrated">集成题库用户</option>
                      </select>
                    </div>
                    {userForm.userType === 'integrated' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">接入题库来源</label>
                        <select
                          value={userForm.libraryOwnerId || user?.id || ''}
                          onChange={(e) => setUserForm((prev) => ({ ...prev, libraryOwnerId: e.target.value, categoryScopes: [] }))}
                          className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-700 focus:bg-white cursor-pointer"
                        >
                          {[user, ...users.filter((item) => item.id !== user?.id && item.user_type === 'independent')].filter(Boolean).map((ownerCandidate) => (
                            <option key={ownerCandidate!.id} value={ownerCandidate!.id}>
                              {ownerCandidate!.username}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {userForm.role === 'user' && userForm.userType === 'integrated' ? (
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <div className="mb-3">
                      <p className="font-medium text-gray-900">分类范围授权</p>
                      <p className="text-sm text-gray-500">不选表示可访问接入题库下的全部分类；选中后仅可访问这些分类。</p>
                    </div>
                    {assignableCategories.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                        当前接入题库下暂无可授权分类，不选则默认可访问全部分类。
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {assignableCategories.map((category) => {
                          const checked = userForm.categoryScopes.includes(category.id);
                          return (
                            <label key={category.id} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${checked ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-200 bg-gray-50'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setUserForm((prev) => ({
                                  ...prev,
                                  categoryScopes: e.target.checked
                                    ? [...prev.categoryScopes, category.id]
                                    : prev.categoryScopes.filter((id) => id !== category.id),
                                }))}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span>
                                <span className="block text-sm font-medium text-gray-900">{category.name}</span>
                                {category.description ? <span className="mt-1 block text-xs text-gray-500">{category.description}</span> : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium text-gray-900">权限配置</p>
                      <p className="text-sm text-gray-500">管理员默认拥有全部权限；普通用户默认全部不选，请按模块勾选。</p>
                    </div>
                    {userForm.role === 'admin' ? (
                      <span className="inline-flex px-3 py-1 rounded-lg text-sm font-medium bg-purple-100 text-purple-700">全部权限</span>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.title} className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                        <div className="mb-3">
                          <p className="font-medium text-gray-900">{group.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.keys.map((key) => {
                            const permission = PERMISSION_OPTIONS.find((item) => item.key === key)!;
                            return (
                              <label key={permission.key} className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${userForm.permissions[permission.key] ? 'border-blue-200 bg-blue-50/60' : 'border-gray-200 bg-white'} ${userForm.role === 'admin' ? 'opacity-60' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={userForm.role === 'admin' ? true : userForm.permissions[permission.key]}
                                  disabled={userForm.role === 'admin'}
                                  onChange={(e) => handlePermissionChange(permission.key, e.target.checked)}
                                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span>
                                  <span className="block text-sm font-medium text-gray-900">{permission.label}</span>
                                  <span className="block text-xs text-gray-500 mt-1">{permission.description}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeUserModal}
                    className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUser}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white hover:from-blue-600 hover:to-indigo-700 transition-all"
                  >
                    {userModalMode === 'create' ? '创建用户' : '保存修改'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
