# Contributing

Thanks for looking. This project has a few rules that are stricter than usual, and they exist for
reasons written down in `00-PROJECT-BRIEF.md`. Reading [CLAUDE.md](CLAUDE.md) first will save you a
review round — it is the short version of everything below and applies to human and AI contributors
alike.

## Getting set up

```bash
corepack enable          # provides pnpm 11.18.0
pnpm install
pnpm dev                 # builds the libraries, then launches the Electron shell
```

Node 22.22.3 (see `.nvmrc`). Before opening a PR:

```bash
pnpm build && pnpm test && pnpm check:all
```

That is exactly what CI runs, so a green local run means a green PR.

## The rules that will get a PR sent back

### 1. Dependency direction

```
core                  imports nothing internal, and never Electron
ui                    imports nothing internal
system-* / importer-* import core only
apps/desktop          imports everything; nothing imports it
renderer              never imports Node built-ins or Electron
```

Enforced by `pnpm depcheck` and by ESLint. If you need to cross an arrow, the design is wrong —
raise it as an issue before writing the code.

### 2. The vocabulary rule

`packages/core` and `packages/ui` may only use words that appear in **no rulebook**: journal, entry,
event, roll, table, entity, relation, track, clock, resource, module, package, flow. If a name comes
from a game system, the thing it names belongs in a system module.

`oracle` is fine — it is the generic term this project uses for tables.

### 3. Events are versioned and append-only

Every event payload schema carries a `schemaVersion` from the very first event written. Schema
changes are handled by **upcasting on read**. Never rewrite the log, and never add an event type
without a version.

### 4. Suggestions are never enforcement

The app computes everything and decides nothing. Mechanics UI may suggest, prefill and compute — it
may never block a state as illegal. Range validation only (a d10 cannot show 12).

### 5. Content and licensing

- No game content that is not CC-BY, MIT or ORC-licensed.
- No user-imported content, ever — `pnpm check:content-leak` will catch it, and git history is
  forever.
- Test fixtures use obviously-dummy data.
- New dependencies must pass `pnpm check:licenses`. Production dependencies ship inside the
  GPL-3.0-or-later app and must be GPL-compatible.

See [LICENSES.md](LICENSES.md) for the full split.

## Commits and PRs

**Conventional commits**, enforced on PR titles — release-please derives the version and changelog
from them, so a non-conventional title silently breaks releases.

```
feat: add oracle roll history panel
fix(core): upcast v1 entry payloads correctly
deps: bump electron toolchain
docs: explain the vocabulary rule
```

Breaking changes: `feat!:` or a `BREAKING CHANGE:` footer.

PRs are squash-merged, so **the PR title becomes the commit message**. Keep it accurate.

### Sign-off

There is no CLA. A DCO sign-off (`git commit -s`) is welcome but not required. Contributions are
accepted under the license of the directory they touch.

## Dependencies

Versions are **pinned exactly** — no `^`, no `~`. `typescript` and `vitest` come from the pnpm
catalog in `pnpm-workspace.yaml`; add shared tooling there rather than duplicating a version across
packages.

pnpm blocks dependency install scripts by default. If a new dependency needs one, add it to
`allowBuilds` in `pnpm-workspace.yaml` **and say in the PR what the script does**.

## Releases

You do not need to do anything. release-please maintains a release PR from the commits on `main`;
merging it bumps the version, writes the changelog, tags `v<version>` and triggers the packaging
matrix, which attaches AppImage, deb, NSIS installer, `SHA256SUMS` and build-provenance attestations
to the GitHub Release.

Packaging also runs nightly on `main`, because packaging breakage is invisible to PR validation.

## Testing

Vitest across the workspace. Two testing commitments are permanent:

- Core runs its contract-consuming paths against **both** `system-toy` and `system-ironsworn`. If a
  contract change breaks the toy, the contract is wrong — not the toy.
- Importer output is covered by golden files. A Datasworn version bump regenerates them **in the
  same PR**.

## Reporting bugs

Include your OS, the app version (shown in the window), and how you installed it — AppImage, deb or
NSIS. If it involves a campaign, say roughly how many events are in it; event-sourcing bugs tend to
be about history length.
