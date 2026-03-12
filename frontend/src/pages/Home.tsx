import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/api';
import { LoadingSpinner } from '@/components/ui';
import { useAuthStore } from '@/store';
import { hasPermission } from '@/lib/permissions';
import {
  BookOpen,
  GraduationCap,
  Brain,
  Clock,
  Flame,
  Target,
  Bookmark,
  ChevronRight,
  Calendar,
} from 'lucide-react';

interface Stats {
  questionCount: number;
  categoryCount: number;
  totalViewed: number;
  todayViewed: number;
  studyViewed: number;
  quizViewed: number;
  bookmarked: number;
  studyTime: number;
}

const defaultStats: Stats = {
  questionCount: 0,
  categoryCount: 0,
  totalViewed: 0,
  todayViewed: 0,
  studyViewed: 0,
  quizViewed: 0,
  bookmarked: 0,
  studyTime: 0,
};

export const HomePage: React.FC = () => {
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const canManageQuestions = hasPermission(user, 'question_view');
  const canUseAI = hasPermission(user, 'ai_use');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApi.getStats();
        setStats({ ...defaultStats, ...response.data });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 12) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  const getProgressPercent = () => {
    if (!stats || stats.questionCount === 0) return 0;
    return Math.min(100, Math.round((stats.totalViewed / stats.questionCount) * 100));
  };

  const remainingCount = Math.max(0, (stats?.questionCount || 0) - (stats?.totalViewed || 0));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-5 text-white sm:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_22%)]" />
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 left-12 h-48 w-48 rounded-full bg-pink-300/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl">👋</span>
                <h1 className="text-2xl font-bold md:text-3xl">
                  {getGreeting()}，{user?.username || '学习者'}
                </h1>
              </div>
              <p className="text-sm leading-6 text-white/80 md:text-base">
                {stats?.todayViewed && stats.todayViewed > 0
                  ? `今天已经学习 ${stats.todayViewed} 道题，当前总进度 ${getProgressPercent()}%。继续保持。`
                  : '从今天开始整理并高效复习你的题库。'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <Link
                  to="/study"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-purple-700 transition-all hover:scale-[1.02]"
                >
                  <GraduationCap size={18} />
                  开始背题
                </Link>
                <Link
                  to="/quiz"
                  className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25"
                >
                  <Brain size={18} />
                  答题测试
                </Link>
                {canManageQuestions ? (
                  <Link
                    to="/questions"
                    className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/25"
                  >
                    <BookOpen size={18} />
                    管理题库
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="grid w-full max-w-xs gap-3">
              <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
                <div className="mb-1.5 text-xs text-white/80">今日学习</div>
                <div className="flex items-end justify-between">
                  <div className="text-3xl font-bold">{stats.todayViewed || 0}</div>
                  <Flame size={20} className="text-orange-200" />
                </div>
              </div>
              <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
                <div className="mb-1.5 text-xs text-white/80">学习进度</div>
                <div className="text-3xl font-bold">{getProgressPercent()}%</div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${getProgressPercent()}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md border border-gray-100">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-2 text-white">
              <BookOpen size={18} />
            </div>
            <span className="text-xs text-gray-500">题目总数</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{stats?.questionCount || 0}</span>
            <span className="text-xs text-gray-500">题</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md border border-gray-100">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-gradient-to-br from-sky-300 to-teal-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-teal-600 to-cyan-700 p-2 text-white">
              <Target size={18} />
            </div>
            <span className="text-xs text-gray-500">已学习</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{stats?.totalViewed || 0}</span>
            <span className="text-xs text-gray-500">题</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md border border-gray-100">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white">
              <Clock size={18} />
            </div>
            <span className="text-xs text-gray-500">学习时长</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{stats?.studyTime ? Math.floor(stats.studyTime / 60) : 0}</span>
            <span className="text-xs text-gray-500">小时</span>
          </div>
        </div>

        <div className="group relative overflow-hidden rounded-xl bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md border border-gray-100">
          <div className="absolute right-0 top-0 h-16 w-16 rounded-full bg-gradient-to-br from-orange-300 to-rose-500 opacity-10 blur-2xl transition-opacity group-hover:opacity-20" />
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 p-2 text-white">
              <Bookmark size={18} />
            </div>
            <span className="text-xs text-gray-500">我的收藏</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900">{stats?.bookmarked || 0}</span>
            <span className="text-xs text-gray-500">题</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">学习分布</h2>
            <Link to="/bookmarks" className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700">
              查看收藏 <ChevronRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-amber-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-amber-700">{stats?.categoryCount || 0}</div>
              <div className="text-sm text-gray-500">分类数量</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-emerald-700">{stats?.studyViewed || 0}</div>
              <div className="text-sm text-gray-500">背题模式</div>
            </div>
            <div className="rounded-xl bg-cyan-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-cyan-700">{stats?.quizViewed || 0}</div>
              <div className="text-sm text-gray-500">答题模式</div>
            </div>
            <div className="rounded-xl bg-rose-50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-rose-700">{remainingCount}</div>
              <div className="text-sm text-gray-500">待学习</div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="mb-4 text-sm font-medium text-gray-600">快速开始</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {canManageQuestions ? (
                <Link to="/questions" className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100">
                  <div className="rounded-xl bg-amber-100 p-2 transition-colors group-hover:bg-amber-200">
                    <BookOpen size={20} className="text-amber-700" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">题库管理</div>
                    <div className="text-xs text-gray-500">添加或导入题目</div>
                  </div>
                </Link>
              ) : null}
              <Link to="/study" className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100">
                <div className="rounded-xl bg-emerald-100 p-2 transition-colors group-hover:bg-emerald-200">
                  <GraduationCap size={20} className="text-emerald-700" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">背题模式</div>
                  <div className="text-xs text-gray-500">直接显示答案</div>
                </div>
              </Link>
              <Link to="/quiz" className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:bg-gray-100">
                <div className="rounded-xl bg-cyan-100 p-2 transition-colors group-hover:bg-cyan-200">
                  <Brain size={20} className="text-cyan-700" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">答题模式</div>
                  <div className="text-xs text-gray-500">测试学习效果</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">学习建议</h2>
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">推荐动作</div>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                {remainingCount > 0
                  ? `优先进入背题模式，先处理 ${Math.min(20, remainingCount)} 道未覆盖题目，再切换到答题模式巩固。`
                  : '当前题库已基本覆盖，建议直接进入答题模式或回看收藏内容。'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">复习重点</div>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                {stats.bookmarked > 0
                  ? `收藏区里还有 ${stats.bookmarked} 道重点题，适合做集中复习。`
                  : '还没有收藏重点题，遇到高频错题时可以及时加入收藏。'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">题库整理</div>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                {canManageQuestions
                  ? '可以继续补充分类、整理标签，或者导入新题扩充当前题库。'
                  : '当前更适合专注学习和复习，题库整理功能由管理员维护。'}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-500">辅助能力</div>
              <p className="mt-1 text-sm leading-6 text-gray-700">
                {canUseAI ? '可以使用 AI 解析和批量生题，补足薄弱专题。' : '可以通过背题、答题和收藏三种方式稳步推进学习。'}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar size={16} />
              <span>今天是 {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
