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
    {
      group: ['@aether-forge/system-*', '@aether-forge/importer-*'],
      message:
        'The window is told what to draw and never knows which game it is drawing. Describe what you need as a view on the IPC contract in src/shared/ipc.ts, so a second system can arrive without touching the window.',
    },
  ],
};

/** A colour written into a component, which a theme can never reach. */
const NO_LITERAL_COLOUR = {
  selector: 'Literal[value=/^\\s*(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\(|color-mix\\()/]',
  message:
    'Colour belongs in a theme. Use slot(group, name) from @aether-forge/ui, and add the colour to packages/ui/src/theme.ts if it needs a slot.',
};

/**
 * A size written into a component, which the scale can never reach.
 *
 * Units that describe content rather than the design are left alone: `ch`
 * sizes a column by the prose in it, and percentages and viewport units are
 * relationships rather than measurements.
 */
const NO_LITERAL_SIZE = {
  selector: 'Literal[value=/^\\s*[0-9.]+(px|r?em)\\s*$/]',
  message:
    'Size belongs in the scale. Use tokens.space, tokens.type, tokens.radius, tokens.border, tokens.layout or tokens.box from @aether-forge/ui, and add the value to packages/ui/src/tokens.ts if the design needs a new one.',
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

  // --- colour and size belong in the design system, not in a component ---
  //
  // A theme reaches components as CSS custom properties, which is what lets a
  // theme loaded from a file change code that has already rendered. A colour
  // written into a component is invisible to that, and the screen it is on
  // stops responding to the theme without anything saying so. Size is the same
  // argument one step down: a scale nobody is held to stops being a scale, and
  // within a week of the design system landing components were writing '14px'
  // by hand.
  //
  // Both live in one block because ESLint flat config lets a later block
  // replace an earlier one's rule outright. Two blocks each declaring
  // no-restricted-syntax would leave only the second one running, and the
  // first guard would be gone with nothing saying so. The two exemptions below
  // re-declare the rule with the other selector, for the same reason.
  //
  // See design/themes-and-components.md.
  {
    files: ['packages/ui/src/**/*.{ts,tsx}', 'apps/desktop/src/renderer/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', NO_LITERAL_COLOUR, NO_LITERAL_SIZE],
    },
  },

  // packages/ui/src/theme.ts is where the built-in themes live: colour is its
  // whole job. It is still held to the size scale.
  {
    files: ['packages/ui/src/theme.ts'],
    rules: { 'no-restricted-syntax': ['error', NO_LITERAL_SIZE] },
  },

  // packages/ui/src/tokens.ts is where the scale lives: size is its whole job.
  // It is still held to the colour rule.
  {
    files: ['packages/ui/src/tokens.ts'],
    rules: { 'no-restricted-syntax': ['error', NO_LITERAL_COLOUR] },
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
