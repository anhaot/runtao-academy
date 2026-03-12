import React, { useState, useEffect, useCallback } from 'react';
import { questionApi, categoryApi } from '@/api';
import { Question, Category, LearningProgress } from '@/types';
import { useAIStore, useAuthStore } from '@/store';
import { hasPermission } from '@/lib/permissions';
import { getTagColorClasses } from '@/lib/tagColors';
import { parseQuestionTags } from '@/lib/questionTags';
import { renderSafeMarkdown } from '@/lib/renderMarkdown';
import { applyTagSuggestion, getFilteredTagSuggestions } from '@/lib/tagSuggestions';
import { LoadingSpinner } from '@/components/ui';
import { toast } from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Bookmark,
  BookmarkCheck,
  Brain,
  Sparkles,
  BookOpen,
  Eye,
  EyeOff,
  Filter,
  Edit,
  X,
  CheckCircle2,
  Tags,
} from 'lucide-react';
import AIAssistant from '@/components/AIAssistant';

interface LearningPageProps {
  mode: 'study' | 'quiz';
}

export const LearningPage: React.FC<LearningPageProps> = ({ mode }) => {
  const { enabled: aiEnabled } = useAIStore();
  const { user } = useAuthStore();
  const canManageQuestions = hasPermission(user, 'question_edit_content') || hasPermission(user, 'question_edit_meta');
  const canUseAI = hasPermission(user, 'ai_use');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<{ name: string; count: number }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showAI, setShowAI] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    answer: '',
    explanation: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    categoryId: '',
    tags: '',
  });

  const modeLabel = mode === 'study' ? '背题模式' : '答题模式';
  const modeIcon = mode === 'study' ? BookOpen : Brain;
  const autoShowAnswer = mode === 'study';

  const fetchQuestions = useCallback(async (restorePosition = true) => {
    setLoading(true);
    try {
      const response = await questionApi.getAll({
        page: 1,
        pageSize: 1000,
        categoryId,
        tags: selectedTags,
      });
      const questionsData = response.data.data;
      setQuestions(questionsData);
      
      if (restorePosition && questionsData.length > 0) {
        const lastViewed = await questionApi.getLastViewed(mode, categoryId);
        if (lastViewed.data && lastViewed.data.question_id) {
          const lastIndex = questionsData.findIndex(q => q.id === lastViewed.data!.question_id);
          if (lastIndex >= 0) {
            setCurrentIndex(lastIndex);
          } else {
            setCurrentIndex(0);
          }
        } else {
          setCurrentIndex(0);
        }
      } else {
        setCurrentIndex(0);
      }
      
      setShowAnswer(autoShowAnswer);
    } catch (error) {
      toast.error('获取题目失败');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [categoryId, autoShowAnswer, mode, selectedTags]);

  const fetchTags = useCallback(async () => {
    try {
      const response = await questionApi.getTags({
        categoryId: categoryId || undefined,
      });
      setAvailableTags(response.data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    }
  }, [categoryId]);

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getAll();
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchProgress = async (questionId: string) => {
    try {
      const response = await questionApi.getProgress(questionId, mode);
      setProgress(response.data);
    } catch (error) {
      console.error('Failed to fetch progress:', error);
    }
  };

  const saveViewProgress = async (questionId: string) => {
    try {
      const currentProgress = await questionApi.getProgress(questionId, mode);
      await questionApi.saveProgress(questionId, {
        mode,
        isBookmarked: currentProgress.data?.is_bookmarked || false,
      });
    } catch (error) {
      console.error('Failed to save view progress:', error);
    }
  };

  const saveProgress = async (isBookmarked: boolean) => {
    if (!currentQuestion) return;

    try {
      await questionApi.saveProgress(currentQuestion.id, {
        mode,
        isBookmarked,
      });
      setProgress((prev) =>
        prev ? { ...prev, is_bookmarked: isBookmarked } : null
      );
      toast.success(isBookmarked ? '已收藏' : '已取消收藏');
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const startEdit = () => {
    if (currentQuestion) {
      setEditForm({
        title: currentQuestion.title,
        content: currentQuestion.content,
        answer: currentQuestion.answer,
        explanation: currentQuestion.explanation || '',
        difficulty: currentQuestion.difficulty,
        categoryId: currentQuestion.category_id || '',
        tags: parseQuestionTags(currentQuestion.tags).join(', '),
      });
      setIsEditing(true);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const saveEdit = async () => {
    if (!currentQuestion) return;

    try {
      await questionApi.update(currentQuestion.id, {
        title: editForm.title,
        content: editForm.content,
        answer: editForm.answer,
        explanation: editForm.explanation || undefined,
        difficulty: editForm.difficulty,
        categoryId: editForm.categoryId || undefined,
        tags: parseQuestionTags(editForm.tags),
      });
      
      setQuestions(prev => prev.map(q => 
        q.id === currentQuestion.id 
          ? { 
              ...q, 
              title: editForm.title,
              content: editForm.content,
              answer: editForm.answer,
              explanation: editForm.explanation || null,
              difficulty: editForm.difficulty,
              category_id: editForm.categoryId || null,
              tags: JSON.stringify(parseQuestionTags(editForm.tags)),
            }
          : q
      ));
      
      setIsEditing(false);
      toast.success('保存成功');
    } catch (error) {
      toast.error('保存失败');
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    if (questions.length > 0 && questions[currentIndex] && initialized) {
      fetchProgress(questions[currentIndex].id);
      saveViewProgress(questions[currentIndex].id);
      setShowAnswer(autoShowAnswer);
    }
  }, [questions, currentIndex, autoShowAnswer, initialized, mode]);

  const currentQuestion = questions[currentIndex];
  const currentQuestionTags = currentQuestion ? parseQuestionTags(currentQuestion.tags) : [];
  const matchedEditTags = getFilteredTagSuggestions(editForm.tags, availableTags);
  const ModeIcon = modeIcon;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleRandom = () => {
    const randomIndex = Math.floor(Math.random() * questions.length);
    setCurrentIndex(randomIndex);
  };

  const handleToggleAnswer = () => {
    setShowAnswer((prev) => !prev);
  };

  const getDifficultyConfig = (difficulty: string) => {
    const configs: Record<string, { label: string; bg: string; text: string; border: string }> = {
      easy: { label: '简单', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      medium: { label: '中等', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      hard: { label: '困难', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    };
    return configs[difficulty] || configs.medium;
  };

  const addFilterTag = (value: string) => {
    const nextTag = value.trim();
    if (!nextTag || selectedTags.includes(nextTag)) {
      setTagInput('');
      return;
    }
    setSelectedTags((prev) => [...prev, nextTag]);
    setTagInput('');
  };

  const applyQuestionTagFilter = (tag: string) => {
    setSelectedTags((prev) => (prev.length === 1 && prev[0] === tag ? [] : [tag]));
    setTagInput('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-3 text-white ${mode === 'study' ? 'bg-green-600' : 'bg-primary-600'}`}>
                <ModeIcon className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{modeLabel}</h1>
                <p className="text-sm text-gray-500">{mode === 'study' ? '直接显示答案，适合记忆学习' : '隐藏答案，测试学习效果'}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[440px]">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="select-field min-w-0 w-full pl-9 pr-10 py-3 cursor-pointer"
              >
                <option value="">全部分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="relative min-w-0">
              <Tags className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
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
                  if (tagInput.trim()) addFilterTag(tagInput);
                }}
                placeholder="按标签学习"
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-3 text-gray-700 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="h-64 bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-gray-500">
          <div className="mb-4 rounded-2xl bg-gray-50 p-4">
            <BookOpen size={32} className="text-gray-400" />
          </div>
          <p className="mb-1 text-lg font-medium text-gray-700">暂无题目</p>
          <p className="text-sm text-gray-500">请先在题库管理中添加题目</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
                <span className="text-sm text-gray-500">题目</span>
                <input
                  type="number"
                  min={1}
                  max={questions.length}
                  value={currentIndex + 1}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 1 && value <= questions.length) {
                      setCurrentIndex(value - 1);
                    }
                  }}
                  className="w-12 text-lg font-bold text-gray-900 text-center bg-transparent border-0 focus:outline-none focus:ring-0"
                />
                <span className="text-sm text-gray-400">/ {questions.length}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
                <Eye size={16} className="text-gray-400" />
                <span className="text-sm text-gray-600">已查看 {progress?.view_count || 0} 次</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-sm text-gray-600">{Math.round(((currentIndex + 1) / questions.length) * 100)}% 已完成</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 lg:items-end">
              {currentQuestionTags.length > 0 ? (
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {currentQuestionTags.map((tag) => (
                    <button
                      key={`${currentQuestion?.id}-${tag}`}
                      onClick={() => applyQuestionTagFilter(tag)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${getTagColorClasses(tag)} ${
                        selectedTags.includes(tag)
                          ? 'ring-2 ring-primary-300 shadow-sm scale-[1.02]'
                          : 'opacity-80 hover:opacity-100 hover:brightness-95'
                      }`}
                      title={selectedTags.includes(tag) ? '再次点击取消该标签筛选' : '点击按该标签筛选'}
                    >
                      {selectedTags.includes(tag) ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-[10px] text-primary-700">
                          ✓
                        </span>
                      ) : null}
                      {tag}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 lg:w-48">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${mode === 'study' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isEditing ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">编辑题目</h3>
                  <button
                    onClick={cancelEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all resize-none"
                    rows={4}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">答案</label>
                  <textarea
                    value={editForm.answer}
                    onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all resize-none"
                    rows={4}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">解析（可选）</label>
                  <textarea
                    value={editForm.explanation}
                    onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 focus:bg-white transition-all resize-none"
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">难度</label>
                    <select
                      value={editForm.difficulty}
                      onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
                      className="select-field w-full px-4 pr-10 py-2.5 text-gray-900 bg-gray-50 focus:bg-white"
                    >
                      <option value="easy">简单</option>
                      <option value="medium">中等</option>
                      <option value="hard">困难</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                    <select
                      value={editForm.categoryId}
                      onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                      className="select-field w-full px-4 pr-10 py-2.5 text-gray-900 bg-gray-50 focus:bg-white"
                    >
                      <option value="">无分类</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
                  <input
                    value={editForm.tags}
                    onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all"
                    placeholder="多个标签用逗号分隔，最多 5 个"
                  />
                  {matchedEditTags.length > 0 ? (
                    <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                      <div className="flex flex-wrap gap-2">
                        {matchedEditTags.map((tag) => (
                          <button
                            key={tag.name}
                            type="button"
                            onClick={() => setEditForm((prev) => ({ ...prev, tags: applyTagSuggestion(prev.tags, tag.name) }))}
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
                
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveEdit}
                    className="px-4 py-2.5 bg-primary-600 rounded-lg text-white hover:bg-primary-700 transition-colors"
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div 
                    className="text-gray-900 text-lg leading-relaxed prose prose-sm max-w-none flex-1"
                    dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(currentQuestion?.content || '', 'rich') }}
                  />
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    {currentQuestion && (
                      <>
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${getDifficultyConfig(currentQuestion.difficulty).bg} ${getDifficultyConfig(currentQuestion.difficulty).text} ${getDifficultyConfig(currentQuestion.difficulty).border}`}>
                          {getDifficultyConfig(currentQuestion.difficulty).label}
                        </span>
                        {currentQuestion.category_id && (
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                            {categories.find((c) => c.id === currentQuestion.category_id)?.name}
                          </span>
                        )}
                      </>
                    )}
                    {canManageQuestions ? (
                      <button
                        onClick={startEdit}
                        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Edit size={20} />
                      </button>
                    ) : null}
                    <button
                      onClick={() => saveProgress(!progress?.is_bookmarked)}
                      className={`p-2 rounded-lg transition-colors ${progress?.is_bookmarked ? 'text-primary-600 bg-gray-100' : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100'}`}
                    >
                      {progress?.is_bookmarked ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                    </button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                  {mode === 'quiz' && !showAnswer ? (
                    <button
                      onClick={() => setShowAnswer(true)}
                      className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Brain size={20} />
                      查看答案
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <div className="h-4 w-1 rounded-full bg-emerald-500" />
                          <h4 className="text-sm font-semibold text-gray-800">答案</h4>
                        </div>
                        <div 
                          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-gray-700 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(currentQuestion?.answer || '', 'rich') }}
                        />
                      </div>
                      {currentQuestion?.explanation && (
                        <div>
                          <div className="mb-2 flex items-center gap-2">
                            <div className="h-4 w-1 rounded-full bg-sky-500" />
                            <h4 className="text-sm font-semibold text-gray-800">解析</h4>
                          </div>
                          <div 
                            className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-gray-700 prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(currentQuestion.explanation, 'rich') }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-16 left-0 right-0 z-10 flex flex-col gap-3 border-t border-gray-200 bg-white/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <div className="grid grid-cols-2 gap-2 lg:hidden">
              <button
                onClick={handleToggleAnswer}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all"
              >
                {showAnswer ? <EyeOff size={18} /> : <Eye size={18} />}
                {showAnswer ? '隐藏答案' : '显示答案'}
              </button>
              <button
                onClick={() => saveProgress(!progress?.is_bookmarked)}
                className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
                  progress?.is_bookmarked
                    ? 'bg-gray-100 text-primary-600 border border-gray-200'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {progress?.is_bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                {progress?.is_bookmarked ? '已收藏' : '收藏'}
              </button>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ChevronLeft size={18} />
                <span className="sm:inline">上一题</span>
              </button>
              <button
                onClick={handleRandom}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors active:scale-95"
              >
                <Shuffle size={18} />
                <span className="sm:inline">随机</span>
              </button>
              <button
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <span className="sm:inline">下一题</span>
                <ChevronRight size={18} />
              </button>
              {aiEnabled && canUseAI ? (
                <button
                  onClick={() => setShowAI(!showAI)}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg transition-colors ${showAI ? 'text-primary-600 bg-gray-100 border border-gray-200' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  <Sparkles size={20} />
                  <span className="text-sm font-medium">{showAI ? '收起AI' : 'AI助手'}</span>
                </button>
              ) : null}
            </div>
          </div>

          {aiEnabled && canUseAI && currentQuestion && showAI && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-24 lg:mb-0">
              <AIAssistant
                question={currentQuestion}
                onClose={() => setShowAI(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
