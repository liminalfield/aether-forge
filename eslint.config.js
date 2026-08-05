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
      // A design-tool export and its runtime, vendored as a visual reference and
      // never built or shipped. Linting someone else's generated bundle tells us
      // nothing and fails loudly.
      'design/ux-ui-design-handoff/**',
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
            ...NODE_BUILTINS.map((name) => ({
              name,
              message:
                'Libraries stay platform-neutral. A system module works out state in the main process, where there is no page and no window; anything from the outside world is handed in as data by apps/desktop.',
            })),
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
              group: ['node:*'],
              message:
                'Libraries stay platform-neutral. Anything from the outside world is handed in as data by apps/desktop.',
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
          // Repeated from the packages/** rule above rather than inherited,
          // because ESLint replaces a rule rather than merging it. Anything
          // missing here is simply unguarded in core and ui.
          paths: NODE_BUILTINS.map((name) => ({
            name,
            message: 'core and ui are pure: no filesystem, no process, no platform.',
          })),
          patterns: [
            {
              // The app name is listed alongside the scope because this rule
              // REPLACES the packages/** rule rather than merging with it, so
              // anything missing here is simply unguarded in core and ui.
              group: ['@aether-forge/*', 'aether-forge-desktop', '**/apps/**'],
              message:
                'packages/core and packages/ui are the roots of the graph: they import nothing internal.',
            },
            {
              group: ['electron', 'electron/*', 'node:*'],
              message: 'core and ui never touch Electron, and never touch the platform.',
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
