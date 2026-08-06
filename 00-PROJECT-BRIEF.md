# Project Brief — Solo RPG Companion (working name: `ironlog` — rename before repo creation)

> Purpose of this document: the canonical decision record for the project. Provide it to Claude Code
> as context for all work. It should eventually seed the repo's `CLAUDE.md`. When a decision here is
> changed, change it here first.

## What we are building

A desktop application for solo tabletop roleplay, starting with **Ironsworn: Starforged** (and
classic Ironsworn), architected so that other systems (Mythic-style freeform, 5e SRD, Pathfinder 2e)
can be added later as modules without reworking the core.

The soul of the app (build in this order):

1. **Rich-prose journal** with inline entity mentions (`@`-references) and inline roll results — the
   session log is the product.
2. **Entities & connections** — NPCs, locations, factions, vows, items as a typed graph; created
   inline from prose ("create-as-you-write").
3. **Threads & narrative momentum** — open loops as first-class entities; staleness surfacing
   ("this vow hasn't moved in 6 sessions"); session start recaps ("previously on"); contextual
   oracle prompts.
4. **Tracks & clocks** — generic segmented tracks in core; ranked progress tracks, scene
   challenges (track + clock composed) via the Ironsworn module.
5. **Oracle worksheet** — pinned oracles, roll history, multiple oracle providers.
6. **Reference browser** — searchable, hyperlinked moves/oracles/assets rendered from Datasworn.
7. **Guided session-zero flow** — campaign truths, character, starship, starting sector,
   connections, background vow. Flow engine in core; flow content from the module. Resumable,
   skippable, revisitable (truths can be revised mid-campaign — as events).

Second wave: sector maps (point-crawl graph), asset cards, faction agenda view, theming per module.
Third wave: hex maps, inventory depth, Flatpak, campaign export/sharing.

## Interaction philosophy: assisted but sovereign

The app computes everything and decides nothing.

- Moves are executed structurally: app suggests stat, surfaces possibly-applicable asset bonuses as
  one-tap *suggestions*, rolls, computes the outcome, *suggests* effects (e.g. "−1 momentum").
- Every field editable, every suggestion declinable, every past event revisable via compensating
  events. The log records both what was suggested and what the player chose.
