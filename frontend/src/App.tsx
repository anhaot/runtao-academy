import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, useAIStore } from '@/store';
import { aiApi, authApi } from '@/api';
import { Layout } from '@/components/Layout';
import { LoginPage, RegisterPage } from '@/pages/Auth';
import { HomePage } from '@/pages/Home';
import { QuestionsPage } from '@/pages/Questions';
import { LearningPage } from '@/pages/Learning';
import { SettingsPage } from '@/pages/Settings';
import { BookmarksPage } from '@/pages/Bookmarks';

const PrivateRoute: React.FC<{ children: React.ReactNode; authReady: boolean }> = ({ children, authReady }) => {
  const { isAuthenticated } = useAuthStore();
  if (!authReady) {
    return null;
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode; authReady: boolean }> = ({ children, authReady }) => {
  const { isAuthenticated } = useAuthStore();
  if (!authReady) {
    return null;
  }
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const AppContent: React.FC = () => {
  const { isAuthenticated, setAuth, logout } = useAuthStore();
  const { setStatus } = useAIStore();
  const [authReady, setAuthReady] = useState(false);
  const authBootstrapStartedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      setAuthReady(true);
      return;
    }

    if (authBootstrapStartedRef.current) {
      return;
    }
    authBootstrapStartedRef.current = true;

    authApi.getMe()
      .then((response) => {
        setAuth(response.data);
      })
      .catch(() => {
        logout();
      })
      .finally(() => {
        setAuthReady(true);
      });
  }, [isAuthenticated, logout, setAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      aiApi.getStatus().then((response) => {
        setStatus({
          enabled: response.data.enabled,
          defaultProvider: response.data.defaultProvider,
          availableProviders: response.data.availableProviders,
        });
      }).catch(console.error);
    }
  }, [isAuthenticated, setStatus]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute authReady={authReady}>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute authReady={authReady}>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute authReady={authReady}>
            <Layout>
              <HomePage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/questions"
        element={
          <PrivateRoute authReady={authReady}>
            <Layout>
              <QuestionsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/study"
        element={
          <PrivateRoute authReady={authReady}>
            <Layout>
              <LearningPage key="study" mode="study" />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <PrivateRoute authReady={authReady}>
            <Layout>
              <LearningPage key="quiz" mode="quiz" />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <PrivateRoute authReady={authReady}>
            <Layout>
              <BookmarksPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute authReady={authReady}>
            <Layout>
              <SettingsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#363636',
            color: '#fff',
            fontSize: '14px',
            padding: '12px 20px',
            borderRadius: '8px',
            minWidth: '300px',
            maxWidth: '500px',
          },
          success: {
            duration: 3000,
            style: {
              background: '#22c55e',
            },
          },
          error: {
            duration: 5000,
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
