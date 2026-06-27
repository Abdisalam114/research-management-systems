#!/usr/bin/env node
import { createServer } from 'vite';

const server = await createServer({
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

await server.listen();
console.log('Vite dev server running at http://localhost:5173');
