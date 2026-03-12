import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, useAIStore } from '@/store';
import { aiApi } from '@/api';
import { Layout } from '@/components/Layout';
import { LoginPage, RegisterPage } from '@/pages/Auth';
import { HomePage } from '@/pages/Home';
import { QuestionsPage } from '@/pages/Questions';
import { LearningPage } from '@/pages/Learning';
import { SettingsPage } from '@/pages/Settings';
import { BookmarksPage } from '@/pages/Bookmarks';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return !isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { setStatus } = useAIStore();

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
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout>
              <HomePage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/questions"
        element={
          <PrivateRoute>
            <Layout>
              <QuestionsPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/study"
        element={
          <PrivateRoute>
            <Layout>
              <LearningPage key="study" mode="study" />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/quiz"
        element={
          <PrivateRoute>
            <Layout>
              <LearningPage key="quiz" mode="quiz" />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/bookmarks"
        element={
          <PrivateRoute>
            <Layout>
              <BookmarksPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateRoute>
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