- No legality enforcement. Range validation only (a d10 can't show 12).
- **Physical dice are first-class**: every roll surface accepts typed-in die results. Roll events
  record provenance per die as a record naming where the number came from: `digital`, `manual`, or a
  named service, which carries that service's own identifiers. Everything downstream is identical
  regardless of source. Per-campaign default, per-roll override. Applies to oracle d100 rolls too.
  See `design/rolling-dice.md`.

## Core architectural commitments

### 1. Event-sourced, append-only campaign log

- The log is the source of truth; current state (character sheet, track values, entity fields) is a
  rebuildable projection.
- Core events are **generic envelopes**; system modules own their payload schemas. Core treats
  payloads as opaque (store, render via module, export) — it never interprets them.
- **Every payload schema is versioned from the first event written.** Migrations happen by
  upcasting on read, not rewriting the log.
- Prose editing batches into revision events (on save/idle); mechanical events are individual.
- True deletion (GDPR-style "actually gone") is one deliberate, explicit compaction feature — not an
  everyday operation.
- Images/blobs live OUTSIDE the log, content-addressed (hash-named) in the app data dir; events and
  entities reference hashes. Campaign export = log + entity store + blob store as one bundle.

### 2. Vocabulary rule (enforced in code review)

Core may only use words that appear in **no rulebook**: journal, entry, event, roll, table, entity,
relation, track, clock, resource, module, package, flow. If a core name comes from Starforged
(momentum, vow, asset, legacy…), the thing belongs in the module. Mechanical backstop: dependency
direction rules (below).

### 3. Module contract

System modules contribute: content packages, entity type templates, sheet definitions, move
definitions (structural, with effect *suggestions* — never exhaustive executable rules), track
types, setup (session-zero) flows, oracle providers, event payload schemas + upcasters, UI panels,
theme tokens. See `02-MODULE-CONTRACT.md`.

A **toy module** (trivial coin-flip journaling system, ~2 days of work) is built early as a canary:
core must run against both Ironsworn and the toy module in tests, permanently.

### 4. Content packages

- All game content arrives as **content packages** with a manifest: id, version, title, system
  compatibility, license (SPDX), attribution text, source (`bundled` | `imported` | `user`),
  content hash. License posture is machine-readable; UI renders attribution automatically (CC BY
  requires it).
- **Datasworn is an interchange format we consume, never our runtime model.** Use the
  `@datasworn-community/*` npm packages (the live lineage; rsek/datasworn and tbsvttr fork are
  historical), **pinned to exact versions**. One importer transforms Datasworn → our neutral
  format; it serves both build-time bundling and runtime user imports (same TS implementation).
- Bundle only CC-BY packages by default. CC-BY-NC packages (some community content) install via the
  runtime import flow instead, so release artifacts stay freely redistributable.
- Licensed non-open content (e.g. Mythic GME meaning tables, non-SRD 5e): ship **empty containers**
  (schema + generic slot identifiers, not the original's creative arrangement) + a user-side
  extraction/import tool. Imported data lands in the app data dir as installed packages — never
  referenced in place, never committed to the repo. CI guard fails if content-pattern data lands in
  a commit. Test fixtures use obviously-dummy data.
- Events that resolve a roll against a table record the content package id + version they used
  (audit trail; users may update packages mid-campaign). A roll of dice records no package: dice are
  dice, and only the resolution into a row can be affected by a package changing underneath it. See
  `design/rolling-dice.md`.

### 5. Local-first desktop

- No server, no host, ever required. SQLite (`better-sqlite3`) in the Electron main process.
- Renderer is a normal web app that does not know Electron exists: all platform-shaped concerns
  (storage/event store, file dialogs, imports, package management, blobs) behind a **small typed
  IPC contract** via preload. `contextIsolation: true`, `nodeIntegration: false`, renderer never
  touches Node APIs.
- Auto-update via `electron-updater` + GitHub Releases (works for Windows NSIS + Linux AppImage).

## Stack

- **TypeScript strict, top to bottom.** Electron + React + Vite (electron-vite scaffold). pnpm
  workspace monorepo.
- Rich text: TipTap (ProseMirror) — chosen for inline mention/embed nodes.
- Maps (wave 2): SVG-first behind a renderer interface; PixiJS only if profiling demands.
- Tests: Vitest everywhere; Playwright Electron smoke tests (launch → create campaign → roll →
  verify journal event) in the packaging pipeline.
- Design system from day one: design tokens as CSS custom properties, plus a component layer.
  A value baked into a rendered style cannot be reached by a theme loaded at runtime, which is why
  the tokens are properties rather than JavaScript values.
- **A theme is fifteen colour slots and nothing else.** Not fonts, sizes, spacing, or the shapes of
  tracks and clocks. This interface is dense with chrome and those are load-bearing in a way they are
  not around a blank page; a square tally box and a round clock are how the player's progress is told
  from the world's without reading a label. Themes are JSON, exportable and shareable. Four ship
  built in (Starforged = glacial dark, Ironsworn = ember warm), each with a light variant, and light
  is not dark inverted.
- **Nothing about a theme is corrected.** Contrast and hue separation are computed and shown to
  whoever is authoring it, never altered. The only value refused is one that is not a colour. Drawing
  something other than what a person asked for moves the refusal where they cannot see it.
- **Preferences are not themes.** Turning animation off, and choosing the journal's typeface, are
  personal and stored with the application, so they never travel attached to a palette someone
  shared. The journal's typeface is the one exception to colours-only, and it covers the writing
  surface, never the chrome around it.
- `packages/ui` takes React as a peer dependency, so the application supplies the single copy.
  Literata, Archivo and IBM Plex Mono are bundled rather than fetched, because the application is
  offline-first and the renderer's content security policy forbids another origin. Their attribution
  belongs in `LICENSES.md`. See `design/themes-and-components.md`.

## Monorepo layout

```
apps/
  desktop/            # Electron app (main / preload / renderer) — GPL-3.0-or-later
packages/
  core/               # event log, entity graph, package registry, module contract, flow engine — MIT
  ui/                 # design system components + tokens — MIT
  system-ironsworn/   # Ironsworn + Starforged module — MIT (content via Datasworn pkgs, CC-BY)
  system-toy/         # canary module — MIT
  importer-datasworn/ # Datasworn → neutral format — MIT
tools/                # repo-internal scripts (license checker, content-leak guard) — not published
```

Dependency direction is law, enforced by dependency-cruiser + ESLint import rules:

- `core` imports from nothing internal (and never from Electron).
- `system-*` and `importer-*` import `core` only.
- `ui` imports nothing internal (tokens/components only).
- `apps/desktop` imports everything; nothing imports it.
- Renderer code never imports Node built-ins or Electron main-side modules.

## Licensing

- App (`apps/desktop`): **GPL-3.0-or-later**. Libraries (`packages/*`): **MIT** (each with its own
  LICENSE + package.json `license` field). MIT packages must never depend on GPL code (direction is
  enforced by the dependency rules; license direction follows dependency direction).
- No CLA. Optional DCO. Licensing is effectively permanent once external PRs merge — decisions are
  final at repo creation.
- CI license checker with an allowlist (MIT, Apache-2.0, BSD-2/3, ISC, 0BSD, CC-BY-4.0 for content,
  GPL-compatible only) fails PRs introducing anything else.
- Windows code signing: **not now**. Architected as a signing hook that no-ops without credentials.
  If ever wanted: SignPath.io free OSS program or Azure Trusted Signing. Unsigned→unsigned
  auto-update works; SmartScreen click-through is accepted.

## Distribution targets

- Linux: **AppImage** (primary; only Linux target with electron-updater support), **deb**, and an
  **AUR `-bin` package** (PKGBUILD repackaging the released artifact; published from CI via SSH
  push to AUR — separate release step, not an electron-builder target). Flatpak: fast-follow after
  filesystem access patterns stabilize.
- Windows: **NSIS** installer, unsigned.
- Releases: release-please (conventional commits → version PR → tag → packaging matrix → GitHub
  Release). Nightly packaging run on main so packaging breakage is discovered same-day.

## Things Claude Code must never do

- Put rulebook vocabulary in `packages/core` or `packages/ui`.
- Let the renderer import Node/Electron APIs directly.
- Interpret Datasworn types anywhere outside `importer-datasworn`.
- Write an event without a versioned payload schema.
- Commit game content that is not CC-BY/MIT/ORC-licensed, or any user-imported content.
- Add a dependency without it passing the license allowlist.
- Turn a suggestion into enforcement (no "illegal state" blocking in mechanics UI).
