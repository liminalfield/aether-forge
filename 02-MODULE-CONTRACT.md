# Module Contract — design sketch (v0)

> Status: partly implemented, and amended in place as accepted design records changed it. The
> envelope (§2), rolls (§5), checks and suggestions (§6) are code, landed as flat modules in
> `packages/core/src` (`event.ts`, `roll.ts`, `check.ts`, `suggestion.ts` and their neighbours)
> rather than the `packages/core/src/contract/` directory this sketch named. Content packages
> (§3), oracle providers (§4), entities, sheets and tracks (§7), flows (§8) and the assembled
> module shape (§9) remain design only, §7 being the largest unwritten piece. Where an
> implemented section and the code disagree, the code is right. Names obey the vocabulary rule:
> nothing here may come from a rulebook. Every type that crosses the log boundary is versioned.
> Status corrected 7 August 2026; it had claimed "design document, not code" throughout.
>
> Stress-test targets: (A) Ironsworn/Starforged, (B) toy coin-flip system, (C) hypothetical 5e SRD.
> Each section ends with notes on how the three fare. A contract element fails review if the toy
> system cannot implement it trivially or if 5e can only implement it by contorting.

## 1. Identifiers & versions

```ts
type CampaignId = string;      // ulid
type EventId = string;         // ulid — sortable, unique
type EntityId = string;        // ulid
type SystemId = string;        // e.g. "ironsworn-starforged", "toy-coinflip"
type PackageId = string;       // e.g. "datasworn.starforged", "user.mythic-tables"
type SemVer = string;

interface Versioned {
  schemaVersion: number;       // per payload type, monotonic, starts at 1
}
```

## 2. Event envelope (the one-way door — get this right)

```ts
interface EventEnvelope<P = unknown> {
  id: EventId;
  campaignId: CampaignId;
  seq: number;                       // per-campaign monotonic sequence
  at: string;                        // ISO timestamp (wall clock; seq is the ordering truth)
  type: string;                      // namespaced: "core.entity.created", "sys.ironsworn.move.rolled"
  schemaVersion: number;             // version of THIS event type's payload schema
  systemId?: SystemId;               // absent for core events
  causationId?: EventId;             // event that directly caused this one (roll -> suggested effect -> accepted)
  revises?: EventId;                 // for revision/compensation events
  payload: P;                        // opaque to core for "sys.*" types
}
```

Core-owned event families (payloads defined in core, stable, versioned):

- `core.campaign.*` (created, renamed, exported)
- `core.entry.*` (prose entries: created, revised, promoted-to-story)
- `core.entity.*` (created, changed) — implemented; see design/entities-and-tracks.md
- `core.track.*` (started, advanced, set) — implemented; see design/entities-and-tracks.md
- `core.roll.*` (see §5)
- `core.oracle.*` (consulted — result + table ref + package version)
- `core.flow.*` (stepEntered, stepCompleted, flowCompleted, stepRevisited)
- `core.suggestion.*` (offered, accepted, adjusted, declined) — the sovereignty audit trail

There is no `core.package.*` family, and the sketch that listed one was wrong. Which packages are
installed is a fact about a machine, not a campaign: recording installs into the log would write
machine state into game history, and an exported campaign would either drag it about or strip it.
The audit a campaign needs is the `PackageStamp` each `core.oracle.consulted` carries. Removed
8 August 2026, per design/content-packages.md.

Module-owned event types are namespaced `sys.<systemId>.*`; core stores/exports them and asks the
module to render and upcast them.

```ts
interface EventUpcaster {
  type: string;
  fromVersion: number;
  up(old: unknown): unknown;         // to fromVersion + 1
}
```

**Stress test.** (A) momentum burn = `sys.ironsworn.momentum.burned` (module payload) usually with
`causationId` pointing at a `core.roll.performed`. (B) toy needs zero module events — coin flips
are `core.roll.performed` with a d2. (C) 5e attack = `core.roll.performed` + module event for the
interpretation; nothing in the envelope assumes three-outcome resolution. Pass.

## 3. Content packages

```ts
interface PackageManifest {
  id: PackageId;
  version: SemVer;
  title: string;
  systems: SystemId[];               // which modules can consume it
  license: string;                   // SPDX: "CC-BY-4.0", "MIT", "LicenseRef-User-Imported"
  attribution?: string;              // rendered in-app; CC-BY requires it
  source: 'bundled' | 'imported' | 'user';
  contentHash: string;               // sha256 of canonicalized content
}

interface ContentPackage {
  manifest: PackageManifest;
  tables: OracleTable[];             // §4
  documents: ReferenceDoc[];         // moves text, rules reference — renderable, hyperlinkable
  entityTemplates: EntityTemplate[]; // §7
  raw?: unknown;                     // module-specific extras (e.g. asset definitions), opaque to core
}
```

