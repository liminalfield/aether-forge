/**
 * Dependency direction is law (00-PROJECT-BRIEF.md):
 *
 *   core                 imports nothing internal, and never Electron
 *   ui                   imports nothing internal
 *   system-* / importer-* import core only
 *   apps/desktop         imports everything; nothing imports it
 *   renderer             never imports Node built-ins or Electron
 *
 * ESLint enforces the same arrows on import specifiers for fast feedback.
 * This file enforces them on the *resolved* module graph, which is what
 * actually ships. Scan roots are src/ directories; resolved targets may land in
 * a package's dist/, so every path regex matches a package root rather than a
 * specific subdirectory.
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make the event-sourcing graph impossible to reason about.',
      from: {},
      to: { circular: true },
    },

    {
      name: 'core-imports-nothing-internal',
      severity: 'error',
      comment: 'packages/core is the root of the graph. It depends on no other workspace package.',
      from: { path: '^packages/core/' },
      to: { path: '^(packages/(?!core/)|apps/)' },
    },
    {
      name: 'ui-imports-nothing-internal',
      severity: 'error',
      comment:
        'packages/ui is tokens and components only. It depends on no other workspace package.',
      from: { path: '^packages/ui/' },
      to: { path: '^(packages/(?!ui/)|apps/)' },
    },

    {
      name: 'modules-import-core-only',
      severity: 'error',
      comment:
        'system-* and importer-* may depend on core and nothing else internal: not on ui, not on each other, not on the app.',
      from: { path: '^packages/(system-|importer-)' },
      to: {
        path: '^(packages/|apps/)',
        pathNot: ['^packages/core/', '^packages/(system-|importer-)[^/]+/'],
      },
    },

    {
      name: 'nothing-imports-the-app',
      severity: 'error',
      comment: 'apps/desktop is a leaf. Dependency direction points the other way.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },

    {
      name: 'only-the-app-imports-system-modules',
      severity: 'error',
      comment: 'Only apps/desktop composes system modules. Libraries stay system-agnostic.',
      from: { path: '^packages/', pathNot: '^packages/system-[^/]+/' },
      to: { path: '^packages/system-' },
    },

    {
      name: 'libraries-never-import-electron',
      severity: 'error',
      comment: 'Everything under packages/ stays platform-neutral. Electron is app territory.',
      from: { path: '^packages/' },
      to: {
        path: '^(electron|electron-updater)$',
        dependencyTypes: ['npm', 'npm-dev', 'npm-peer'],
      },
    },
    {
      name: 'core-never-imports-node-builtins',
      severity: 'error',
      comment:
        'core is a pure kernel: no filesystem, no process, no platform. Platform concerns live behind the IPC contract in apps/desktop.',
      from: { path: '^packages/core/' },
      to: { dependencyTypes: ['core'] },
    },

    {
      name: 'renderer-never-imports-node',
      severity: 'error',
      comment:
        'The renderer is a plain web app that does not know Electron exists. Everything platform-shaped goes through the typed IPC contract.',
      from: { path: '^apps/desktop/src/renderer/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'renderer-never-imports-electron-or-main',
      severity: 'error',
      comment: 'The renderer talks to main only through the preload IPC contract.',
      from: { path: '^apps/desktop/src/renderer/' },
      to: {
        path: ['^(electron|electron-updater|better-sqlite3)$', '^apps/desktop/src/(main|preload)/'],
      },
    },

    {
      name: 'no-unresolvable',
      severity: 'error',
      comment: 'An import that cannot be resolved is a broken build waiting to happen.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|coverage|out)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
      mainFields: ['module', 'main', 'types'],
      extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.d.ts'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
