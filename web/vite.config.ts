import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'http://localhost:3001',
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    build: {
      manifest: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: apiProxy,
    },
    preview: {
      port: 4173,
      proxy: apiProxy,
    },
  };
});
