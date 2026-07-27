import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '@/store';
import { authApi } from '@/api';
import { hasPermission } from '@/lib/permissions';
import { preloadRoute } from '@/lib/routePreload';
import { Button } from '@/components/ui';
import { toast } from 'react-hot-toast';
import {
  Menu,
  X,
  Home,
  BookOpen,
  GraduationCap,
  Brain,
  Settings,
  LogOut,
  User,
  Database,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Save,
  Eye,
  EyeOff,
  Lock,
  ClipboardPenLine,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/questions', label: '题库', icon: BookOpen, permission: 'question_view' as const },
  { path: '/capture', label: '记题', icon: ClipboardPenLine, permission: 'question_create' as const },
  { path: '/study', label: '背题', icon: GraduationCap, permission: 'question_view' as const },
  { path: '/quiz', label: '答题', icon: Brain, permission: 'question_view' as const },
  { path: '/bookmarks', label: '收藏', icon: Bookmark, permission: 'question_view' as const },
  { path: '/settings', label: '设置', icon: Settings, permission: 'system_manage' as const },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, updateUser } = useAuthStore();
  const { sidebarOpen, toggleSidebar, sidebarCollapsed, toggleSidebarCollapse } = useAppStore();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const visibleNavItems = navItems.filter((item) => {
    if (item.path === '/settings') {
      return hasPermission(user, 'system_manage')
        || hasPermission(user, 'user_manage')
        || hasPermission(user, 'category_manage')
        || hasPermission(user, 'ai_config_manage')
        || hasPermission(user, 'backup_export')
        || hasPermission(user, 'backup_restore');
    }
    return !item.permission || hasPermission(user, item.permission);
  });
  const visibleRoutePaths = visibleNavItems.map((item) => item.path).join('|');
  const activeNavItem = visibleNavItems.find((item) => item.path === location.pathname) || navItems[0];
  const mobileLearningPath = location.pathname === '/quiz' ? '/quiz' : '/study';
  const mobileNavPaths = ['/', '/questions', mobileLearningPath, '/capture', '/bookmarks'];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      visibleRoutePaths.split('|').filter(Boolean).forEach(preloadRoute);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [visibleRoutePaths]);

  const handleLogout = () => {
    authApi.logout().catch(() => undefined).finally(() => {
      logout();
      navigate('/login');
    });
  };

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="safe-area-top fixed left-0 right-0 top-0 z-30 hidden h-16 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur lg:block">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-3">
            <button
              aria-label={sidebarOpen ? '关闭导航菜单' : '打开导航菜单'}
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 lg:hidden -ml-2"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link to="/" className="flex items-center space-x-2">
              <Database className="h-7 w-7 text-primary-600" />
              <span className="text-lg font-bold text-gray-900 hidden sm:inline">技术成长站</span>
              <span className="text-lg font-bold text-gray-900 sm:hidden">成长站</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              aria-label="打开个人资料"
              onClick={() => setShowProfileModal(true)}
              className="flex items-center space-x-2 hover:bg-gray-100 px-2 py-1.5 rounded-lg transition-colors"
            >
              <User size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.username}</span>
              {user?.role === 'admin' && (
                <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded-full hidden sm:inline">
                  管理员
                </span>
              )}
            </button>
            <Button aria-label="退出登录" variant="ghost" size="sm" onClick={handleLogout} className="text-gray-600">
              <LogOut size={18} className="sm:mr-1" />
              <span className="hidden sm:inline">退出</span>
            </Button>
          </div>
        </div>
      </nav>

      <header className="safe-area-top fixed inset-x-0 top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-[52px] items-center justify-between px-3">
          <button
            aria-label={sidebarOpen ? '关闭导航菜单' : '打开导航菜单'}
            onClick={toggleSidebar}
            className="-ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 active:bg-slate-100"
          >
            {sidebarOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="min-w-0 px-2 text-center">
            <p className="truncate text-[15px] font-semibold text-slate-900">{activeNavItem.label}</p>
          </div>
          <button
            aria-label="打开个人资料"
            onClick={() => setShowProfileModal(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700 active:bg-blue-100"
          >
            {(user?.username || '用').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <aside
        className={`fixed bottom-0 left-0 top-[calc(3.25rem+env(safe-area-inset-top,0px))] z-20 flex flex-col overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white transition-all duration-200 ease-out lg:top-[calc(4rem+env(safe-area-inset-top,0px))] ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-[min(82vw,19rem)] lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
        <div className="border-b border-slate-100 p-4 lg:hidden">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
              {(user?.username || '用').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.username}</p>
              <p className="truncate text-xs text-slate-500">{user?.email || (user?.role === 'admin' ? '管理员' : '普通用户')}</p>
            </div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center' : 'gap-3'} px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/15'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
                onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                onMouseEnter={() => preloadRoute(item.path)}
                onFocus={() => preloadRoute(item.path)}
                onTouchStart={() => preloadRoute(item.path)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className={`font-medium whitespace-nowrap transition-opacity duration-150 ${sidebarCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-slate-100 p-3 lg:hidden">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 active:bg-slate-100"
          >
            <LogOut size={19} />
            退出登录
          </button>
        </div>
        <button
          aria-label={sidebarCollapsed ? '展开侧边导航' : '收起侧边导航'}
          onClick={toggleSidebarCollapse}
          className="hidden lg:flex items-center justify-center w-8 h-8 absolute bottom-4 right-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <main
        className={`mobile-app-main min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.25rem+env(safe-area-inset-top,0px))] transition-all duration-200 ease-out lg:pb-8 lg:pt-[calc(4rem+env(safe-area-inset-top,0px))] ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <div className="mobile-page-content p-3 sm:p-5 lg:p-8">{children}</div>
      </main>

      <nav className="safe-area-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-[58px] items-center justify-around px-1">
          {mobileNavPaths
            .map((path) => visibleNavItems.find((item) => item.path === path))
            .filter((item): item is (typeof navItems)[number] => Boolean(item))
            .map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onTouchStart={() => preloadRoute(item.path)}
                onFocus={() => preloadRoute(item.path)}
                className={`relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-slate-400 active:text-slate-700'
                }`}
              >
                {isActive && <span className="absolute top-0 h-0.5 w-7 rounded-full bg-blue-600" />}
                <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        updateUser={updateUser}
      />
    </div>
  );
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  updateUser: (data: any) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, updateUser }) => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  React.useEffect(() => {
    if (user && isOpen) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        password: '',
        confirmPassword: '',
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password && formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        username: formData.username,
        email: formData.email,
      };
      if (formData.password) {
        data.password = formData.password;
      }

      await authApi.updateProfile(data);
      updateUser({ username: formData.username, email: formData.email });
      toast.success('更新成功');
      setFormData({ ...formData, password: '', confirmPassword: '' });
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center px-4 py-6">
      <div
        aria-labelledby="profile-dialog-title"
        aria-modal="true"
        className="app-modal-panel w-full max-w-md overflow-hidden"
        role="dialog"
      >
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <h2 id="profile-dialog-title" className="text-lg font-semibold text-gray-900">个人资料</h2>
          <button aria-label="关闭个人资料" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="profile-username" className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <input
              id="profile-username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input
              id="profile-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-4">修改密码（留空则不修改）</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="profile-password" className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="profile-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    aria-label={showPassword ? '隐藏新密码' : '显示新密码'}
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="profile-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="profile-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all">
              取消
            </button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <Save size={18} />
              {loading ? '保存中...' : '保存更改'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};
