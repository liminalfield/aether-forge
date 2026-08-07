# CLAUDE.md

The working contract for this repository. Read it fully before making changes.

This file governs how work is done: pace, standards, what is decided by whom, and what is forbidden.
It does not restate the architecture. Those live elsewhere and each fact has one home:

| Document                | Holds                                                                      |
| ----------------------- | -------------------------------------------------------------------------- |
| `00-PROJECT-BRIEF.md`   | The canonical decision record. Architecture, scope, licensing.             |
| `02-MODULE-CONTRACT.md` | The module contract design, with its stress tests and open questions.      |
| `design/<feature>.md`   | The design record for one feature. Written before its issues exist.        |
| `CONTRIBUTING.md`       | The same rules addressed to an outside contributor.                        |
| `LICENSES.md`           | The license split and its reasoning.                                       |
| GitHub issues           | What is being built, in what order. An Epic per feature, Tasks beneath it. |
| This file               | How we work, and the bar the work has to clear.                            |

Where this file and the brief disagree about a decision, the brief wins and this file is stale.
Where either disagrees with the code, find out which is wrong before changing anything.

## What Aether Forge is

A local-first desktop application for solo tabletop roleplay, starting with Ironsworn: Starforged
and architected so other game systems arrive as modules without reworking the core. It is
open-source, non-commercial, and meant to be a serious piece of work. The architecture and code
quality should hold up to scrutiny from an experienced TypeScript reviewer. Nothing here should read
as a weekend hack.

The session log is the product. Everything else exists to serve a person writing about a game they
are playing alone.

## How we work together

This is the most important section.

### Pace and checkpoints

Build incrementally and legibly.

- Work in small, single-purpose steps. One component or concept per step. Never build a whole
  subsystem in one pass.
- Every step ends with the tree building, tested, linted and runnable. Never leave it broken between
  steps.
- Before a step, say in plain language what you are about to do and why. After it, say what changed.
  The maintainer should be able to follow the reasoning without reverse-engineering a diff.
- Stop at each checkpoint for review. Do not start the next step until the maintainer approves.
- One focused commit per step, with a message that explains the why. The git history is meant to be
  a readable record of how the project was built.
- Get something observable working early, so progress can be inspected rather than trusted.
- Write tests as part of the step, not afterward. A step is finished when its tests pass and
  `pnpm check:all` is clean.

The maintainer will usually hand over one step at a time. Respect that pace even when the next three
steps are obvious.

### What is the maintainer's to decide

Ask, and wait, before:

- Changing anything recorded in `00-PROJECT-BRIEF.md`. Propose the change to the brief first.
- Adding a dependency of any weight, changing a pinned version, or touching the license allowlist.
- Anything outward-facing: creating or deleting repositories, cutting a release, publishing a
  package, force-pushing, changing branch protection, opening or closing issues and pull requests on
  the maintainer's behalf.
- Work that would take more than one step, or that cannot be reviewed in one sitting.
- Any change to this file.

Decide without asking:

- Implementation detail inside an approved step: naming within a module, file organisation, how a
  test is structured, which helper to extract.
- Obvious, local refactors that do not cross a package seam or change behaviour.
- Fixing something clearly broken that is in the way of the current step, if it is small. Mention it
  in the step report.

When two readings of a request would lead to materially different work, ask rather than guess. When
a routine judgement call has an obvious default, take it and say which default you took.

### Disagreement

Disagree in a sentence or two, then do what was decided.

If a request looks wrong, say so once, plainly, with the specific reason and the alternative you
would pick. If the maintainer restates the request, that is the decision. Build it properly, and
note in the step report which assumption you built on. Do not relitigate, and do not quietly build a
compromise nobody asked for.

Silent compliance with something you believe is a mistake is a worse failure than pushing back.

### Reporting honestly

The maintainer relies on your report to know the state of the project. That reliance only works if
the report is exact.

- Never claim something is verified unless you ran it and read the output. "Should work" and
  "verified" are different words.
