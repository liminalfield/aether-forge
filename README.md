# Aether Forge

A local-first desktop companion for **solo tabletop roleplay**, starting with
[Ironsworn: Starforged](https://www.ironswornrpg.com/) and classic Ironsworn, architected so other
systems can arrive later as modules without reworking the core.

> **Status: bootstrap.** The repository is a working monorepo, build pipeline and release pipeline.
> There are no application features yet: the shell opens a window and reports its version. Feature
> work starts once the pipeline is green (see `01-BOOTSTRAP-PLAN.md`).

## What it is meant to be

The session log is the product. A rich-prose journal with inline entity mentions and inline roll
results; NPCs, locations, factions and vows as a typed graph created inline while you write; open
narrative threads surfaced when they go stale; tracks, clocks and oracles at hand.

**Assisted but sovereign. The app computes everything and decides nothing.** It suggests a stat,
surfaces applicable bonuses as one-tap suggestions, rolls, computes the outcome and _proposes_
effects. Every field is editable, every suggestion declinable, every past event revisable. Nothing
is ever blocked as "illegal".

**Physical dice are first-class.** Every roll surface accepts typed-in die results, recorded with
per-die provenance. Everything downstream behaves identically whether the die was digital or
plastic.

**Local-first.** No server, no account, no host, ever. SQLite on your own disk.

## Licensing

This repository is deliberately split, and the split is permanent:

| Path            | License              | Why                                              |
| --------------- | -------------------- | ------------------------------------------------ |
| `apps/desktop/` | **GPL-3.0-or-later** | The application people install.                  |
| `packages/*`    | **MIT**              | Libraries others should be able to reuse freely. |
| `tools/`        | repo-internal        | Never published.                                 |

MIT packages must never depend on GPL code, because license direction follows dependency direction,
which is mechanically enforced (`pnpm depcheck`). Each package carries its own `LICENSE` and
`license` field. The root `LICENSE` is the GPL-3.0 text that governs the distributed application.

Game content is **not** licensed under either. Bundled content is CC-BY and carries machine-readable
attribution rendered in-app. Non-open content is never committed: the app ships empty containers
plus a user-side import tool, and imported data lives in your app data directory. A CI guard
(`pnpm check:content-leak`) fails any commit that would break this.

There is **no CLA**. Contributions are accepted under the license of the directory they touch.

## Requirements

- **Node.js 22.22.3** (see `.nvmrc`)
- **pnpm 11.18.0**, via corepack: `corepack enable`

## Getting started

```bash
pnpm install
pnpm dev            # builds the libraries, then launches the Electron shell
```

## Commands

```bash
pnpm build            # tsc -b for libraries, then electron-vite for the app
pnpm test             # vitest across the workspace
pnpm lint             # eslint
pnpm depcheck         # dependency-cruiser: enforces dependency direction
pnpm check:all        # lint + depcheck + licenses + content-leak + vocabulary
pnpm package          # electron-builder artifacts for the current platform
```

## Downloads

Releases are built by CI for Linux and Windows:

- **Linux AppImage** (recommended): the only Linux target with working auto-update.
- **Linux .deb**: installs cleanly but **does not auto-update**; update via new releases.
- **Windows NSIS installer**: **unsigned by design**. Windows SmartScreen will warn on first run;
  choose _More info → Run anyway_. Verify the download against `SHA256SUMS` on the release if you
  would rather not take our word for it.

Every release carries `SHA256SUMS` and GitHub build-provenance attestations.

macOS is not currently built. The architecture has nothing macOS-specific in it, but nobody is
testing or notarizing there yet.

## Repository layout

```
apps/desktop/                 Electron app (main / preload / renderer)
packages/core/                event log, entity graph, package registry, contract, flow engine
packages/ui/                  design tokens and component layer
packages/system-ironsworn/    Ironsworn + Starforged module
packages/system-toy/          canary module, keeps the module contract honest
packages/importer-datasworn/  Datasworn → neutral content packages
tools/                        repo-internal guard scripts
```

The **toy module** is not a joke: a trivial coin-flip system that core's test suite runs against
permanently, alongside Ironsworn. A contract change the toy cannot implement trivially is a contract
bug.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Working rules for the codebase (the vocabulary rule, the
dependency-direction law, and the things never to do) are in [CLAUDE.md](CLAUDE.md), which applies
to human and AI contributors alike.

## Acknowledgements

Ironsworn and Ironsworn: Starforged are by Shawn Tomkin. Game content is consumed via the
[Datasworn](https://github.com/rsek/datasworn) interchange format; bundled content is used under
CC-BY with attribution rendered in the application.
