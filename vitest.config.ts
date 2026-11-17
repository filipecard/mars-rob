import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      include: ['src/**'],
      exclude: ['src/main.ts'],
      // O CI falha se a cobertura cair abaixo destes valores
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