- If a test fails, say so and show the output. If a step is partially done, say which part.
- If you skipped something, say what and why, before being asked.
- Never invent command output, file contents, or the result of a check you did not run.
- If you realise a previous report was wrong, correct it plainly and move on. No preamble, no
  self-flagellation.
- Distinguish what you observed from what you inferred.

A green check is evidence about the thing it checks and nothing more.

## How work is planned and tracked

Every substantive change is traceable: design record, agreed design, issues, commits that reference
them. The path is the same every time.

### 1. The design record

A feature of any size begins with a design document at `design/<feature>.md`, written and agreed
before any issue exists and before any code is written.

A design record is not a manual. It states what is settled and why, records what was excluded and
the reasoning, and preserves superseded proposals rather than deleting them. It is written to be
argued with, and it may state disagreement. When the code and a design record diverge, the code is
right and the record needs a status annotation saying so.

`00-PROJECT-BRIEF.md` is not a design record. It holds decisions that bind the whole project.
`design/` holds the thinking for one feature. A design record that wants to change a project-wide
decision has to change the brief, which is the maintainer's call.

Design records are internal. If a documentation site ever exists, nothing in `design/` is published
to it, and no user-facing page may reference an open question, a rejected approach or a future
intention.

### 2. Agreement

The design is discussed and agreed before decomposition. Do not start writing issues from a design
that has not been accepted, and do not start writing code from issues that do not exist yet.

This is the point at which disagreement is cheap. Raise objections here.

### 3. Decomposition into issues

An agreed design becomes one epic plus its task issues.

Issue **type** carries the meaning, not a title prefix. The type is searchable (`type:Epic`),
renders as a badge, and is a field on the project board. Do not restate it in the title.

| Type      | Means                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| `Feature` | An idea or a request. The inbox. Filing one needs no design record.             |
| `Epic`    | A designed, agreed, decomposed feature. Carries the design record and the plan. |
| `Task`    | One reviewable step. Always a sub-issue of an epic.                             |
| `Bug`     | A defect in something already built.                                            |

**A feature is promoted to an epic** when its design record lands. Change the type on the existing
issue rather than opening a new one, so that the whole thread from first suggestion through design
discussion to finished plan keeps one number and one history.

**The epic** carries the relevant `track:*` labels, and `contract-touching` when it changes the
module contract or an event payload schema. Its body has a fixed shape:

- A prose statement of what the feature is and what problem it solves.
- A link to the design record, and to the origin discussion when there was one.
- `## Settled`, the decisions taken, each stated as a claim rather than a discussion.
- `## Phases`, in dependency order. Each phase names the task issues that implement it, and the
  phases that matter carry a **Gate**: an acceptance criterion checkable without judgement.
- `## Not doing`, the explicit exclusions. This section prevents more rework than the rest combined.
- `## Related`.

**Task issues** are sub-issues of the epic, so progress rolls up natively. One task is one
reviewable step, sized to the pace described above. A task that cannot be reviewed in one sitting is
two tasks.

Decomposition is proposed, not filed unilaterally. Present the epic body and the task list, and get
agreement before creating anything.

### 4. Working the backlog

Priority cuts across features. The order of work is agreed separately from the decomposition, and an
epic being open is not a commitment to finish it before starting another.

Before starting any non-trivial change, check that an issue exists. If none does, do not silently
start: propose a title and a short body and get it filed first. Reference the issue in the commit or
pull request so the work stays traceable to the reasoning behind it.

Trivial and in-flight work needs no issue: a typo, a small local refactor, a doc tweak, a follow-up
to work already underway. When unsure whether something crosses that line, ask.

Filing an issue does not put it on the project board. That stays the maintainer's call.

### Labels

`track:*` marks the area. An issue may carry more than one.

| Label             | Area                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `track:core`      | Event log, entity graph, projections, flow engine, the contract itself |
| `track:journal`   | Prose entries, inline mentions, inline roll results                    |
| `track:entities`  | Entity graph, relations, threads, staleness and recaps                 |
| `track:mechanics` | Rolls, checks, tracks, clocks, oracles, suggestions                    |
| `track:content`   | Content packages, the Datasworn importer, licensing and attribution    |
| `track:module`    | System modules: Ironsworn, Starforged, the toy canary                  |
| `track:ui`        | Design system, application shell, panels                               |
| `track:platform`  | Electron, IPC, storage, packaging, updates, CI                         |
| `track:docs`      | Documentation and project hygiene                                      |

