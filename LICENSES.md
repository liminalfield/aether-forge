# Licensing

This repository is deliberately split. The split is a permanent decision (`00-PROJECT-BRIEF.md`) —
once external contributions merge, it cannot practically be changed.

## The split

| Path                           | License                      | SPDX               |
| ------------------------------ | ---------------------------- | ------------------ |
| `apps/desktop/`                | GNU GPL v3 or later          | `GPL-3.0-or-later` |
| `packages/core/`               | MIT                          | `MIT`              |
| `packages/ui/`                 | MIT                          | `MIT`              |
| `packages/system-ironsworn/`   | MIT                          | `MIT`              |
| `packages/system-toy/`         | MIT                          | `MIT`              |
| `packages/importer-datasworn/` | MIT                          | `MIT`              |
| `tools/`                       | repo-internal, not published |

The root `LICENSE` is the GPL-3.0 text governing the distributed application. Each package under
`packages/` carries its own `LICENSE` and a matching `license` field in its `package.json`.

## Why

The application is the thing people install, and copyleft keeps it and its derivatives open. The
libraries are the reusable parts — the event log, the module contract, the Datasworn importer — and
those are more useful to the wider ecosystem under a permissive license.

**License direction follows dependency direction.** MIT packages must never depend on GPL code. This
is not a matter of discipline: `packages/*` cannot import `apps/*` at all, and `pnpm depcheck` fails
the build if anyone tries.

## Third-party dependencies

Every dependency must pass `pnpm check:licenses`, which enforces an SPDX allowlist
(`tools/check-licenses/allowlist.json`):

- **Production** dependencies ship inside the GPL-3.0-or-later application, so every one must be
  GPL-compatible.
- **Development** dependencies are build tooling and are never redistributed, so the list is broader
  — but still explicit. Nothing arrives unreviewed.

Adding an SPDX identifier to either list is a deliberate decision that belongs in its own PR, with
the reasoning written down.

## Game content

Game content is **not** covered by either license above.

- **Bundled content** is CC-BY only, carrying machine-readable attribution that the application
  renders. This keeps release artifacts freely redistributable.
- **CC-BY-NC content** is not bundled. It installs through the runtime import flow instead.
- **Licensed non-open content** (Mythic GME meaning tables, non-SRD 5e, and similar) ships as _empty
  containers_ — schema and generic slot identifiers, never the original's creative arrangement —
  alongside a user-side import tool. Imported data lands in the user's app data directory. It is
  never referenced in place and never committed.

`pnpm check:content-leak` fails any commit containing imported-content patterns. Test fixtures use
obviously-dummy data.

## No CLA

There is no Contributor License Agreement. Contributions are accepted under the license of the
directory they touch. An optional DCO sign-off (`git commit -s`) is welcome.

## Code signing

Windows releases are **unsigned by design**. The signing hook
(`apps/desktop/scripts/sign-windows.cjs`) is present and no-ops without credentials, so enabling
signing later is a configuration change rather than a pipeline change. If a free OSS signing program
(SignPath.io, Azure Trusted Signing) is ever adopted, the required disclosure goes in the README at
that time.
