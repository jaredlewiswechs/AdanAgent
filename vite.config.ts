import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Proxy AI requests through the dev server to bypass browser
          // CORS restrictions and corporate proxy/firewall blocks.
          '/api/ai/pollinations': {
            target: 'https://gen.pollinations.ai',
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/api\/ai\/pollinations/, ''),
            secure: true,
          },
          '/api/ai/text-pollinations': {
            target: 'https://text.pollinations.ai',
            changeOrigin: true,
            rewrite: (p: string) => p.replace(/^\/api\/ai\/text-pollinations/, ''),
            secure: true,
          },
        },
      },
      plugins: [react()],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