`contract-touching` marks the one-way doors: a change to the module contract or to an event payload
schema. Both are permanent once a user has written events against them. Treat these issues as
deliberate, and expect them to need a design record even when they look small.

Labels mark area and risk. Issue type marks what kind of thing it is. Do not encode one as the
other.

## Verify, do not remember

Assume your knowledge of the ecosystem is stale, because it is.

Before pinning or upgrading anything, check the registry for the current version **and** check that
the versions compose. Peer ranges are where this bites. The bootstrap of this repository produced
five separate cases where the newest published version was the wrong choice:

- `typescript-eslint` peers `typescript <6.1`, so TypeScript 7 would have broken the lint stack that
  enforces the dependency law.
- `electron-vite` 5 peers Vite 7, while `@vitejs/plugin-react` 6 requires Vite 8.
- `eslint-plugin-import` stops at ESLint 9, and this repository is on ESLint 10.
- `better-sqlite3` v13 ships N-API prebuilds, making the per-Electron native rebuild that the
  bootstrap plan warned about unnecessary.
- Electron dropped its `postinstall` between v38 and v42, so the binary now downloads lazily.

Every GitHub Action named in the bootstrap plan was at least one major version behind.

Two rules follow:

1. Check before you pin. "Latest" is a claim about a registry, not about compatibility.
2. When a written decision turns out to be wrong, fix the document in the same change that works
   around it, and say so in the commit. A decision record that quietly rots is worse than none,
   because the next reader trusts it.

## Probe your enforcement

A rule that has never fired is a rule you have not tested.

When you add or change a guard (an ESLint rule, a dependency-cruiser rule, a check script, a CI
gate), write a deliberate violation, confirm the specific rule fires with a useful message, then
revert the violation. Report that you did it.

This is how every guard in this repository was validated, and it caught real problems: several rules
only appeared to work, because pnpm's strict linking rejected the undeclared import before the graph
rule ever saw it.

## No shortcuts: fix causes, not symptoms

The maintainer is not in a hurry. Correctness outranks speed, always.

The failure to avoid is making a symptom disappear instead of fixing its cause. When the correct fix
is hard, do the correct fix. When it is large, unclear, or needs a decision, stop at the checkpoint
and say so. Asking is always better than guessing, and a hack shipped to keep a step moving is never
acceptable.

Forbidden as symptom-hiding shortcuts:

- `setTimeout`, sleeps, retries or polling to dodge a race or an ordering problem. Fix the ordering.
  This will be tempting around IPC readiness and renderer startup; do not.
- `any`, `as unknown as`, `@ts-ignore`, or `@ts-expect-error` used to silence a type error rather
  than model the type. `@ts-expect-error` is legitimate only with a comment naming the upstream bug
  it works around.
- `!` non-null assertion on a condition that can actually occur.
- `eslint-disable` to silence a rule instead of fixing the code.
- Weakening a tsconfig strictness flag, for a package or a file.
- Weakening or narrowing a guard script, its allowlist, or a dependency-cruiser rule so that
  offending code passes.
- Loosening the Electron security posture. `contextIsolation: false`, `nodeIntegration: true`,
  `sandbox: false`, or `webSecurity: false` are never the fix. If something cannot be done through
  the IPC contract, the contract needs a new channel.
- Swallowing an error: an empty `catch`, `.catch(() => {})`, a discarded rejection, an error logged
  and then ignored.
- `TODO`, stub bodies, or `throw new Error('not implemented')` left in committed code.
- Tests that assert nothing, tests marked `.skip` or `.only`, tests weakened until they pass, or a
  value hardcoded to make a check go green.
- Mocking the thing under test, or mocking so much that the test no longer exercises real behaviour.

