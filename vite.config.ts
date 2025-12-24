import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'local-gemini-endpoint',
          configureServer(server) {
            server.middlewares.use('/api/gemini', (req, res) => {
              const chunks: any[] = [];
              req.on('data', (c) => chunks.push(c));
              req.on('end', async () => {
                try {
                  const body = Buffer.concat(chunks).toString('utf-8');
                  const { handler } = await import('./netlify/functions/gemini');
                  const result = await handler({
                    httpMethod: req.method || 'GET',
                    headers: req.headers,
                    body: body || '',
                    path: '/api/gemini',
                  });

                  res.statusCode = result?.statusCode || 200;
                  const headers = result?.headers || {};
                  for (const [k, v] of Object.entries(headers)) {
                    if (typeof v === 'string') res.setHeader(k, v);
                  }
                  res.end(result?.body || '');
                } catch (e) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  res.end(JSON.stringify({ error: 'Error: Local Gemini endpoint failed' }));
                }
              });
            });
          }
        }
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
