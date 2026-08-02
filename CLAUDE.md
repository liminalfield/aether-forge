# CLAUDE.md — working rules for this repository

Distilled from `00-PROJECT-BRIEF.md`, which is the canonical decision record. **When a decision here
changes, change it in the brief first.** `02-MODULE-CONTRACT.md` holds the contract design.

## What this is

A local-first desktop application for solo tabletop roleplay, starting with Ironsworn: Starforged,
architected so other systems arrive as modules without reworking the core. Event-sourced,
append-only campaign log; current state is a rebuildable projection.

**The app computes everything and decides nothing.** Moves are executed structurally: the app
suggests, rolls, computes, and proposes effects. Every field is editable, every suggestion
declinable, every past event revisable via compensating events.

## Things to never do

- Put rulebook vocabulary in `packages/core` or `packages/ui`.
- Let the renderer import Node/Electron APIs directly.
- Interpret Datasworn types anywhere outside `importer-datasworn`.
- Write an event without a versioned payload schema.
- Commit game content that is not CC-BY/MIT/ORC-licensed, or any user-imported content.
- Add a dependency without it passing the license allowlist.
- Turn a suggestion into enforcement (no "illegal state" blocking in mechanics UI).

## The vocabulary rule

`core` and `ui` may only use words that appear in **no rulebook**: journal, entry, event, roll,
table, entity, relation, track, clock, resource, module, package, flow. If a core name comes from
Starforged (momentum, vow, asset, legacy…), the thing belongs in a system module.

`oracle` is allowed — it is the domain-generic term chosen for tables.

Enforced in code review; `pnpm check:vocabulary` is the mechanical backstop. A line ending in
`vocabulary-check-ignore` is exempt.

## Dependency direction is law

```
core                  imports nothing internal, and never Electron
ui                    imports nothing internal
system-* / importer-* import core only
apps/desktop          imports everything; nothing imports it
renderer              never imports Node built-ins or Electron
```

License direction follows dependency direction: `packages/*` are MIT, `apps/desktop` is
GPL-3.0-or-later, and **MIT packages must never depend on GPL code**.

Enforced twice, and both must stay in step:

- `eslint.config.js` — on import specifiers, for fast editor feedback.
- `.dependency-cruiser.cjs` — on the resolved module graph. This is the real backstop.

## Layout

```
apps/desktop/            Electron app (main / preload / renderer) — GPL-3.0-or-later
packages/core/           event log, entity graph, package registry, contract, flow engine — MIT
packages/ui/             design tokens + component layer — MIT
packages/system-ironsworn/  Ironsworn + Starforged module — MIT
packages/system-toy/     canary module — MIT
packages/importer-datasworn/  Datasworn → neutral format — MIT
tools/                   repo-internal guard scripts — not published
```

## Commands

```bash
pnpm install
pnpm build            # tsc -b for libraries, then electron-vite for the app
pnpm dev              # builds libraries, then launches the Electron shell
pnpm test             # vitest, whole workspace
pnpm lint             # eslint
pnpm depcheck         # dependency-cruiser — the dependency-direction law
pnpm check:licenses   # SPDX allowlist over the dependency tree
pnpm check:content-leak
pnpm check:vocabulary
pnpm check:all        # lint + depcheck + all three guards
pnpm package          # electron-builder artifacts for the current platform
```

`pnpm dev` builds the libraries first because the renderer imports `@aether-forge/ui` through its
`exports` field, which resolves to `dist/`.

## Conventions that matter

- **TypeScript strict everywhere**, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Do not weaken these per-package.
- **Every event payload schema is versioned from the first event written.** Migrations happen by
  upcasting on read, never by rewriting the log.
- **Physical dice are first-class.** Every roll surface accepts typed-in die results; roll events
  record provenance per die (`digital` | `manual`). Everything downstream is identical regardless of
  source.
- **Content packages carry machine-readable license posture** (SPDX + attribution). Roll events
  record the package id and version they rolled against.
- **Conventional commits**, enforced on PR titles — release-please derives versions from them.
- Dependency versions are **pinned exactly** (no `^`). `typescript` and `vitest` come from the pnpm
  catalog in `pnpm-workspace.yaml`.
- The toy module is a permanent canary: core must run against **both** `system-toy` and
  `system-ironsworn` in tests. A contract change that breaks the toy is a contract bug.

## Bootstrap-era notes

These are true now and worth revisiting as the app grows:

- `packages/ui` is tokens only so far — no components, no React dependency yet.
- ESLint runs without type-aware rules, to keep the config simple while the codebase is small.
  Turning on `recommendedTypeChecked` means wiring `projectService` and including test files.
- `better-sqlite3` v13 ships N-API prebuilds and needs **no** per-Electron rebuild. Do not
  reintroduce `electron-builder install-app-deps` unless a dependency actually requires it.
- Electron v43 has **no postinstall**. The binary downloads lazily the first time something resolves
  `require('electron')` — so the first `pnpm dev` on a fresh clone pauses to fetch ~220 MB, and CI
  jobs that only build never fetch it at all. `ELECTRON_SKIP_BINARY_DOWNLOAD` is obsolete; do not
  add it back.
- Datasworn packages are not wired up yet. When they are: pin exact versions, exclude them from
  Renovate (already configured), and treat any bump as a content-model change with its own PR and
  regenerated importer golden files.