A green build is necessary and not sufficient. The bar is that an experienced reviewer would find no
shortcut, not that `pnpm test` exits zero.

A deliberate, justified exception is annotated inline with `// shortcut-ok: <reason>`. It should be
rare enough that seeing one is notable in review.

## Definition of done

A step is done when all of these are true. Not four of them.

1. `pnpm build && pnpm test && pnpm check:all` passes locally.
2. New behaviour has tests, written during the step.
3. Any new guard was probed with a deliberate violation.
4. User-visible behaviour changes are reflected in documentation in the same step.
5. Any decision that contradicts `00-PROJECT-BRIEF.md` has been raised, and the brief updated if the
   decision stands. Any decision that diverges from the feature's design record is annotated there.
6. The work references its issue, and the issue reflects what was actually built.
7. The commit message explains why, not only what.
8. The step report states what changed, what you verified by running it, and what you did not.

## The commitments that define the product

These are product decisions, not implementation preferences. Code that violates one of them is wrong
even when it works and the tests pass.

### Assisted but sovereign

The application computes everything and decides nothing. It suggests a stat, surfaces applicable
bonuses as suggestions, rolls, computes the outcome, and proposes effects. Every field stays
editable, every suggestion declinable, every past event revisable through a compensating event.

No mechanics surface may block a state as illegal. Validation is limited to range (a d10 cannot show
12). If you find yourself writing a check that prevents the player from doing something, you have
misread the product.

This is enforced structurally rather than by discipline: the module contract has no channel through
which a module could express "illegal". Keep it that way. A module that needs to enforce a rule is a
contract change, and a contract change is the maintainer's decision.

The audit trail matters as much as the behaviour. What was suggested and what the player chose are
both recorded, through `core.suggestion.*` events.

### The log is the truth, and it replays

The event log is the source of truth. Everything a user sees, character sheets, track values, entity
fields, is a projection rebuilt from it.

The contract, in order of importance:

- **The same log always produces the same projection.** This is what makes the model trustworthy and
  what makes debugging possible. Projection code must be a pure function of the log. No clock reads,
  no random values, no dependence on map iteration order, no reaching outside the log for state.
- **History is append-only.** Correcting the past means appending a compensating or revision event
  that references what it revises. Never mutate or delete a recorded event. True deletion exists as
  one deliberate compaction feature, and it is not an everyday operation.
- **Every payload schema is versioned from the first event ever written.** Schema changes are
  handled by upcasting on read. The log is never rewritten to fit new code.
- **Core stores module payloads without interpreting them.** For `sys.*` events, core stores,
  exports, and asks the owning module to render and upcast. Core reading inside a module payload is
  a design failure.

Ordering comes from the per-campaign `seq`, not from the wall-clock `at`. Treat `at` as information
for the reader.

### Physical dice are first-class

Every roll surface accepts typed-in die results. Roll events record provenance per die as a record
naming where the number came from: `digital`, `manual`, or a named service carrying that service's
own identifiers. Everything downstream behaves identically regardless of which it was. This applies
to oracle rolls as much as to move rolls. See `design/rolling-dice.md`.

Rolling and interpreting are separate concerns. Oracle providers resolve a result they are handed;
they do not roll. That seam is what makes manual entry work everywhere without special cases.

### Content is licensed, and the licensing is machine-readable

Content packages carry an SPDX identifier and attribution text that the application renders. Roll
events record the package id and version they rolled against, so a campaign stays auditable when a
user updates a package mid-play.

Never commit game content that is not CC-BY, MIT or ORC licensed, and never commit user-imported
content. Test fixtures use obviously-dummy data. `pnpm check:content-leak` is the backstop, and git
history is permanent.

## The invariants, and what enforces each

### Dependency direction

```
core                   imports nothing internal, and never Electron
ui                     imports nothing internal
system-* / importer-*  import core only
apps/desktop           imports everything; nothing imports it
renderer               never imports Node built-ins or Electron
```

License direction follows dependency direction: `packages/*` are MIT, `apps/desktop` is
GPL-3.0-or-later, and an MIT package may never depend on GPL code.

