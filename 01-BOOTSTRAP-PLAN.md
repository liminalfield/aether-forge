# Bootstrap Plan — repo, tooling, CI (hand this to Claude Code, execute phases in order)

> Goal of the bootstrap: a monorepo that builds a hello-world Electron shell, validates every PR on
> Linux, and produces unsigned AppImage + deb + NSIS artifacts from a matrix — BEFORE any feature
> code. Minimum viable pipeline first; app features come after.
>
> Read `00-PROJECT-BRIEF.md` first. It is the decision record; this file is the task list.
> Verify current stable versions of all tools at execution time (pin exact versions in the repo;
> the versions named here are indicative, not gospel).
>
> Checked boxes were marked retrospectively on 7 August 2026, after the work had shipped without
> this file being kept up to date. Two Phase 4 items are still open and are annotated inline.
> Feature work (Phase 5) has since begun and is tracked through `design/` and GitHub issues, not
> here; this file is now a record of the bootstrap, not a live task list.

## Phase 0 — repo creation (manual, by the owner)

- [x] Pick the real project name (brief uses `ironlog` as placeholder). Check name availability on
      npm (for the MIT packages) and AUR before committing to it.
- [x] Create the GitHub repo, default branch `main`, no license file yet (added correctly in
      Phase 1 because it's per-package).
- [x] Branch protection on `main`: require PR + passing checks. Conventional-commit PR titles
      (enforced in CI later).

## Phase 1 — monorepo skeleton

- [x] `pnpm` workspace (`pnpm-workspace.yaml`) with the layout from the brief:
      `apps/desktop`, `packages/{core,ui,system-ironsworn,system-toy,importer-datasworn}`, `tools/`.
      Every package gets a real `package.json` now, even if the source is one placeholder file —
      the dependency-direction rules need the graph to exist.
- [x] Root tooling:
  - TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), project
    references so `tsc -b` builds the graph.
  - ESLint (flat config) + Prettier. Add `eslint-plugin-import` rules banning: renderer →
    node/electron imports; `packages/*` → `apps/*`; anything → `system-*` except `apps/desktop`.
  - dependency-cruiser with the arrows from the brief, run as `pnpm depcheck` and in CI.
  - Vitest at the root, per-package test scripts, one trivial passing test per package.
  - `.editorconfig`, `.nvmrc`/`engines` (current active LTS Node), `packageManager` field pinning
    pnpm (corepack).
- [x] Licenses: `LICENSE` (GPL-3.0-or-later) in `apps/desktop` and repo root pointing at the split;
      `LICENSE` (MIT) in each `packages/*`; correct `license` field in every package.json.
- [x] `tools/check-licenses`: script (can use `license-checker-rseidelsohn` or similar) with the
      allowlist from the brief; wired as `pnpm check:licenses`.