> Implemented 8 August 2026, per design/content-packages.md (#158). The shapes above are the code
> (`packages/core/src/content.ts`), with two corrections found while implementing: `raw` is the
> module's compartment and core's readers pass it through unread, and `OracleOutcome` carries the
> whole row (range and text) plus a `PackageStamp`, because `core.oracle.consulted` records the
> row it landed on and the outcome should be transcription, not assembly.

Rules: runtime never sees Datasworn types — `importer-datasworn` produces `ContentPackage`s at
build time (bundled) and at runtime (user imports), same implementation. Imported packages are
installed into the app data dir (copied, hashed), never referenced in place.

## 4. Oracles

```ts
interface OracleTable {
  id: string;                        // stable, package-scoped: "starforged/core/action"
  packageId: PackageId;
  name: string;
  dice: DieSpec;                     // usually { sides: 100, count: 1 }
  rows: Array<{ floor: number; ceiling: number; result: string; embeds?: string[] }>;
}

interface OracleProvider {
  id: string;                                        // "datasworn-tables", "mythic-fate", "user-tables"
  listTables(ctx: CampaignContext): OracleTable[];   // may be dynamic (Mythic: chaos factor state)
  resolve(tableId: string, roll: RollResult, ctx: CampaignContext): OracleOutcome;
}

interface OracleOutcome {
  text: string;
  tableId: string;
  packageId: PackageId;
  packageVersion: SemVer;            // audit: what version was rolled against
  followUps?: string[];              // suggested next tables (prompt surfacing hooks here)
}
```

Note the seam: providers *resolve* results; they do not roll. Rolling belongs to §5, so manual
d100 entry works against every provider identically. Mythic-style providers are just providers
whose `resolve` consults campaign state (chaos factor as a core resource/track) — no special case.

## 5. Rolls — results are events, sources are pluggable

```ts
interface DieSpec { sides: number; count: number; label?: string }

// where a number came from; a record rather than a word so a service can carry its own
// identifiers without a contract-touching change once campaigns exist. See design/rolling-dice.md
type DieSource =
  | { kind: 'digital' }
  | { kind: 'manual' }
  | { kind: 'service'; service: string; ref: string };

interface DieValue {
  sides: number;
  value: number;                     // range-validated only (1..sides); never legality-policed
  source: DieSource;
}

interface RollRequest {
  dice: DieSpec[];                   // e.g. Starforged action roll: [d6, d10, d10]
}

interface RollResult { dice: DieValue[]; request: RollRequest }
// persisted as core.roll.performed; provenance per die, so mixed physical/digital rolls are native
// a roll names no content package: only resolving it against a table can be affected by a
// package changing underneath it, and §4's OracleOutcome carries that
```

`RollRequest` has no `reason`. It duplicated `causationId`, which already points at the module event
saying which check was invoked, and it put a module-shaped identifier inside a core payload.

Interpretation of results (hit/miss/degrees/crits) is module territory, expressed as §6 outcomes —
core knows numbers, never meanings.

A superseding roll says why it supersedes: `corrected` (the first roll never happened, it was a
recording mistake) or `rerolled` (it did happen, and a rule replaced it). Projections do not care,
since the newest wins either way; a person reading their campaign back does.

**Stress test.** (A) action roll d6+2d10, progress roll 2d10 only, "reroll any die" asset ability =
a new `core.roll.performed` with `revises` and `because: 'rerolled'` — all fit. (B) toy: single d2.
(C) d20+mods vs DC, advantage = `{ sides: 20, count: 2 }` + module interpretation picks one — fits
without core changes. (D) three dice from a dddice room and one typed in after it fell on the floor
= four `DieValue`s, three with `kind: 'service'` — fits, which is the case the old shape could not
have held. Pass.

**Open, found by the canary (5 August 2026, #75).** Stress test (B) says the toy needs zero module
events, and it is true: `packages/system-toy` flips a coin as a `core.roll.performed` with a
two-sided die and works out its tally from core rolls alone. What that exposed is that a module
projection is shown every core event, and a core roll says nothing about which system caused it. A
system with no events of its own can recognise its own rolls only by the shape it asked for, by
convention, and nothing stops another module asking for exactly the same shape. There is a test in
the toy asserting this happens rather than pretending it does not.

Whether that matters is undecided. It only bites when two systems are active in one campaign and
both roll the same dice with the same label, which no product feature currently allows. The options
if it ever does bite are to scope a roll to a system, which puts a module concept on a core event, or
to accept that a system wanting its rolls kept separate needs an event of its own. Neither is worth
choosing now, and it is written down so the next person meets it as a known limit rather than a
surprise.

## 6. Checks — structural move/action definitions (assisted-but-sovereign)

```ts
interface CheckDefinition {
  id: string;                        // "starforged/adventure/face_danger"
  name: string;
  docRef?: string;                   // full text in the reference browser
  roll: RollRequest | null;          // null = no-roll procedure
  decisive?: string;                 // label of the dice the outcome turns on — presentation, never recorded
  inputs: CheckInput[];              // stat choice, modifiers — all user-editable at execution
  interpret(roll: RollPerformedV1 | null, inputs: Record<string, number>): CheckOutcome;
}

interface CheckInput {
  id: string; label: string;
  kind: 'choice' | 'number';
  source: 'chosen' | 'read';         // picked by the player, or taken off the campaign
  options?: CheckOption[];           // e.g. stats
  suggest?(ctx: ProjectionContext): { value: number; why: string } | undefined;
}

interface CheckOutcome {
  id: string;                        // "strong_hit", "weak_hit_match" — module-defined, opaque to core
  label: string;
  summary: string;                   // rendered outcome text
  suggests: EffectSuggestion[];      // NEVER auto-applied
}

interface EffectSuggestion {
  id: string;
  label: string;                     // "Momentum −1", "Mark progress"
  fields: ProposalField[];           // every part a person may change; required, may be empty
  proposes: UnversionedEventDraft;   // one thing, so two effects can be refused separately
}

interface ProposalField {
  id: string;                        // names a key in the proposed payload
  label: string;
  kind: 'number' | 'choice' | 'text';
  options?: CheckOption[];
}
```

Sovereignty is structural: core's execution UI is generically
`inputs → roll (digital or typed) → outcome → suggestions [accept | adjust | decline]`, and every
decision lands as `core.suggestion.*` events. Modules cannot enforce because the contract has no
enforcement channel — there is nowhere to put "illegal".

**`interpret` runs once.** Its answer is written into the module's own resolution event and never
worked out again while reading. Asking a module what the dice meant every time the log is read would
mean that updating a module changes campaigns finished years ago.

**A resolved check records the inputs it ran with**, including those whose `source` is `read`. That
is how it carries the campaign values it was looking at: revise an old event that marked a track and
replay gives a different number than was true at the time, so the log would show a strong hit beside
a track value that could not have produced one.

**`proposes` is a draft, not an envelope.** Core assigns the identifier, the position, the timestamp
and the schema version. A module filling those in would leave core with two bad choices: ignore
them, which makes the fields pointless, or trust them, which lets a module hand out positions in a
log it cannot see.

**`fields` is required.** If describing a proposal's parts were optional, some suggestions could be
adjusted and some could not, and a player pressing adjust would be guessing at which kind was in
front of them.

**The invocation event carries what the check ran with, and not what was suggested.** Which values
the application proposed is already in the `core.suggestion.*` events, with the reason given. Two
records of one fact eventually disagree.

**Stress test.** (A) Face Danger: 3 stat options, Kinetic surfaces via `suggest`, weak hit suggests
a momentum event — natural fit. Progress rolls: `roll` uses 2d10, and the track value arrives as an
input with `source: 'read'`, so recording the inputs records what was read. (B) toy: one check, coin
flip, two outcomes, zero suggestions — trivially implementable (canary passes). (C) 5e attack:
inputs = attack bonus (from computed sheet, §7), interpret handles nat-20; suggestions = "roll
damage" (a follow-up check). Degrades gracefully: whatever 5e cannot encode structurally ships as
reference docs, which the contract permits by making everything optional beyond `id`/`name`. Pass.

## 7. Entities, sheets, tracks

> Implemented 7 August 2026, per `design/entities-and-tracks.md` (#145). The shapes below are the
> code (`packages/core/src/template.ts`, `entity.ts`, `track.ts`). The sketch that stood here had
> `generators` (waits for content packages) and `SheetDefinition` (split off to the sheet surface
> work; the sheet's data is fields and tracks, the instrument drawn from them is not contract).
> Entity fields are core's own data, stored without judgement — a deliberately different
> arrangement from `sys.*` payloads, argued in the record.

```ts
interface EntityTemplate {
  typeId: string;                    // namespaced: "sys.<system>.<type>"
  name: string;                      // the module's word for the type
  fields: FieldSpec[];               // describes; never enforces. Free-form entities are first-class
  tracks: TrackSpec[];               // what a new one starts with (vows, condition meters)
}

interface FieldSpec {
  id: string; label: string;
  kind: 'text' | 'number' | 'marker';
  initial?: FieldValue;              // what a new entity starts with, when the module has an opinion
}

interface TrackSpec {
  id: string; label: string;
  segments: number;                  // 10 for an Ironsworn progress track, 4/6/8 for clocks
  startsFilled: number;              // a condition meter starts full, a vow empty
}
```

Entity state is `core.entity.*` and `core.track.*` events, projected by core. A change names the
fields it sets and carries whole values; an advance is relative and corrects by the difference, a
set is absolute and corrects in place. There is no legality anywhere: a template cannot refuse an
entity, and a track reports a fill past full without comment.

**Stress test.** (A) Ironsworn: character (five stats, three meters) and vow (rank, ten segments)
ship as `templates` in the module. (B) toy: declares `templates: []`, and every entity surface must
render a campaign whose modules say nothing — asserted in its tests. (C) 5e: sheets need `derived`
(computed values over fields); that arrives with the sheet surface work, not the entity model.
Pass, with `derived` deferred rather than dropped.

## 8. Flows (session zero and friends)

```ts
interface FlowDefinition {
  id: string;                        // "sys.ironsworn.campaign-setup"
  steps: FlowStep[];                 // resumable; every step re-enterable later
}

interface FlowStep {
  id: string; title: string;
  kind: 'choose' | 'generate' | 'create-entity' | 'compose';
  optionsFrom?: { tableId?: string; options?: Array<{ id: string; label: string; doc?: string }> };
  produces(choice: unknown, ctx: CampaignContext): EventEnvelope[];  // truths chosen = events (provenance)
  optional?: boolean;
}
```

Every step supports roll / pick / write-your-own with equal dignity (core UI concern, not
per-module). Revisiting a step later appends revision events — the log records when the world
changed.

## 9. The module, assembled

> Amended 8 August 2026, per design/content-packages.md (#158): a module receives its installed
> content at load. In code this is `checksFrom(packages)`: the application hands the module the
> registry's packages, and the module joins their structured facts to its own interpreters to
> produce its checks. `checks` as a static field is how the sketch below imagined it; the
> application-side `LoadedSystem` now carries checks built at load, and a module with no packages
> offers what it can (the toy offers its coin, from no content at all).

```ts
interface SystemModule {
  id: SystemId;
  version: SemVer;
  compatibleCoreRange: SemVer;       // contract versioning between module and core

  packages: PackageManifest[];       // content it expects/bundles
  entityTemplates: EntityTemplate[];
  sheets: SheetDefinition[];
  checks: CheckDefinition[];
  flows: FlowDefinition[];
  oracleProviders: OracleProvider[];
  trackKinds?: TrackSpec[];

  eventTypes: Array<{ type: string; currentVersion: number; upcasters: EventUpcaster[] }>;
  renderEvent(e: EventEnvelope): EventRendering;   // how a sys.* event appears in the journal

  theme?: ThemeTokens;               // module-native look (dark sci-fi vs iron-age vs parchment)
  panels?: PanelContribution[];      // extra UI (momentum widget, faction agenda) mounted by the shell
}
```

## 10. Permanent honesty tests (write these with the contract, before Ironsworn)

1. Core test suite runs every contract-consuming path against **both** `system-toy` and
   `system-ironsworn` fixtures. A contract change that breaks the toy is a contract bug.
2. Vocabulary lint: CI greps `packages/core packages/ui` for a denylist (momentum, vow, asset,
   legacy, oracle-names…) — crude but effective backstop for the review rule. ("oracle" itself is
   allowed: it's the domain-generic term chosen for tables; the denylist is for system-specific
   vocabulary.)
3. Golden-file importer tests: Datasworn package in → `ContentPackage` out, byte-stable. Any
   Datasworn version bump must update goldens in the same PR.
4. Event round-trip: every declared event type serializes, upcasts from v1 through current, and
   renders without core knowing its shape.
5. A recorded real session fixture (30–50 events, prose + rolls + suggestions) replayed into
   projections — the regression net for the event-sourcing engine.

## Open questions (decide during implementation, flagged so they're deliberate)

- Envelope `at` semantics if sync/multi-device ever happens (seq is authoritative; revisit only then).
- Whether `EffectSuggestion.events()` may read projections (probably yes, read-only `ctx`).
- Blob reference format inside prose documents (TipTap node attrs → hash) — settle with the first
  image feature, not before.
- Package dependency between content packages (Sundered Isles depends on Starforged) — manifest
  `requires?: PackageId[]` is the likely shape; confirm against real Datasworn structure in the
  importer.