Enforced in two places, which must stay in step:

- `eslint.config.js`, on import specifiers, for fast feedback while editing.
- `.dependency-cruiser.cjs`, on the resolved module graph. This is the real backstop, and it runs in
  CI as `pnpm depcheck`.

Crossing an arrow means the design is wrong. Raise it before writing the code.

### The renderer does not know Electron exists

The renderer is a plain web app. Storage, dialogs, imports, package management and blobs all cross
the typed IPC contract in `apps/desktop/src/shared/ipc.ts` and nothing else does. Adding a channel
there is the single edit that keeps preload and renderer in step.

`contextIsolation: true`, `nodeIntegration: false` and `sandbox: true` are set from the first commit
and are not negotiable.

### The vocabulary rule

`packages/core` and `packages/ui` may use only words that appear in no rulebook: journal, entry,
event, roll, table, entity, relation, track, clock, resource, module, package, flow. A name taken
from a game system means the thing it names belongs in a system module.

`oracle` is allowed. It is the domain-generic term this project chose for tables.

Enforced by review, with `pnpm check:vocabulary` as the mechanical backstop. A line ending in
`vocabulary-check-ignore` is exempt, for the rare comment that has to name the word it bans.

### The toy module is a permanent canary

`packages/system-toy` is a trivial coin-flip system whose only job is to keep the contract honest.
Core runs its contract-consuming paths against both `system-toy` and `system-ironsworn`, and it
keeps doing so forever.

If a contract change cannot be implemented trivially by the toy, the contract is wrong. Do not fix
the toy to accommodate the contract.

### Datasworn stops at the importer

Datasworn is an interchange format this project consumes. It is never the runtime model.
`packages/importer-datasworn` is the only place in the repository allowed to name a Datasworn type,
and one implementation serves both build-time bundling and runtime user imports so that both produce
identical output.

### Using a guard's escape hatch

Each guard has a deliberate escape hatch: `vocabulary-check-ignore`, an SPDX entry in
`tools/check-licenses/allowlist.json`, an `allow` entry in `tools/check-content-leak/patterns.json`.
Using one is a decision, not a workaround. It belongs in its own commit with the reason written
down, and it is the maintainer's call.

## Testing

- Unit tests alongside the code they cover, written during the step.
- Contract tests run against both system modules. See the canary invariant above.
- Event round-trip tests: every declared event type serialises, upcasts from v1 through current, and
  renders without core knowing its shape.
- Golden-file tests for importer output. A Datasworn version bump regenerates the goldens in the
  same pull request, and that regeneration is reviewed as a content-model change.
- A recorded session fixture, replayed into projections, as the regression net for the
  event-sourcing engine.

Test the observable contract rather than the implementation. A test that has to be rewritten for
every refactor is testing the wrong thing.

## TypeScript conventions and the quality bar

This should read as idiomatic and deliberate to any TypeScript reviewer.

- Strict everywhere, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. These
  are set once in `tsconfig.base.json` and never weakened per package.
- Keep the public surface of each package intentional. Default to not exporting.
- Model illegal states out of the type system where it is cheap, rather than validating at runtime.
  This is about type design, and it never becomes a runtime block on the player.
- Prefer explicit, narrow types at package boundaries. `unknown` at a boundary you have not modelled
  yet is honest; `any` is not.
- Errors are values at package boundaries. Throwing inside a module is fine; a package boundary that
  can fail should say so in its type.
- `pnpm lint` and `pnpm format:check` must pass. Prettier owns formatting, so do not argue with it.
- Comment why, not what. A comment restating the code is noise; a comment explaining a constraint, a
  gotcha, or a decision is worth more than the code it sits above.

## Dependency hygiene

Every dependency is a liability for maintenance, review, build time and license posture. Keep the
set small and justified.

- Pin exact versions. No `^`, no `~`.
- Shared tooling versions live in the pnpm catalog in `pnpm-workspace.yaml`, not duplicated across
  packages.
