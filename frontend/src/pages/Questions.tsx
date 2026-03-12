import React, { useState, useEffect } from 'react';
import { questionApi, categoryApi, importApi, aiApi } from '@/api';
import { Question, Category, PaginatedResult, SimilarQuestionPair } from '@/types';
import { useAuthStore } from '@/store';
import { hasPermission } from '@/lib/permissions';
import { getTagColorClasses } from '@/lib/tagColors';
import { MAX_QUESTION_TAGS, parseQuestionTags } from '@/lib/questionTags';
import { renderMultilineText } from '@/lib/renderMarkdown';
import { applyTagSuggestion, getFilteredTagSuggestions } from '@/lib/tagSuggestions';
import { LoadingSpinner } from '@/components/ui';
import { toast } from 'react-hot-toast';
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Search,
  Filter,
  BookOpen,
  X,
  Check,
  Sparkles,
  Tags,
} from 'lucide-react';

const AI_IMPORT_PROMPT_TEMPLATE = `请按 JSON 返回一组适合记忆背题的题目，不要输出任何解释性文字。

要求：
1. 返回格式必须是 JSON 数组
2. 每一项包含 title、content、answer、explanation、difficulty、tags
3. difficulty 只能是 easy、medium、hard
4. answer 要准确、简洁、利于记忆
5. explanation 用于背题时快速理解
6. tags 为可选字段，如有标签，每题最多 5 个

示例：
[
  {
    "title": "HTTP 常见状态码",
    "content": "说出 200、301、404、500 的含义。",
    "answer": "200 成功；301 永久重定向；404 资源不存在；500 服务器内部错误。",
    "explanation": "这几个状态码是 Web 开发最常见的排障基础。",
    "difficulty": "easy",
    "tags": ["HTTP", "状态码"]
  },
  {
    "title": "什么是 Docker 镜像",
    "content": "说明 Docker 镜像的含义。",
    "answer": "Docker 镜像是用于创建容器的只读模板。",
    "explanation": "题目没有标签也可以正常导入。",
    "difficulty": "easy"
  }
]`;

