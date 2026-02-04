const { defineWorkspace } = require('vitest/config');

module.exports = defineWorkspace([
  {
    test: {
      name: 'renderer',
      environment: 'jsdom',
      setupFiles: ['src/test/setup.renderer.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.test.tsx', 'src/**/*.spec.tsx'],
      clearMocks: true,
      restoreMocks: true,
      globals: true,
    },
  },
  {
    test: {
      name: 'main',
      environment: 'node',
      setupFiles: ['src/test/setup.node.ts'],
      include: ['electron/**/*.test.ts', 'electron/**/*.spec.ts'],
      clearMocks: true,
      restoreMocks: true,
      globals: true,
    },
  },
]);
