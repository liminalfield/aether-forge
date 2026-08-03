import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Dependency direction is law (00-PROJECT-BRIEF.md). It is enforced twice:
 * here on import specifiers for fast editor feedback, and in
 * .dependency-cruiser.cjs on the resolved module graph, which is the real
 * backstop. If you relax a rule, relax it in both places deliberately.
 */

const NODE_BUILTINS = [
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
];

const RENDERER_FORBIDDEN = {
  paths: [
    ...NODE_BUILTINS.map((name) => ({
      name,
      message:
        'The renderer is a plain web app that must not know Electron or Node exist. Route this through the typed IPC contract in src/shared/ipc.ts.',
    })),
    {
      name: 'electron',
      message:
        'The renderer must not import Electron. Expose what you need over the preload IPC contract instead.',
    },
    {
      name: 'better-sqlite3',
      message: 'Storage lives in the main process only. Go through the IPC contract.',
    },
  ],
  patterns: [
    {
      group: ['node:*'],
      message:
        'The renderer is a plain web app that must not know Node exists. Route this through the typed IPC contract in src/shared/ipc.ts.',
    },
    {
      group: ['electron/*', '**/main/**', '**/preload/**'],
      message: 'The renderer must not reach into main- or preload-side modules.',
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // --- packages/* may never depend on the app, on Electron, or on a system module ---
  {
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'Libraries stay platform-neutral. Electron belongs to apps/desktop only.',
            },
          ],
          patterns: [
            {
              group: ['aether-forge-desktop', '@aether-forge/desktop', '**/apps/**'],
              message: 'Nothing imports apps/desktop. Dependency direction points the other way.',
            },
            {
              group: ['@aether-forge/system-*'],
              message:
                'Only apps/desktop may import a system module. Core, ui and importers must stay system-agnostic.',
            },
            {
              group: ['electron/*'],
              message: 'Libraries stay platform-neutral. Electron belongs to apps/desktop only.',
            },
          ],
        },
      ],
    },
  },

  // --- core and ui import nothing internal at all ---
  {
    files: ['packages/core/**/*.ts', 'packages/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@aether-forge/*'],
              message:
                'packages/core and packages/ui are the roots of the graph: they import nothing internal.',
            },
            {
              group: ['electron', 'electron/*'],
              message: 'core and ui never touch Electron.',
            },
          ],
        },
      ],
    },
  },

  // --- the renderer is a plain web app ---
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-imports': ['error', RENDERER_FORBIDDEN],
    },
  },

  // --- tooling scripts are plain Node ---
  {
    files: ['tools/**/*.mjs', '*.config.{js,ts,mjs,cjs}', '.dependency-cruiser.cjs'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  prettier,
);
