import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, useAppStore } from '@/store';
import { authApi } from '@/api';
import { hasPermission } from '@/lib/permissions';
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
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/questions', label: '题库', icon: BookOpen, permission: 'question_view' as const },
  { path: '/study', label: '背题', icon: GraduationCap },
  { path: '/quiz', label: '答题', icon: Brain },
  { path: '/bookmarks', label: '收藏', icon: Bookmark },
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
        || hasPermission(user, 'ai_use')
        || hasPermission(user, 'backup_export')
        || hasPermission(user, 'backup_restore');
    }
    return !item.permission || hasPermission(user, item.permission);
  });

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
      <nav className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-30 h-14">
        <div className="px-4 h-full flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 lg:hidden -ml-2"
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link to="/" className="flex items-center space-x-2">
              <Database className="h-7 w-7 text-primary-600" />
              <span className="text-lg font-bold text-gray-900 hidden sm:inline">润涛题苑</span>
              <span className="text-lg font-bold text-gray-900 sm:hidden">润涛</span>
            </Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
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
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-600">
              <LogOut size={18} className="sm:mr-1" />
              <span className="hidden sm:inline">退出</span>
            </Button>
          </div>
        </div>
      </nav>

      <aside
        className={`fixed left-0 top-14 bottom-0 bg-white border-r border-gray-200 z-20 overflow-y-auto overflow-x-hidden transition-all duration-200 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}
      >
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
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/20'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className={`font-medium whitespace-nowrap transition-opacity duration-150 ${sidebarCollapsed ? 'lg:opacity-0 lg:w-0 lg:overflow-hidden' : 'opacity-100'}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={toggleSidebarCollapse}
          className="hidden lg:flex items-center justify-center w-8 h-8 absolute bottom-4 right-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      <main
        className={`pt-14 pb-20 lg:pb-6 min-h-screen transition-all duration-200 ease-out ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <div className="p-4 sm:p-6">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 lg:hidden safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-1">
          {visibleNavItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-lg transition-colors ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={22} className={isActive ? 'text-primary-600' : ''} />
                <span className={`text-xs mt-1 font-medium ${isActive ? 'text-primary-600' : ''}`}>
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
      <div className="app-modal-panel w-full max-w-md overflow-hidden">
        <div className="app-modal-header flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">个人资料</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input
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
                <label className="block text-sm font-medium text-gray-700 mb-2">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
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