export const QuestionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const canManageQuestions = hasPermission(user, 'question_view');
  const canImportQuestions = hasPermission(user, 'import_manage');
  const canUseAI = hasPermission(user, 'ai_use');
  const canManageTags = hasPermission(user, 'tag_manage');
  const canCheckDuplicates = hasPermission(user, 'duplicate_manage');
  const canAIPolish = canUseAI && hasPermission(user, 'ai_polish');
  const [questions, setQuestions] = useState<PaginatedResult<Question> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({
    categoryId: '',
    difficulty: '',
    keyword: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<Array<{ name: string; count: number }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showBatchTagsModal, setShowBatchTagsModal] = useState(false);
  const [batchTagsMode, setBatchTagsMode] = useState<'add' | 'remove' | 'replace'>('add');
  const [showPolishModal, setShowPolishModal] = useState(false);
  const [polishQuestion, setPolishQuestion] = useState<Question | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<Array<{ title: string; count: number; questions: Question[] }>>([]);
  const [similarDuplicates, setSimilarDuplicates] = useState<SimilarQuestionPair[]>([]);
  const [pageSize, setPageSize] = useState(50);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await questionApi.getAll({
        page,
        pageSize,
        ...filter,
      });
      setQuestions(response.data);
    } catch (error) {
      toast.error('获取题目列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await questionApi.getTags({
        categoryId: filter.categoryId || undefined,
        difficulty: filter.difficulty || undefined,
        keyword: filter.keyword || undefined,
      });
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getAll();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const checkDuplicates = async () => {
    try {
      const response = await questionApi.getAll({ page: 1, pageSize: 1000 });
      const allQuestions = response.data.data;
      const similarResponse = await questionApi.getSimilarDuplicates();
      
      const titleMap = new Map<string, Question[]>();
      allQuestions.forEach((q) => {
        const normalizedTitle = q.title.trim().toLowerCase();
        if (!titleMap.has(normalizedTitle)) {
          titleMap.set(normalizedTitle, []);
        }
        titleMap.get(normalizedTitle)!.push(q);
      });

      const duplicateList: Array<{ title: string; count: number; questions: Question[] }> = [];
      titleMap.forEach((questionsList) => {
        if (questionsList.length > 1) {
          duplicateList.push({
            title: questionsList[0].title,
            count: questionsList.length,
            questions: questionsList,
          });
        }
      });

      setDuplicates(duplicateList);
      setSimilarDuplicates(similarResponse.data.pairs);
      setShowDuplicateModal(true);
    } catch (error) {
      toast.error('检查重复题目失败');
    }
  };

  const deleteDuplicate = async (_keepId: string, deleteIds: string[]) => {
    try {
      await questionApi.batchDelete(deleteIds);
      toast.success(`已删除 ${deleteIds.length} 道重复题目`);
      fetchQuestions();
      checkDuplicates();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [page, filter, pageSize]);

  useEffect(() => {
    fetchTags();
  }, [filter.categoryId, filter.difficulty, filter.keyword]);

  const addFilterTag = (value: string) => {
    const nextTag = value.trim();
    if (!nextTag || filter.tags.includes(nextTag)) {
      setTagInput('');
      return;
    }
    setPage(1);
    setFilter((prev) => ({ ...prev, tags: [...prev.tags, nextTag] }));
    setTagInput('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这道题目吗？')) return;

    try {
      await questionApi.delete(id);
      toast.success('删除成功');
      fetchQuestions();
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('请选择要删除的题目');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.length} 道题目吗？`)) return;

    try {
      await questionApi.batchDelete(selectedIds);
      toast.success('批量删除成功');
      setSelectedIds([]);
      fetchQuestions();
    } catch (error) {
      toast.error('批量删除失败');
    }
  };

  const openBatchTagsModal = (mode: 'add' | 'remove' | 'replace') => {
    if (selectedIds.length === 0) {
      toast.error('请先选择题目');
      return;
    }
    setBatchTagsMode(mode);
    setShowBatchTagsModal(true);
  };

  const openPolishModal = (question: Question) => {
    setPolishQuestion(question);
    setShowPolishModal(true);
  };

  const handleMergeDuplicate = async (keepId: string, removeId: string) => {
    if (!confirm('确定保留当前题，并把另一题的标签/分类/解析合并后删除另一题吗？')) {
      return;
    }

    try {
      await questionApi.mergeDuplicate(keepId, removeId);
      toast.success('已合并重复题');
      fetchQuestions();
      checkDuplicates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '合并重复题失败');
    }
  };

  const handleClearAll = async () => {
    const total = questions?.total || 0;
    if (total === 0) {
      toast.error('题库为空');
      return;
    }

    if (!confirm(`确定要清空所有 ${total} 道题目吗？此操作不可恢复！`)) return;

    try {
      const result = await questionApi.clearAll();
      toast.success(result.data.message);
      setSelectedIds([]);
      fetchQuestions();
    } catch (error) {
      toast.error('清空题库失败');
    }
  };

  const handleExport = async () => {
    try {
      const result = await questionApi.export(filter.categoryId);
      const exportData = result.data.questions;
      
      const markdown = exportData.map((q: any) => {
        let text = `**${q.title}**\n`;
        if (q.content && q.content !== q.title) {
          text += `${q.content}\n`;
        }
        text += `答案：${q.answer}\n`;
        if (q.explanation) {
          text += `解析：${q.explanation}\n`;
        }
        return text;
      }).join('\n');

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `题库导出_${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success(`已导出 ${result.data.total} 道题目`);
    } catch (error) {
      toast.error('导出失败');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === questions?.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions?.data.map((q) => q.id) || []);
    }
  };

  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getDifficultyConfig = (difficulty: string) => {
    const configs: Record<string, { label: string; bg: string; text: string; border: string }> = {
      easy: { label: '简单', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      medium: { label: '中等', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      hard: { label: '困难', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    };
    return configs[difficulty] || configs.medium;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '未分类';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || '未知分类';
  };

  if (!canManageQuestions) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <div className="mb-4 inline-flex rounded-2xl bg-gray-50 p-4">
          <BookOpen size={32} className="text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-900">暂无题库管理权限</p>
        <p className="mt-2 text-sm text-gray-500">请联系管理员为当前账户分配题目管理权限。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 p-3 shadow-lg shadow-purple-500/20">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">题库管理</h1>
            <p className="text-sm text-gray-500">管理题目、导入内容和标签筛选。</p>
          </div>
        </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {canCheckDuplicates ? (
              <button
                onClick={checkDuplicates}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <AlertTriangle size={18} className="text-amber-500" />
                检查重复
              </button>
            ) : null}
            {canUseAI ? (
              <button
                onClick={() => setShowAIGenerateModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Sparkles size={18} className="text-violet-500" />
                AI 生题
              </button>
            ) : null}
            {canImportQuestions ? (
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Upload size={18} className="text-blue-500" />
                导入题目
              </button>
            ) : null}
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Download size={18} className="text-emerald-500" />
              导出
            </button>
            <button
              onClick={handleClearAll}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 transition-colors hover:bg-red-100"
            >
              <Trash2 size={18} className="text-red-500" />
              清空题库
            </button>
            <button
              onClick={() => { setEditingQuestion(null); setShowModal(true); }}
              data-testid="question-add-button"
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm text-white transition-all hover:from-violet-600 hover:to-purple-700 sm:col-span-1"
            >
              <Plus size={18} />
              添加题目
            </button>
          </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto]">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                data-testid="question-search-input"
                type="text"
                className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                placeholder="搜索题目内容、答案、解析..."
                value={filter.keyword}
                onChange={(e) => {
                  setPage(1);
                  setFilter({ ...filter, keyword: e.target.value });
                }}
              />
            </div>
            <div className="relative">
              <Tags className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
                    e.preventDefault();
                    addFilterTag(tagInput);
                  }
                }}
                onBlur={() => {
                  if (tagInput.trim()) {
                    addFilterTag(tagInput);
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all"
                placeholder="标签筛选"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={filter.categoryId}
                onChange={(e) => {
                  setPage(1);
                  setFilter({ ...filter, categoryId: e.target.value });
                }}
                className="select-field min-w-0 w-full pl-9 pr-10 py-3 cursor-pointer"
              >
                <option value="">全部分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <select
              value={filter.difficulty}
              onChange={(e) => {
                setPage(1);
                setFilter({ ...filter, difficulty: e.target.value });
              }}
              className="select-field min-w-0 w-full px-4 pr-10 py-3 cursor-pointer"
            >
              <option value="">全部难度</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
            {filter.tags.length > 0 ? (
              <button
                onClick={() => {
                  setPage(1);
                  setFilter((prev) => ({ ...prev, tags: [] }));
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-600 transition-all hover:bg-gray-50"
              >
                清空标签
              </button>
            ) : null}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-violet-50 border-b border-purple-100 flex items-center justify-between">
            <span className="text-sm text-purple-700 font-medium">
              已选择 <span className="font-bold">{selectedIds.length}</span> 道题目
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canManageTags ? (
                <>
                  <button
                    onClick={() => openBatchTagsModal('add')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Tags size={14} />
                    批量加标签
                  </button>
                  <button
                    onClick={() => openBatchTagsModal('remove')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Tags size={14} />
                    批量删标签
                  </button>
                  <button
                    onClick={() => openBatchTagsModal('replace')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <Tags size={14} />
                    批量替换标签
                  </button>
                </>
              ) : null}
              <button
                onClick={handleBatchDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors"
              >
                <Trash2 size={14} />
                批量删除
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : questions?.data.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-500">
            <div className="mb-4 rounded-2xl bg-gray-50 p-4">
              <BookOpen size={32} className="text-gray-400" />
            </div>
            <p className="mb-1 text-lg font-medium text-gray-700">暂无题目</p>
            <p className="mb-4 text-sm text-gray-500">点击上方按钮添加或导入题目</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl text-white hover:from-violet-600 hover:to-purple-700 transition-all"
            >
              <Plus size={18} />
              添加题目
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {questions?.data.map((question) => {
                const diffConfig = getDifficultyConfig(question.difficulty);
                const selected = selectedIds.includes(question.id);
                return (
                  <div key={question.id} className={`rounded-2xl border p-4 shadow-sm transition-all ${selected ? 'border-purple-300 bg-purple-50/40' : 'border-gray-100 bg-white'}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => handleSelect(question.id)}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selected ? 'bg-purple-500 border-purple-500 text-white' : 'border-gray-300'
                        }`}
                      >
                        {selected && <Check size={14} />}
                      </button>
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${diffConfig.bg} ${diffConfig.text} ${diffConfig.border}`}>
                            {diffConfig.label}
                          </span>
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            {getCategoryName(question.category_id)}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-gray-900">
                          {question.content.substring(0, 180)}
                          {question.content.length > 180 && '...'}
                        </p>
                        {parseQuestionTags(question.tags).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {parseQuestionTags(question.tags).map((tag) => (
                              <span
                                key={`${question.id}-${tag}`}
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${getTagColorClasses(tag)}`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          {canAIPolish ? (
                            <button
                              onClick={() => openPolishModal(question)}
                              data-testid={`question-polish-${question.id}`}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700"
                            >
                              <Sparkles size={16} />
                              AI润色
                            </button>
                          ) : null}
                          <button
                            onClick={() => {
                              setEditingQuestion(question);
                              setShowModal(true);
                            }}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700"
                          >
                            <Edit size={16} />
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600"
                          >
                            <Trash2 size={16} />
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="text-left py-4 px-4 w-12">
                      <button
                        onClick={handleSelectAll}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.length === questions?.data.length
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : 'border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {selectedIds.length === questions?.data.length && <Check size={14} />}
                      </button>
                    </th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      题目内容
                    </th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                      分类
                    </th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                      难度
                    </th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {questions?.data.map((question) => {
                    const diffConfig = getDifficultyConfig(question.difficulty);
                    return (
                      <tr key={question.id} className="transition-colors hover:bg-gray-50/50">
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleSelect(question.id)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              selectedIds.includes(question.id)
                                ? 'bg-purple-500 border-purple-500 text-white'
                                : 'border-gray-300 hover:border-purple-400'
                            }`}
                          >
                            {selectedIds.includes(question.id) && <Check size={14} />}
                          </button>
                        </td>
                        <td className="py-4 px-4">
                          <div className="max-w-lg space-y-2">
                            <p className="text-gray-900 font-medium line-clamp-2">
                              {question.content.substring(0, 150)}
                              {question.content.length > 150 && '...'}
                            </p>
                            {parseQuestionTags(question.tags).length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {parseQuestionTags(question.tags).map((tag) => (
                                  <span
                                    key={`${question.id}-${tag}`}
                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${getTagColorClasses(tag)}`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">{getCategoryName(question.category_id)}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${diffConfig.bg} ${diffConfig.text} ${diffConfig.border}`}>
                            {diffConfig.label}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            {canAIPolish ? (
                              <button
                                onClick={() => openPolishModal(question)}
                                data-testid={`question-polish-${question.id}`}
                                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="AI润色"
                              >
                                <Sparkles size={16} />
                              </button>
                            ) : null}
                            <button
                              onClick={() => {
                                setEditingQuestion(question);
                                setShowModal(true);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(question.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="text-sm text-gray-600">
                  共 <span className="font-semibold text-gray-900">{questions?.total}</span> 道题目
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">每页</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="select-field px-3 pr-9 py-1.5 text-gray-700 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-sm text-gray-500">条</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-2 text-sm text-gray-700 bg-white rounded-lg border border-gray-200">
                  {page} / {questions?.totalPages || 1}
                </span>
                <button
                  disabled={page === questions?.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <QuestionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        question={editingQuestion}
        categories={categories}
        availableTags={availableTags}
        onSuccess={() => {
          setShowModal(false);
          fetchQuestions();
        }}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        categories={categories}
        onSuccess={() => {
          setShowImportModal(false);
          fetchQuestions();
        }}
      />

      <AIGenerateModal
        isOpen={showAIGenerateModal}
        onClose={() => setShowAIGenerateModal(false)}
        categories={categories}
        onSuccess={fetchQuestions}
      />

      <DuplicateModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        duplicates={duplicates}
        similarPairs={similarDuplicates}
        onDeleteDuplicate={deleteDuplicate}
        onMergeDuplicate={handleMergeDuplicate}
      />

      <BatchTagsModal
        isOpen={showBatchTagsModal}
        mode={batchTagsMode}
        selectedCount={selectedIds.length}
        availableTags={availableTags}
        onClose={() => setShowBatchTagsModal(false)}
        onSubmit={async (tags) => {
          const response = await questionApi.batchTags({ ids: selectedIds, mode: batchTagsMode, tags });
          toast.success(response.data.message);
          setShowBatchTagsModal(false);
          fetchQuestions();
        }}
      />

      <AIPolishModal
        isOpen={showPolishModal}
        question={polishQuestion}
        onClose={() => {
          setShowPolishModal(false);
          setPolishQuestion(null);
        }}
        onSaved={() => {
          setShowPolishModal(false);
          setPolishQuestion(null);
          fetchQuestions();
        }}
      />
    </div>
  );
};

interface QuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: Question | null;
  categories: Category[];
  availableTags: Array<{ name: string; count: number }>;
  onSuccess: () => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({
  isOpen,
  onClose,
  question,
  categories,
  availableTags,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    content: '',
    answer: '',
    explanation: '',
    difficulty: 'medium',
    categoryId: '',
    tags: '',
  });

  useEffect(() => {
    if (question) {
      setFormData({
        content: question.content,
        answer: question.answer,
        explanation: question.explanation || '',
        difficulty: question.difficulty,
        categoryId: question.category_id || '',
        tags: parseQuestionTags(question.tags).join(', '),
      });
    } else {
      setFormData({
        content: '',
        answer: '',
        explanation: '',
        difficulty: 'medium',
        categoryId: '',
        tags: '',
      });
    }
  }, [question]);

  const matchedTags = getFilteredTagSuggestions(formData.tags, availableTags);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        title: formData.content.substring(0, 100),
        content: formData.content,
        answer: formData.answer,
        explanation: formData.explanation || undefined,
        difficulty: formData.difficulty,
        categoryId: formData.categoryId || undefined,
        tags: parseQuestionTags(formData.tags),
      };

      if (question) {
        await questionApi.update(question.id, data);
        toast.success('更新成功');
      } else {
        await questionApi.create(data);
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
      <div data-testid="question-modal" className="app-modal-panel w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{question ? '编辑题目' : '添加题目'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">题目内容（支持Markdown格式）</label>
            <textarea
              data-testid="question-content-input"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all font-mono text-sm"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              required
              placeholder="支持Markdown格式，如：**粗体**、`代码`、列表等"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">答案（支持Markdown格式）</label>
            <textarea
              data-testid="question-answer-input"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all font-mono text-sm"
              value={formData.answer}
              onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
              rows={6}
              required
              placeholder="支持Markdown格式"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">解析（可选）</label>
            <textarea
              data-testid="question-explanation-input"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all font-mono text-sm"
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">难度</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="select-field w-full px-4 pr-10 py-3 text-gray-700 bg-gray-50 focus:bg-white cursor-pointer"
              >
                <option value="easy">简单</option>
                <option value="medium">中等</option>
                <option value="hard">困难</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="select-field w-full px-4 pr-10 py-3 text-gray-700 bg-gray-50 focus:bg-white cursor-pointer"
              >
                <option value="">请选择分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">标签</label>
            <input
              data-testid="question-tags-input"
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="多个标签用逗号分隔，最多 5 个，例如：HTTP, 状态码, 基础"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all"
            />
            {matchedTags.length > 0 ? (
              <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                <div className="flex flex-wrap gap-2">
                  {matchedTags.map((tag) => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, tags: applyTagSuggestion(prev.tags, tag.name) }))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <span>{tag.name}</span>
                      <span className="text-[11px] text-gray-400">{tag.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
          >
            取消
          </button>
          <button
            data-testid="question-save-button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl text-white hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '保存中...' : question ? '更新' : '创建'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, categories, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [importType, setImportType] = useState<'csv' | 'json' | 'markdown' | 'ai'>('markdown');
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [aiText, setAiText] = useState('');
  const [result, setResult] = useState<{ success: number; failed: number; errors: any[] } | null>(null);

  const csvExample = `内容,答案,难度,解析,标签
什么是HTTP协议?,HTTP是HyperText Transfer Protocol的缩写，即超文本传输协议。,medium,HTTP协议定义了客户端和服务器之间的通信规则,"HTTP,协议"`;

  const jsonExample = `[
  {
    "content": "什么是Docker?",
    "answer": "Docker是一个开源的应用容器引擎。",
    "difficulty": "easy",
    "tags": ["docker", "容器"]
  },
  {
    "content": "什么是容器编排?",
    "answer": "容器编排是对多个容器进行自动化部署、调度和管理。",
    "difficulty": "medium"
  }
]`;

  const markdownExample = `**什么是Kubernetes?**
答案：Kubernetes是一个开源的容器编排平台。
标签：kubernetes, 容器

**Docker和K8s的区别是什么？**
答案：Docker是容器运行时，K8s是容器编排平台。
标签：docker, kubernetes`;

  const downloadExample = () => {
    let content = '';
    let filename = '';
    
    if (importType === 'csv') {
      content = csvExample;
      filename = '题目导入样例.csv';
    } else if (importType === 'json') {
      content = jsonExample;
      filename = '题目导入样例.json';
    } else if (importType === 'markdown') {
      content = markdownExample;
      filename = '题目导入样例.md';
    } else {
      content = AI_IMPORT_PROMPT_TEMPLATE;
      filename = 'AI生题提示词.txt';
    }
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (importType !== 'ai' && !file) {
      toast.error('请选择文件');
      return;
    }

    if (importType === 'ai' && !aiText.trim()) {
      toast.error('请粘贴AI生成的JSON内容');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let response;
      if (importType === 'csv') {
        response = await importApi.importCsv(file!, categoryId);
      } else if (importType === 'json') {
        response = await importApi.importJson(file!, categoryId);
      } else if (importType === 'markdown') {
        response = await importApi.importMarkdown(file!, categoryId);
      } else {
        const parsed = JSON.parse(aiText);
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error('AI内容不是可导入的题目数组');
        }
        response = await importApi.importText(
          questions.map((q: any) => ({
            title: q.title || q.content?.slice(0, 100) || '未命名题目',
            content: q.content,
            answer: q.answer,
            explanation: q.explanation || '',
            difficulty: q.difficulty || 'medium',
            tags: Array.isArray(q.tags) ? q.tags : [],
          })),
          categoryId || undefined
        );
      }

      setResult(response.data);
      toast.success(`成功导入 ${response.data.success} 道题目`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (result?.success) {
      onSuccess();
    }
    setResult(null);
    setFile(null);
    setAiText('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={handleClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
      <div className="app-modal-panel w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">导入题目</h2>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
        <div className="flex gap-2">
          {(['csv', 'json', 'markdown', 'ai'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setImportType(type)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  importType === type
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'csv' ? 'CSV格式' : type === 'json' ? 'JSON格式' : type === 'markdown' ? 'Markdown格式' : 'AI粘贴导入'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">导入到分类（可选）</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="select-field w-full px-4 pr-10 py-3 text-gray-700 bg-gray-50 focus:bg-white cursor-pointer"
            >
              <option value="">不指定分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {importType === 'ai' ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-gray-900">AI 生成后直接粘贴 JSON</p>
                    <p className="text-sm text-gray-600">适合先让 ChatGPT / DeepSeek / 豆包批量生成，再一键导入题库。</p>
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(AI_IMPORT_PROMPT_TEMPLATE);
                      toast.success('AI提示词已复制');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    <Sparkles size={16} />
                    复制提示词
                  </button>
                </div>
              </div>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={10}
                placeholder="把 AI 返回的 JSON 数组粘贴到这里"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all font-mono text-sm"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors">
              <input
                type="file"
                accept={importType === 'csv' ? '.csv' : importType === 'json' ? '.json' : '.md,.markdown,.txt'}
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="p-3 bg-gray-100 rounded-lg inline-flex mb-3">
                  <Upload className="h-6 w-6 text-gray-600" />
                </div>
                <p className="text-gray-700 font-medium">{file ? file.name : '点击上传文件'}</p>
                <p className="text-sm text-gray-400 mt-1">支持 {importType.toUpperCase()} 格式</p>
              </label>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-gray-800">文件格式样例</p>
              <button onClick={downloadExample} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Download size={14} />
                下载样例
              </button>
            </div>
            <pre className="text-xs text-gray-700 bg-white p-3 rounded-lg overflow-x-auto max-h-32 whitespace-pre-wrap border border-gray-200">
              {importType === 'csv' ? csvExample : importType === 'json' ? jsonExample : importType === 'markdown' ? markdownExample : AI_IMPORT_PROMPT_TEMPLATE}
            </pre>
          </div>

          {result && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-700 font-medium">成功导入：{result.success} 道</p>
              {result.failed > 0 && <p className="text-red-600 text-sm mt-1">失败：{result.failed} 道</p>}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={handleClose}
            className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
          <button
            onClick={handleImport}
            disabled={loading || (importType === 'ai' ? !aiText.trim() : !file)}
            className="px-5 py-2.5 bg-primary-600 rounded-lg text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

interface DuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: Array<{ title: string; count: number; questions: Question[] }>;
  similarPairs: SimilarQuestionPair[];
  onDeleteDuplicate: (keepId: string, deleteIds: string[]) => void;
  onMergeDuplicate: (keepId: string, removeId: string) => void;
}

const DuplicateModal: React.FC<DuplicateModalProps> = ({ isOpen, onClose, duplicates, similarPairs, onDeleteDuplicate, onMergeDuplicate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
      <div className="app-modal-panel w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">重复题目检查</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {duplicates.length === 0 && similarPairs.length === 0 ? (
            <div className="text-center py-12">
              <div className="p-3 bg-green-100 rounded-lg inline-flex mb-3">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-600">没有发现重复或相似题目</p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicates.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    发现 <span className="font-semibold text-amber-600">{duplicates.length}</span> 组完全重复题目，请选择要保留的题目：
                  </p>
                  {duplicates.map((dup, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 truncate flex-1">{dup.title}</h4>
                        <span className="ml-2 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                          {dup.count} 道重复
                        </span>
                      </div>
                      <div className="space-y-2">
                        {dup.questions.map((q) => (
                          <div key={q.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                            <div className="text-sm text-gray-500">
                              创建时间：{new Date(q.created_at).toLocaleString()}
                            </div>
                            <button
                              onClick={() => {
                                const deleteIds = dup.questions.filter(p => p.id !== q.id).map(p => p.id);
                                onDeleteDuplicate(q.id, deleteIds);
                              }}
                              className="px-3 py-1.5 bg-white border border-gray-200 text-primary-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                            >
                              保留此题
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {similarPairs.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    发现 <span className="font-semibold text-amber-600">{similarPairs.length}</span> 组相似题目，可手动判断是否删除其中一题：
                  </p>
                  {similarPairs.map((pair, index) => (
                    <div key={`${pair.left.id}-${pair.right.id}-${index}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 border border-amber-200">
                          综合相似度 {(pair.score * 100).toFixed(0)}%
                        </span>
                        <span>标题 {(pair.titleScore * 100).toFixed(0)}%</span>
                        <span>内容 {(pair.contentScore * 100).toFixed(0)}%</span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {[pair.left, pair.right].map((item, itemIndex) => (
                          <div key={item.id} className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                            <div className="mb-2 text-sm font-medium text-gray-900 line-clamp-2">{item.title}</div>
                            <div className="text-sm text-gray-600 line-clamp-4">{item.content}</div>
                            <div className="mt-3 flex justify-end">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => onDeleteDuplicate(itemIndex === 0 ? pair.right.id : pair.left.id, [item.id])}
                                  className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
                                >
                                  删除这题
                                </button>
                                <button
                                  onClick={() => onMergeDuplicate(item.id, itemIndex === 0 ? pair.right.id : pair.left.id)}
                                  className="px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg text-sm hover:bg-blue-50 transition-colors"
                                >
                                  保留并合并
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

interface BatchTagsModalProps {
  isOpen: boolean;
  mode: 'add' | 'remove' | 'replace';
  selectedCount: number;
  availableTags: Array<{ name: string; count: number }>;
  onClose: () => void;
  onSubmit: (tags: string[]) => Promise<void>;
}

const BatchTagsModal: React.FC<BatchTagsModalProps> = ({ isOpen, mode, selectedCount, availableTags, onClose, onSubmit }) => {
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTagsInput('');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const title = mode === 'add' ? '批量添加标签' : mode === 'remove' ? '批量移除标签' : '批量替换标签';
  const helperText = mode === 'add'
    ? '会把这些标签追加到已选题目上'
    : mode === 'remove'
      ? '会从已选题目中移除这些标签'
      : '会用这些标签替换已选题目的原有标签';
  const matchedTags = getFilteredTagSuggestions(tagsInput, availableTags);

  const handleSubmit = async () => {
    const tags = parseQuestionTags(tagsInput);
    if (tags.length === 0) {
      toast.error('请输入有效标签');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(tags);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
        <div className="app-modal-panel w-full max-w-lg overflow-hidden">
          <div className="app-modal-header flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">已选 {selectedCount} 道题，{helperText}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">标签</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="多个标签用逗号分隔，最多 5 个"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 placeholder-gray-400 transition-all focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              {matchedTags.length > 0 ? (
                <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                  <div className="flex flex-wrap gap-2">
                    {matchedTags.map((tag) => (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => setTagsInput((current) => applyTagSuggestion(current, tag.name))}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                      >
                        <span>{tag.name}</span>
                        <span className="text-[11px] text-gray-400">{tag.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-gray-700 transition-all hover:bg-gray-50">
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '处理中...' : '确认'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AIPolishModalProps {
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
  onSaved: () => void;
}

const AIPolishModal: React.FC<AIPolishModalProps> = ({ isOpen, question, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<null | {
    title: string;
    content: string;
    answer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
  }>(null);

  useEffect(() => {
    if (!isOpen || !question) {
      setDraft(null);
      return;
    }

    let active = true;
    setLoading(true);
    aiApi.polishQuestion(question.id)
      .then((response) => {
        if (active) {
          setDraft(response.data.draft);
        }
      })
      .catch((error: any) => {
        toast.error(error.response?.data?.error || 'AI润色失败');
        onClose();
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [isOpen, question, onClose]);

  if (!isOpen || !question) return null;

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await questionApi.update(question.id, {
        title: draft.title,
        content: draft.content,
        answer: draft.answer,
        explanation: draft.explanation,
        difficulty: draft.difficulty,
        tags: draft.tags,
      });
      toast.success('AI 润色已保存');
      onSaved();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '保存润色结果失败');
    } finally {
      setSaving(false);
    }
  };

  const renderPreviewBlock = (title: string, value: string) => (
    <div>
      <div className="mb-2 text-sm font-medium text-gray-700">{title}</div>
      <div
        className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-gray-700 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMultilineText(value) }}
      />
    </div>
  );

  const renderDraftTextarea = (
    title: string,
    value: string,
    onChange: (nextValue: string) => void,
    rows: number
  ) => (
    <div>
      <div className="mb-2 text-sm font-medium text-gray-700">{title}</div>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
        <div data-testid="ai-polish-modal" className="app-modal-panel flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden">
          <div className="app-modal-header flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI 润色</h2>
              <p className="text-sm text-gray-500">先预览并编辑润色内容，再决定是否写回当前题目</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          {loading ? (
            <div className="flex h-80 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : draft ? (
            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-2">
              <div className="min-h-0 space-y-4 overflow-y-auto border-b border-gray-100 p-6 lg:border-b-0 lg:border-r">
                <h3 className="text-sm font-semibold text-gray-900">原题</h3>
                {renderPreviewBlock('题目内容', question.content)}
                {renderPreviewBlock('答案', question.answer)}
                {question.explanation ? renderPreviewBlock('解析', question.explanation) : null}
              </div>
              <div className="min-h-0 space-y-4 overflow-y-auto p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">润色</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">{draft.difficulty}</span>
                    {draft.tags.map((tag) => (
                      <span key={tag} className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${getTagColorClasses(tag)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {renderDraftTextarea('题目内容', draft.content, (content) => setDraft((current) => (current ? { ...current, content } : current)), 4)}
                {renderDraftTextarea('答案', draft.answer, (answer) => setDraft((current) => (current ? { ...current, answer } : current)), 6)}
                {renderDraftTextarea('解析', draft.explanation || '', (explanation) => setDraft((current) => (current ? { ...current, explanation } : current)), 8)}
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4">
            <button onClick={onClose} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-gray-700 transition-all hover:bg-gray-50">
              取消
            </button>
            <button
              data-testid="ai-polish-save-button"
              onClick={handleSave}
              disabled={!draft || loading || saving}
              className="rounded-xl bg-primary-600 px-5 py-2.5 text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? '保存中...' : '确认保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onSuccess: () => void;
}

type GeneratedQuestion = {
  title: string;
  content: string;
  answer: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
};

const aiGenerateModes = [
  {
    value: 'quick' as const,
    label: '速记版',
  },
  {
    value: 'practice' as const,
    label: '练习版',
  },
  {
    value: 'teaching' as const,
    label: '教学版',
  },
];

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({ isOpen, onClose, categories, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingIndex, setImportingIndex] = useState<number | null>(null);
  const [rawResult, setRawResult] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [formData, setFormData] = useState({
    topic: '',
    count: 10,
    difficulty: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
    mode: 'practice' as 'quick' | 'practice' | 'teaching',
    categoryId: '',
    requirements: '',
    provider: '',
  });

  const categoryName = categories.find((category) => category.id === formData.categoryId)?.name || '';

  const toImportPayload = (question: GeneratedQuestion) => ({
    title: question.title,
    content: question.content,
    answer: question.answer,
    explanation: question.explanation || '',
    difficulty: question.difficulty || 'medium',
    tags: (question.tags || []).slice(0, MAX_QUESTION_TAGS),
  });

  const handleGenerate = async () => {
    if (!formData.topic.trim()) {
      toast.error('请输入出题主题');
      return;
    }

    setLoading(true);
    setGeneratedQuestions([]);
    setRawResult('');
    try {
      const response = await aiApi.batchGenerate({
        topic: formData.topic,
        count: formData.count,
        difficulty: formData.difficulty,
        mode: formData.mode,
        requirements: formData.requirements || undefined,
        provider: formData.provider || undefined,
        categoryName: categoryName || undefined,
      });

      setGeneratedQuestions(response.data.questions);
      setRawResult(response.data.raw);
      toast.success(`已生成 ${response.data.questions.length} 道题目`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'AI生题失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImportGenerated = async () => {
    if (generatedQuestions.length === 0) {
      toast.error('没有可导入的题目');
      return;
    }

    setImporting(true);
    try {
      const response = await importApi.importText(
        generatedQuestions.map(toImportPayload),
        formData.categoryId || undefined
      );

      toast.success(`成功导入 ${response.data.success} 道题目`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleImportSingle = async (question: GeneratedQuestion, index: number) => {
    setImportingIndex(index);
    try {
      const response = await importApi.importText(
        [toImportPayload(question)],
        formData.categoryId || undefined
      );

      toast.success(`成功导入 ${response.data.success} 道题目`);
      setGeneratedQuestions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '导入失败');
    } finally {
      setImportingIndex(null);
    }
  };

  const handleClose = () => {
    setGeneratedQuestions([]);
    setRawResult('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={handleClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
      <div className="app-modal-panel w-full max-w-5xl h-[92vh] overflow-hidden">
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI 批量生题</h2>
              <p className="text-sm text-gray-500">直接在系统内生成、预览并导入题目</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)] h-[calc(92vh-76px)] min-h-0">
          <div className="border-b lg:border-b-0 lg:border-r border-gray-100 p-5 space-y-4 overflow-y-auto min-h-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">出题主题</label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="例如：Python 装饰器、考研政治马原、驾考交规"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">数量</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: Number(e.target.value) || 1 })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">难度</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as 'easy' | 'medium' | 'hard' | 'mixed' })}
                  className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-700 focus:bg-white cursor-pointer"
                >
                  <option value="mixed">混合难度</option>
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">生成模式</label>
              <div className="grid grid-cols-3 gap-2">
                {aiGenerateModes.map((modeOption) => {
                  const active = formData.mode === modeOption.value;
                  return (
                    <button
                      key={modeOption.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, mode: modeOption.value })}
                      className={`rounded-xl border px-3 py-3 text-left transition-all ${
                        active
                          ? 'border-primary-500 bg-primary-50 shadow-sm ring-2 ring-primary-500/10'
                          : 'border-gray-200 bg-white/90 hover:border-gray-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex min-h-[20px] items-center justify-center">
                        <span className={`text-sm font-medium ${active ? 'text-primary-700' : 'text-gray-900'}`}>
                          {modeOption.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">导入分类</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="select-field w-full px-4 pr-10 py-3 bg-gray-50 text-gray-700 focus:bg-white cursor-pointer"
              >
                <option value="">不指定分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">额外要求</label>
              <textarea
                rows={5}
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="例如：更偏选择题；覆盖高频考点；题干更短；适合初学者；补充易错点"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 rounded-lg text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <Sparkles size={18} />
                {loading ? '生成中...' : '开始生题'}
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                关闭
              </button>
            </div>

            {loading ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                AI 批量生题可能需要 1 到 3 分钟，请耐心等待，页面会在生成完成后自动展示结果。
              </div>
            ) : null}
          </div>

          <div className="p-5 overflow-y-auto bg-gray-50/40 min-h-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">生成预览</h3>
                <p className="text-sm text-gray-500">先检查题目质量，再决定是否导入。</p>
              </div>
              <button
                onClick={handleImportGenerated}
                disabled={importing || generatedQuestions.length === 0}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <Download size={16} />
                {importing ? '导入中...' : `导入 ${generatedQuestions.length || 0} 道题`}
              </button>
            </div>

            {generatedQuestions.length === 0 ? (
              <div className="h-full min-h-[320px] rounded-2xl border border-dashed border-gray-200 bg-white flex items-center justify-center p-8 text-center text-gray-500">
                输入主题后开始生题。建议一次生成 5 到 10 道，先看质量，再继续扩充题库。
              </div>
            ) : (
              <div className="space-y-3">
                {generatedQuestions.map((question, index) => (
                  <div key={`${question.title}-${index}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                          第 {index + 1} 题
                        </span>
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          {question.difficulty || 'medium'}
                        </span>
                        {(question.tags || []).slice(0, 4).map((tag) => (
                          <span key={tag} className="inline-flex px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => handleImportSingle(question, index)}
                        disabled={importing || importingIndex !== null}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-50 transition-all disabled:opacity-50"
                      >
                        <Download size={15} />
                        {importingIndex === index ? '导入中...' : '导入此题'}
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">题目</p>
                        <p className="text-sm leading-6 text-gray-900">{question.content}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">答案</p>
                        <p className="text-sm leading-6 text-emerald-700">{question.answer}</p>
                      </div>
                      {question.explanation ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">解析</p>
                          <p className="text-sm leading-6 text-gray-600">{question.explanation}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                <details className="rounded-2xl border border-gray-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">查看原始 AI 返回内容</summary>
                  <pre className="mt-3 text-xs text-gray-700 whitespace-pre-wrap overflow-x-auto">{rawResult}</pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
