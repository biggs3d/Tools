import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.{js,ts}']
    }
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'default']
  }
});