- [x] `tools/check-content-leak`: script that fails if files matching imported-content patterns
      (e.g. `**/imported/**`, `*.userpkg.json`, configurable list) are staged/committed. Wire into
      CI; optionally as a pre-commit hook (lefthook or husky — owner's preference, keep it light).
- [x] `CLAUDE.md` at root: distilled from `00-PROJECT-BRIEF.md` (the "must never do" list verbatim,
      the vocabulary rule, the dependency arrows, the commands).
- [x] `README.md`: what it is, license split, build instructions, SignPath disclosure placeholder
      (required if the free OSS signing program is ever used).

Acceptance: `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm depcheck` all green.

## Phase 2 — Electron shell

- [x] Scaffold `apps/desktop` with **electron-vite** (main / preload / renderer, React, TS).
- [x] Security posture from the first commit: `contextIsolation: true`, `nodeIntegration: false`,
      `sandbox: true` for the renderer; a typed IPC contract module shared between preload and
      renderer (`apps/desktop/src/shared/ipc.ts`) — start with `app:getVersion` as the only channel
      to prove the pattern.
- [x] `better-sqlite3` in main only. Prove native-module rebuild works locally
      (`electron-builder install-app-deps`). One migration-capable open-database function; store
      the DB under `app.getPath('userData')/campaigns/`. **Done, except the rebuild:**
      `better-sqlite3` v13 ships N-API prebuilds, so no per-Electron rebuild exists to prove. See
      "Verify, do not remember" in `CLAUDE.md`.
- [x] Renderer: blank React app rendering the app version fetched over IPC. No feature code.
- [x] electron-builder config (`electron-builder.yml`): appId, productName, artifact naming,
      targets — Linux: `AppImage`, `deb`; Windows: `nsis`. `publish: github` (for electron-updater
      later). Signing hook file present but no-op without env credentials.

Acceptance: `pnpm --filter desktop dev` opens the shell; `pnpm --filter desktop build && pnpm
--filter desktop package` produces an AppImage locally on Linux.

## Phase 3 — CI (GitHub Actions)

Create three workflows. Sketches below are starting points — Claude Code should verify current
action versions and electron-builder flags at execution time.

### `.github/workflows/pr-validate.yml` — every PR, ubuntu only, fast

```yaml
name: validate
on:
  pull_request:
  push: { branches: [main] }
concurrency: { group: validate-${{ github.ref }}, cancel-in-progress: true }
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm lint
      - run: pnpm depcheck
      - run: pnpm test
      - run: pnpm check:licenses
      - run: pnpm check:content-leak
  commit-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5   # conventional PR titles for release-please
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

### `.github/workflows/package.yml` — matrix packaging; on main, tags, nightly, manual

```yaml
name: package
on:
  push: { branches: [main], tags: ['v*'] }
  schedule: [{ cron: '0 3 * * *' }]   # nightly: discover packaging breakage same-day
  workflow_dispatch:
jobs:
  package:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm --filter desktop package        # electron-builder; rebuilds better-sqlite3 per-platform
      - run: pnpm --filter desktop test:e2e       # Playwright Electron smoke (add in Phase 4; no-op until then)
      - uses: actions/upload-artifact@v4
        with:
          name: dist-${{ matrix.os }}
          path: apps/desktop/dist/*.{AppImage,deb,exe,yml,blockmap}
  publish:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: package
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/download-artifact@v4
      - name: checksums
        run: sha256sum dist-*/* > SHA256SUMS
      - uses: softprops/action-gh-release@v2
        with: { files: 'dist-*/*,SHA256SUMS' }
```

(Alternative accepted: let electron-builder itself publish to the release with `--publish always`
on tag builds; pick one mechanism, not both, so `latest.yml`/update metadata stays consistent.)

### `.github/workflows/release-please.yml`

```yaml
name: release-please
on: { push: { branches: [main] } }
jobs:
  release:
    runs-on: ubuntu-latest
    permissions: { contents: write, pull-requests: write }
    steps:
      - uses: googleapis/release-please-action@v4
        with: { release-type: node }   # monorepo config in release-please-config.json
```

Configure release-please for the monorepo: the app version drives tags (`v*`); package versions can
follow later when/if the MIT packages publish to npm (not a launch requirement).

- [ ] Renovate config (`renovate.json`): weekly, grouped minor/patch, pinned Datasworn packages
      excluded from auto-bump (they change the content model — manual only). **Dropped by
      decision, 6 August 2026.** Dependency updates are manual; the reasoning is recorded in
      `CLAUDE.md` under "Current state".
- [x] `osv-scanner` or `pnpm audit --audit-level=high` step in pr-validate (non-blocking at first).

Acceptance: a PR shows green validate; merging to main produces artifacts on both OSes; pushing a
`v0.0.1` tag (via release-please PR merge) yields a GitHub Release with AppImage + deb + exe +
SHA256SUMS + update metadata.

## Phase 4 — pipeline completions (before feature work starts in earnest)

- [x] Playwright Electron smoke test: launch packaged app, assert window title + IPC round-trip.
      Wire into package.yml (it's the only place packaging bugs are visible).
- [ ] `electron-updater` wiring in main (GitHub provider), behind a "check for updates" menu item.
      Test with two consecutive tagged releases. **Still open as of 7 August 2026.** The
      electron-builder config publishes to GitHub and AppImage is the self-updating channel, but
      nothing in main checks for updates yet.
- [ ] AUR: create `tools/aur/PKGBUILD.template` (`<name>-bin`, repackaging the released .deb or an
      added tarball target) + a `publish-aur` job on release (SSH key secret; e.g.
      KSXGitHub/github-actions-deploy-aur or manual git push script). Owner registers the AUR
      package name.
- [x] GitHub attestation (`actions/attest-build-provenance`) on release artifacts — cheap, do it.
- [x] Issue/PR templates, `CONTRIBUTING.md` (mention DCO if adopted, conventional commits,
      dependency/license rules).

## Phase 5 — first feature milestone (separate plan)

Only after Phases 1–4 are green: core event log + entity store + the toy module + minimal journal
UI, per `02-MODULE-CONTRACT.md`. Do not start this in the bootstrap PRs.

## Known chores & gotchas (so they don't surprise)

- `better-sqlite3` must be rebuilt per Electron version — `electron-builder install-app-deps`
  handles it; keep Electron and better-sqlite3 bumps in the same PR. **Wrong as of v13**, which
  ships N-API prebuilds; no rebuild happens and `install-app-deps` is deliberately absent. Keeping
  the bumps in one PR is still right.
- electron-builder Linux artifacts need `--no-sandbox` handling on some distros via AppImage;
  accept defaults first, revisit on bug reports.
- The `deb` target does not auto-update; release notes should say AppImage is the self-updating
  channel on Linux.
- Windows is unsigned by design: SmartScreen warning is expected and accepted (see brief).
- Datasworn packages: pin exact versions; treat any bump as a content-model change with its own PR
  and importer golden-file test updates.
