import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, '..', 'VITE_'), ...loadEnv(mode, '.', 'VITE_') };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3-') ||
              id.includes('node_modules/victory-vendor') ||
              id.includes('node_modules/@reduxjs') ||
              id.includes('node_modules/react-redux') ||
              id.includes('node_modules/redux') ||
              id.includes('node_modules/reselect') ||
              id.includes('node_modules/immer')
            ) {
              return 'vendor-charts';
            }

            if (
              id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react')
            ) {
              return 'vendor-react';
            }

            if (
              id.includes('node_modules/motion') ||
              id.includes('node_modules/framer-motion')
            ) {
              return 'vendor-motion';
            }

            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      host: true,
      watch: {
        usePolling: true,
        interval: 300,
      },
      proxy: {
        '/api/v1': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  };
});