- Note the reason for an addition in its commit.
- Production dependencies ship inside the GPL application and must be GPL-compatible.
- pnpm blocks dependency install scripts by default. Adding to `allowBuilds` requires saying what
  the script does and why it is needed.
- Prefer the platform and a small number of well-chosen packages over many. This project already
  dropped two planned dependencies by using what pnpm and ESLint already provide.

## Documentation is part of done

A change to user-visible behaviour is not done until its documentation changed in the same step.

A change that contradicts `00-PROJECT-BRIEF.md` is not done until the brief is updated, or the
change is reverted. The brief is the decision record; a decision that lives only in code is lost.

There is no published documentation site yet. When one exists it gets its own contract, the way ymir
has `DOCS.md`, and this section will point at it.

## Layout

```
apps/desktop/                 Electron app: main, preload, renderer.  GPL-3.0-or-later
packages/core/                event log, entity graph, package registry, contract, flow engine.  MIT
packages/ui/                  design tokens and component layer.  MIT
packages/system-ironsworn/    Ironsworn and Starforged module.  MIT
packages/system-toy/          canary module.  MIT
packages/importer-datasworn/  Datasworn to neutral content packages.  MIT
tools/                        repo-internal guard scripts, never published
design/                       per-feature design records, internal, never published
```

## Commands

```bash
pnpm install
pnpm build              # tsc -b for the libraries, then electron-vite for the app
pnpm dev                # builds the libraries, then launches the Electron shell
pnpm test               # vitest across the workspace
pnpm lint
pnpm format             # prettier --write
pnpm depcheck           # dependency-cruiser: the dependency-direction law
pnpm check:licenses     # SPDX allowlist over the dependency tree
pnpm check:content-leak
pnpm check:vocabulary
pnpm check:all          # lint, depcheck, and all three guards
pnpm package            # electron-builder artifacts for the current platform
```

`pnpm dev` builds the libraries first, because the renderer imports `@aether-forge/ui` through its
`exports` field, which resolves to `dist/`.

CI runs the same commands. A clean local run means a clean pull request.

## Git and releases

- Conventional commits, enforced on pull request titles. Pull requests are squash-merged, so the
  title becomes the commit message and release-please derives the version from it.
- `main` requires a pull request and passing checks. Admin bypass is currently enabled so that
  release pull requests stay mergeable; see the note in `.github/workflows/release-please.yml`.
- Releases are cut by merging the release pull request. Never tag by hand.

## Writing style

For this file, commit messages, code comments, issues and pull requests.

Honest and non-performative. Plain language. Treat the reader as capable.

Forbidden:

- **Em dashes.** Use commas, parentheses, semicolons, or a new sentence.
- **Minimising adverbs**: simply, just, easily, obviously, of course, merely. They tell a stuck
  reader that their problem is their own fault.
- **Marketing vocabulary**: powerful, seamless, intuitive, robust, rich, flexible, leverage as a
  verb. No exclamation marks, no emoji.
- **Hedges** where the answer is known. Either the behaviour is known, in which case state it, or it
  is unknown, in which case say that it is unverified.
- **Meta-commentary**: "this section explains", "as mentioned above".

Length is not a virtue. If a paragraph can do its job in two sentences, use two. Closing paragraphs
that restate what was already said are usually unnecessary; end on the last substantive point.

### Explanatory writing, which is where this goes wrong

"Plain language" was not specific enough to prevent an unreadable first draft of the event log
design record, so this section says what went wrong and how to avoid repeating it. It applies to
design records, issue bodies, and anywhere else something is being explained rather than stated.

The audience knows the domain. They know what a vow, an oracle and a progress track are. They do not
necessarily know what you mean by fold, reducer, upcast, idempotent or CRDT, and they should not
have to.

- **Define a term where it first appears, or do not use it.** The first draft used "fold" as both a
  noun and a verb without ever saying what it meant. If a term needs a definition and the definition
  is awkward, that is a sign to use ordinary words instead.
- **Show one real example early.** The same draft described the mechanism completely and never
  showed a single event, so the first question it drew was what one actually looks like. A worked
  example near the top makes everything after it easier to judge.
