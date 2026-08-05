# Module Contract — design sketch (v0)

> Status: design document, not code. These signatures are for stress-testing on paper and as the
> starting point for `packages/core/src/contract/`. Names obey the vocabulary rule: nothing here
> may come from a rulebook. Every type that crosses the log boundary is versioned.
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
- `core.entity.*` (created, fieldsChanged, relationAdded, relationRemoved, archived)
- `core.track.*` (created, advanced, reduced, resolved) — generic segmented track
- `core.roll.*` (see §5)
- `core.oracle.*` (consulted — result + table ref + package version)
- `core.package.*` (installed, removed, updated)
- `core.flow.*` (stepEntered, stepCompleted, flowCompleted, stepRevisited)
- `core.suggestion.*` (offered, accepted, adjusted, declined) — the sovereignty audit trail

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

interface DieValue {
  sides: number;
  value: number;                     // range-validated only; never legality-policed
  source: 'digital' | 'manual';
}

interface RollRequest {
  dice: DieSpec[];                   // e.g. Starforged action roll: [d6, d10, d10]
  reason?: { kind: 'table' | 'check' | 'free'; refId?: string };
}

interface RollResult { dice: DieValue[]; request: RollRequest }
// persisted as core.roll.performed; provenance per die, so mixed physical/digital rolls are native
```

Interpretation of results (hit/miss/degrees/crits) is module territory, expressed as §6 outcomes —
core knows numbers, never meanings.

**Stress test.** (A) action roll d6+2d10, progress roll 2d10 only, "reroll any die" asset ability =
a new `core.roll.performed` with `revises` — all fit. (B) toy: single d2. (C) d20+mods vs DC,
advantage = `{ sides: 20, count: 2 }` + module interpretation picks one — fits without core
changes. Pass.

## 6. Checks — structural move/action definitions (assisted-but-sovereign)

```ts
interface CheckDefinition {
  id: string;                        // "starforged/adventure/face_danger"
  name: string;
  docRef?: string;                   // full text in the reference browser
  roll: RollRequest | null;          // null = no-roll procedure
  inputs: CheckInput[];              // stat choice, modifiers — all user-editable at execution
  interpret(result: RollResult, inputs: Record<string, number>): CheckOutcome;
}

interface CheckInput {
  id: string; label: string;
  kind: 'choice' | 'number';
  options?: Array<{ id: string; label: string; value: number }>;  // e.g. stats
  suggest?(ctx: CampaignContext): { value: number; why: string } | null; // asset hints etc.
}

interface CheckOutcome {
  id: string;                        // "strong_hit", "weak_hit_match", "crit_fail" — module-defined, opaque to core
  label: string;
  summary: string;                   // rendered outcome text
  suggestions: EffectSuggestion[];   // NEVER auto-applied
}

interface EffectSuggestion {
  id: string;
  label: string;                     // "Momentum −1", "Mark progress"
  events(ctx: CampaignContext): EventEnvelope[];  // what accepting would append
}
```

Sovereignty is structural: core's execution UI is generically
`inputs → roll (digital or typed) → outcome → suggestions [accept | adjust | decline]`, and every
decision lands as `core.suggestion.*` events. Modules cannot enforce because the contract has no
enforcement channel — there is nowhere to put "illegal".

**Stress test.** (A) Face Danger: 3 stat options, Kinetic surfaces via `suggest`, weak hit suggests
momentum event — natural fit. Progress rolls: `roll` uses 2d10, `interpret` reads the track value
from inputs. (B) toy: one check, coin flip, two outcomes, zero suggestions — trivially
implementable (canary passes). (C) 5e attack: inputs = attack bonus (from computed sheet, §7),
interpret handles nat-20; suggestions = "roll damage" (a follow-up check). Degrades gracefully:
whatever 5e can't encode structurally simply ships as reference docs (option-1 behaviour), which
the contract permits by making everything optional beyond `id`/`name`. Pass.

## 7. Entities, sheets, tracks

```ts
interface EntityTemplate {
  typeId: string;                    // "npc", "site", "sys.ironsworn.vow" — module types namespaced
  name: string;
  fields: FieldSpec[];               // typed fields; free-form entities (no template) are first-class
  generators?: string[];             // oracle table ids offered at creation (create-in-context)
  trackSpec?: TrackSpec;             // entities may carry a track (vows, scene challenges)
}

interface TrackSpec {
  segments: number;                  // 10 for Ironsworn tracks, 4/6/8 for clocks
  unit?: string;                     // "tick" | "segment" — display only
  stepOptions?: Array<{ label: string; amount: number }>;   // module-suggested advance sizes
}

interface SheetDefinition {
  forEntityType: string;
  layout: SheetLayout;               // declarative regions -> field/track/derived widgets
  derived?: Array<{ id: string; label: string; compute(fields: Record<string, unknown>): unknown }>;
}
```

`derived` is the 5e escape hatch: computed values (skill bonuses, AC) are pure functions over
fields, recomputed on projection — core never stores them. Ironsworn barely uses it (max momentum
from impacts); the toy ignores it. The contract holds across all three depths.

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
