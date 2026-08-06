import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

const pkg = (name: string) => resolve(import.meta.dirname, `packages/${name}/src/index.ts`);

export default defineConfig({
  // Workspace imports resolve to source, so `pnpm test` works on a clean
  // checkout without building dist/ first. Packaged builds still resolve
  // through each package's "exports" field.
  resolve: {
    alias: {
      // More specific first: Vite matches aliases by prefix, so the bare
      // package name would otherwise swallow the subpath and rewrite it to
      // index.ts/testing.
      '@aether-forge/core/testing': resolve(
        import.meta.dirname,
        'packages/core/src/testing/index.ts',
      ),
      '@aether-forge/core': pkg('core'),
      '@aether-forge/ui': pkg('ui'),
      '@aether-forge/system-toy': pkg('system-toy'),
      '@aether-forge/system-ironsworn': pkg('system-ironsworn'),
      '@aether-forge/importer-datasworn': pkg('importer-datasworn'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/desktop/src/**/*.test.{ts,tsx}'],
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
  },
});
