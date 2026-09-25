import { defineConfig } from 'vitest/config';
import { testEnv } from './tests/setup/test-env.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: testEnv,
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/disconnect.ts'],
    // Os arquivos dividem o mesmo banco: um de cada vez
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});