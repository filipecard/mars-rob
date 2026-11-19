import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Em desenvolvimento, a API roda em outro processo: npm run dev -- --servidor
const API = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/ws': { target: API, ws: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
