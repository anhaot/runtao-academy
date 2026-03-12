import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Lock, RefreshCw, User } from 'lucide-react';
import { adminApi, authApi } from '@/api';
import { useAuthStore } from '@/store';

const generateCaptcha = (): { text: string; svg: string } => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let text = '';
  for (let i = 0; i < 4; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">';
  svg += '<rect width="120" height="48" rx="10" fill="#f8fafc"/>';

  for (let i = 0; i < 24; i += 1) {
    const x = Math.random() * 120;
    const y = Math.random() * 48;
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<circle cx="${x}" cy="${y}" r="1.5" fill="${color}" opacity="0.18"/>`;
  }

  for (let i = 0; i < text.length; i += 1) {
    const x = 18 + i * 24;
    const y = 30 + Math.random() * 6 - 3;
    const rotation = Math.random() * 20 - 10;
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<text x="${x}" y="${y}" font-family="Georgia, serif" font-size="22" font-weight="700" fill="${color}" transform="rotate(${rotation} ${x} ${y})">${text[i]}</text>`;
  }

  svg += '</svg>';
  return { text, svg };
};

const AuthShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4 py-8">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
      <div className="w-full rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-white/10 text-white shadow-lg">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-6 text-white/70">{subtitle}</p> : null}
        </div>

        {children}
        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  </div>
);

const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
  <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
    {message}
  </div>
);

const labelClassName = 'mb-2 block text-sm font-medium text-white/80';
const inputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20';
const iconInputClassName =
  'w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-white placeholder:text-white/35 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20';
const trailingIconButtonClassName =
  'absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/12 p-1.5 text-white/85 transition-colors hover:bg-white/20 hover:text-white';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [allowRegister, setAllowRegister] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    captcha: '',
  });
  const [captchaData, setCaptchaData] = useState<{ text: string; svg: string }>({ text: '', svg: '' });

  const refreshCaptcha = useCallback(() => {
    setCaptchaData(generateCaptcha());
  }, []);

  useEffect(() => {
    refreshCaptcha();
    const fetchPublicSettings = async () => {
      try {
        const response = await adminApi.getPublicSettings();
        setAllowRegister(response.data.allowRegister);
      } catch (fetchError) {
        console.error('Failed to fetch public settings:', fetchError);
      }
    };
    fetchPublicSettings();
  }, [refreshCaptcha]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.captcha.toLowerCase() !== captchaData.text.toLowerCase()) {
      setError('验证码错误，请重新输入');
      refreshCaptcha();
      setFormData((current) => ({ ...current, captcha: '' }));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.login({
        username: formData.username,
        password: formData.password,
      });
      setAuth(response.data.user, response.data.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || '用户名或密码错误，请重新输入';
      setError(errorMsg);
      refreshCaptcha();
      setFormData((current) => ({ ...current, captcha: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="登录"
      subtitle=""
      footer={
        allowRegister ? (
          <p className="text-center text-sm text-slate-500">
            还没有账户？{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="font-medium text-purple-200 transition-colors hover:text-white"
            >
              立即注册
            </button>
          </p>
        ) : null
      }
    >
      {error ? <ErrorAlert message={error} /> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClassName}>用户名</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              data-testid="login-username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((current) => ({ ...current, username: e.target.value }))}
              required
              placeholder="请输入用户名"
              className={iconInputClassName}
            />
          </div>
        </div>

        <div>
          <label className={labelClassName}>密码</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              data-testid="login-password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
              required
              placeholder="请输入密码"
              className={`${iconInputClassName} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className={trailingIconButtonClassName}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className={labelClassName}>验证码</label>
          <div className="flex gap-3">
            <input
              data-testid="login-captcha"
              type="text"
              value={formData.captcha}
              onChange={(e) => setFormData((current) => ({ ...current, captcha: e.target.value }))}
              required
              placeholder="请输入验证码"
              className={`${inputClassName} min-w-0 flex-1`}
            />
            <button
              data-testid="login-captcha-refresh"
              type="button"
              onClick={refreshCaptcha}
              className="flex h-[50px] items-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 pl-3 pr-2 text-white/70 transition-colors hover:bg-white/10"
              title="点击刷新验证码"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <div
                data-testid="login-captcha-svg"
                className="flex h-12 items-center overflow-hidden rounded-xl bg-white/95"
                dangerouslySetInnerHTML={{ __html: captchaData.svg }}
              />
            </button>
          </div>
        </div>

        <button
          data-testid="login-submit"
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 py-3 text-sm font-medium text-white shadow-lg shadow-purple-900/30 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </AuthShell>
  );
};

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    captcha: '',
  });
  const [captchaData, setCaptchaData] = useState<{ text: string; svg: string }>({ text: '', svg: '' });

  const refreshCaptcha = useCallback(() => {
    setCaptchaData(generateCaptcha());
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 9) {
      return '密码长度必须超过9位';
    }
    if (!/[a-zA-Z]/.test(password)) {
      return '密码必须包含字母';
    }
    if (!/[0-9]/.test(password)) {
      return '密码必须包含数字';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.captcha.toLowerCase() !== captchaData.text.toLowerCase()) {
      setError('验证码错误');
      refreshCaptcha();
      setFormData((current) => ({ ...current, captcha: '' }));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await authApi.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      setAuth(response.data.user, response.data.token);
      navigate('/', { replace: true });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || '注册失败';
      setError(errorMsg);
      refreshCaptcha();
      setFormData((current) => ({ ...current, captcha: '' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="注册"
      subtitle="创建账户后即可开始整理题库和学习。"
      footer={
        <p className="text-center text-sm text-white/70">
          已有账户？{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-medium text-purple-200 transition-colors hover:text-white"
          >
            返回登录
          </button>
        </p>
      }
    >
      {error ? <ErrorAlert message={error} /> : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClassName}>用户名</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData((current) => ({ ...current, username: e.target.value }))}
              required
              placeholder="请输入用户名"
              className={iconInputClassName}
            />
          </div>
        </div>

        <div>
          <label className={labelClassName}>邮箱</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
            required
            placeholder="请输入邮箱"
            className={inputClassName}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>密码</label>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData((current) => ({ ...current, password: e.target.value }))}
                required
                placeholder="请输入密码"
                className={`${iconInputClassName} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className={trailingIconButtonClassName}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className={labelClassName}>确认密码</label>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData((current) => ({ ...current, confirmPassword: e.target.value }))}
                required
                placeholder="再次输入密码"
                className={`${iconInputClassName} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className={trailingIconButtonClassName}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <p className="-mt-1 text-xs text-white/55">密码需超过 9 位，并同时包含字母和数字</p>

        <div>
          <label className={labelClassName}>验证码</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={formData.captcha}
              onChange={(e) => setFormData((current) => ({ ...current, captcha: e.target.value }))}
              required
              placeholder="请输入验证码"
              className={`${inputClassName} min-w-0 flex-1`}
            />
            <button
              type="button"
              onClick={refreshCaptcha}
              className="flex h-[50px] items-center gap-2 overflow-hidden rounded-2xl border border-white/10 bg-white/5 pl-3 pr-2 text-white/70 transition-colors hover:bg-white/10"
              title="点击刷新验证码"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              <div
                className="flex h-12 items-center overflow-hidden rounded-xl bg-white/95"
                dangerouslySetInnerHTML={{ __html: captchaData.svg }}
              />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 py-3 text-sm font-medium text-white shadow-lg shadow-purple-900/30 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {loading ? '注册中...' : '注册'}
        </button>
      </form>
    </AuthShell>
  );
};