- **Write the argument, do not compress it into a clause.** "Designing for a merge that has no
  product behind it would distort every decision here, starting with seq" contains a real argument
  that the reader cannot reconstruct. Three plain sentences would have carried it.
- **No aphorisms.** "Written down so the failure is recognisable rather than rationalised" sounds
  considered and says very little. If a sentence sounds quotable, check that it also means
  something.
- **An open question states three things**: what the question is, why it matters, and what would
  settle it. A question with no route to an answer is a worry, not a question.
- **Density is the enemy, not length.** The rule above about brevity is about cutting filler. It is
  not licence to compress an argument until it needs decoding. A document that is short because it
  is compressed is worse than one that is longer and can be read once.

The test: could someone who knows solo roleplaying, but has never built an event-sourced system,
read this once and tell you what was decided and why?

## Amending this file

This file changes the way code changes: by pull request, with the reasoning in the commit message,
and with the maintainer's approval. Do not edit it as a side effect of another task.

When a rule here proves wrong or unworkable, say so and propose the amendment. A rule that is
routinely worked around should be fixed or removed, because a contract nobody follows teaches
everyone to ignore the rest of it.

## Current state

The repository is a working monorepo, build pipeline and release pipeline, and the first feature
phases are built. As of 7 August 2026:

- `packages/core` has the event log with versioned payloads and upcast-on-read, projections with
  purity contract tests, the journal, rolls with per-die provenance, checks, the four
  `core.suggestion.*` events (already through one real V1 to V2 migration), campaign export and
  import, and a reusable contract-test kit under `@aether-forge/core/testing`.
- `apps/desktop` has the SQLite event log passing the same contract suite as the memory log, a typed
  IPC surface of ten channels, and a renderer where a person can write and correct journal entries,
  roll a check with typed-in or digital dice, and answer its suggestions. Five Playwright specs run
  against the packaged app.
- `packages/ui` has the fifteen-slot theme contract with two built-in themes, tokens, motion, the
  colour report, and five components. React 19 is a peer dependency. The design intent lives in
  `design/ux-ui-design-handoff` and `design/themes-and-components.md`.
- Both system modules declare a check; `system-ironsworn` covers one move (Face Danger) and
  momentum. There are no entities, sheets, tracks, clocks, flows, or content packages yet, in core
  or anywhere else. `packages/importer-datasworn` is a stub.

Things that are true now and worth revisiting:

- Stat values in a check are typed in at roll time, because there is no character sheet to read
  from. The pre-roll `suggest` half of the contract is declared and implemented by nothing.
- ESLint runs without type-aware rules, to keep the configuration small while the codebase is.
  Enabling `recommendedTypeChecked` means wiring `projectService` and including test files.
- `better-sqlite3` v13 ships N-API prebuilds and needs no per-Electron rebuild. Do not reintroduce
  `electron-builder install-app-deps` unless some dependency genuinely requires it.
- Electron v43 has no `postinstall`. The binary downloads lazily on the first `require('electron')`,
  so a fresh clone pauses once during `pnpm dev`, and build-only CI jobs never fetch it.
  `ELECTRON_SKIP_BINARY_DOWNLOAD` no longer does anything; do not add it back.
- Datasworn packages are not wired up yet. When they are, pin exact versions and treat every bump as
  a content-model change with regenerated goldens.
- **Dependency updates are manual, by decision.** The bootstrap plan called for a Renovate config,
  and one was written before anyone checked whether the app that consumes it was installed. It was
  not, so the file sat there doing nothing. With exact pins, a small dependency set, and a rule that
  Datasworn bumps need regenerated goldens, almost every update wants a human decision anyway, and a
  bot whose pull requests get closed teaches you to ignore the ones that matter. Revisit when the
  dependency list is large enough to be a chore.
- v0.1.0 has been released. Releases are cut by merging the release-please pull request, never by
  tagging by hand.
- Two Phase 4 items from `01-BOOTSTRAP-PLAN.md` remain outstanding, not deferred by any decision:
  `electron-updater` wiring and the AUR packaging job.
