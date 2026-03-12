import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { questionApi } from '@/api';
import { getTagColorClasses } from '@/lib/tagColors';
import { parseQuestionTags } from '@/lib/questionTags';
import { renderSafeMarkdown } from '@/lib/renderMarkdown';
import { LoadingSpinner } from '@/components/ui';
import { Bookmark, BookOpen, Brain, Trash2, Star, Eye, EyeOff, Tags, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Question {
  id: string;
  title: string;
  content: string;
  answer: string;
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  category_id: string | null;
  tags: string;
}

export const BookmarksPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'study' | 'quiz') || 'study';
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const response = await questionApi.getBookmarked(mode);
      setQuestions(response.data);
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, [mode]);

  const handleRemoveBookmark = async (questionId: string) => {
    if (!confirm('确定要取消收藏吗？')) return;

    try {
      await questionApi.saveProgress(questionId, {
        mode,
        isBookmarked: false,
      });
      toast.success('已取消收藏');
      fetchBookmarks();
    } catch (error) {
      toast.error('操作失败');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
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

  const removeFilterTag = (value: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== value));
  };

  const filteredQuestions = selectedTags.length === 0
    ? questions
    : questions.filter((question) => {
        const tags = parseQuestionTags(question.tags);
        return selectedTags.every((tag) => tags.includes(tag));
      });

  const availableTags = Array.from(
    questions.reduce((map, question) => {
      for (const tag of parseQuestionTags(question.tags)) {
        map.set(tag, (map.get(tag) || 0) + 1);
      }
      return map;
    }, new Map<string, number>())
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

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
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 shadow-lg shadow-orange-500/20">
            <Bookmark className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">我的收藏</h1>
            <p className="text-sm text-gray-500">共 {questions.length} 道收藏题目，支持按标签快速回看。</p>
          </div>
        </div>
          <Link to={mode === 'study' ? '/study' : '/quiz'}>
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-700 transition-colors hover:bg-gray-50 xl:w-auto">
              {mode === 'study' ? (
                <>
                  <BookOpen size={18} className="text-green-500" />
                  继续背题
                </>
              ) : (
                <>
                  <Brain size={18} className="text-blue-500" />
                  继续答题
                </>
              )}
            </button>
          </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex gap-2 xl:flex-none">
            <button
              onClick={() => setSearchParams({ mode: 'study' })}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                mode === 'study'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/20'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={18} />
              背题模式收藏
            </button>
            <button
              onClick={() => setSearchParams({ mode: 'quiz' })}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all ${
                mode === 'quiz'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Brain size={18} />
              答题模式收藏
            </button>
          </div>
          <div className="relative flex-1">
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
            placeholder="标签筛选"
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-3 text-gray-700 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          </div>
        </div>
        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => removeFilterTag(tag)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm ${getTagColorClasses(tag)}`}
              >
                {tag}
                <X size={14} />
              </button>
            ))}
          </div>
        ) : null}
        {availableTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableTags.slice(0, 12).map((tag) => (
              <button
                key={tag.name}
                onClick={() => addFilterTag(tag.name)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${getTagColorClasses(tag.name)} ${
                  selectedTags.includes(tag.name)
                    ? 'ring-2 ring-primary-200'
                    : 'hover:brightness-95'
                  }`}
              >
                <span>{tag.name}</span>
                <span className="text-xs text-gray-400">{tag.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex h-64 flex-col items-center justify-center text-gray-500">
          <div className="mb-4 rounded-2xl bg-amber-50 p-4">
            <Star size={32} className="text-amber-400" />
          </div>
          <p className="mb-1 text-lg font-medium text-gray-700">{questions.length === 0 ? '暂无收藏题目' : '没有符合标签条件的收藏题目'}</p>
          <p className="mb-4 text-sm text-gray-500">{questions.length === 0 ? '在学习过程中点击收藏按钮添加题目' : '换一个标签试试，或清空当前标签筛选。'}</p>
          <Link to={mode === 'study' ? '/study' : '/quiz'}>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/20">
              {mode === 'study' ? '去背题' : '去答题'}
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((question) => {
            const diffConfig = getDifficultyConfig(question.difficulty);
            const isExpanded = expandedIds.has(question.id);
            
            return (
              <div
                key={question.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${diffConfig.bg} ${diffConfig.text} ${diffConfig.border}`}>
                      {diffConfig.label}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveBookmark(question.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="取消收藏"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="p-5">
                  <div 
                    className="text-gray-900 prose prose-sm max-w-none mb-4"
                    dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(question.content.substring(0, isExpanded ? undefined : 200), 'compact') }}
                  />
                  
                  {!isExpanded && question.content.length > 200 && (
                    <button
                      onClick={() => toggleExpand(question.id)}
                      className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      <Eye size={14} />
                      展开全部
                    </button>
                  )}
                  
                  {isExpanded && (
                    <>
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-5 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
                          <h4 className="text-sm font-semibold text-gray-700">答案</h4>
                        </div>
                        <div 
                          className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl text-gray-700 prose prose-sm max-w-none border border-green-100"
                          dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(question.answer, 'compact') }}
                        />
                      </div>
                      
                      {question.explanation && (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full" />
                            <h4 className="text-sm font-semibold text-gray-700">解析</h4>
                          </div>
                          <div 
                            className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl text-gray-700 prose prose-sm max-w-none border border-blue-100"
                            dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(question.explanation, 'compact') }}
                          />
                        </div>
                      )}
                      
                      <button
                        onClick={() => toggleExpand(question.id)}
                        className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <EyeOff size={14} />
                        收起
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
