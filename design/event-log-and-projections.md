# Event log and projections

Status: proposal, not accepted. Nothing here is built.

The first design record, because everything else consumes its decisions and because it is the
hardest thing to change: once a user has written events, the shapes here are permanent in a way no
later refactor can undo.

Read `00-PROJECT-BRIEF.md` for the project decisions this sits inside, and `02-MODULE-CONTRACT.md`
for the contract types referenced throughout. Where this record and that contract disagree, it is
because this record proposes a change, and each such place is called out.

## What this covers

The append-only campaign log, its storage, and the projections rebuilt from it. Specifically: how an
event is written, how ordering is decided, how state is derived, how a system module participates
without core interpreting its payloads, and how a correction to the past is recorded.

Not covered here, and each wants its own record: the entity graph's own semantics, the prose journal
and its editor, the flow engine, content packages and the importer, and the blob store beyond the
fact that it sits outside the log.

## The problem

The brief commits to an event-sourced, append-only log as the source of truth, with current state as
a rebuildable projection. That is a strong commitment and it buys three things the product depends
on: a session log that is the product rather than a side effect, revisability of any past decision
without destroying history, and a sovereignty audit trail recording both what was suggested and what
the player chose.

It also creates the risks this record exists to settle. A fold that is not pure gives different
answers on different days. A projection that cannot be rebuilt incrementally makes every keystroke a
full replay. A correction model that requires un-applying an event makes incremental folding
impossible. And core cannot fold `sys.*` events at all, because it is forbidden from interpreting
their payloads, which is a hole in the current contract.

## Settled, proposed

### Storage is one SQLite database per campaign

One file per campaign under `app.getPath('userData')/campaigns/`, as already built in the bootstrap.
A campaign is the unit a user exports, backs up, and might one day share, and a file per campaign
makes all three a file operation rather than a query.

The events table is the log:

| Column           | Type    | Notes                                               |
| ---------------- | ------- | --------------------------------------------------- |
| `id`             | TEXT PK | ULID, sortable and unique                           |
| `seq`            | INTEGER | per-campaign, monotonic, unique, the ordering truth |
| `at`             | TEXT    | ISO timestamp, wall clock, informational only       |
| `type`           | TEXT    | namespaced, `core.*` or `sys.<systemId>.*`          |
| `schema_version` | INTEGER | version of this event type's payload schema         |
| `system_id`      | TEXT    | null for core events                                |
| `causation_id`   | TEXT    | the event that directly caused this one             |
| `revises`        | TEXT    | the event this supersedes                           |
| `payload`        | TEXT    | JSON, opaque to core for `sys.*` types              |

Append-only is enforced mechanically, not by discipline: SQLite triggers that raise on `UPDATE` and
`DELETE` against the events table. A guard that lives in the database survives a careless data-layer
change, and this project already prefers mechanical enforcement of its laws.

### `seq` is allocated by the writer, inside the insert transaction

`seq` is `MAX(seq) + 1` computed in the same transaction as the insert. There is exactly one writer,
the Electron main process, so there is no contention to resolve.

This is worth stating because it is an assumption that a future feature could quietly break. A
second process, a worker writing directly, or a sync daemon would all violate it. If any of those
arrive, seq allocation is the first thing that has to change.

### Ordering is `seq`, never `at`

`at` is wall clock and exists for the reader. It is never used for ordering, comparison, or conflict
resolution. A clock that goes backwards, a timezone change, or a device with a wrong date must not
be able to reorder a campaign.

### Every payload is versioned, and upcasting happens on read

Confirmed from the brief, with one addition: upcasting sits between reading and folding. The reader
upcasts each event to the current schema version before any reducer sees it, so reducers only ever
handle current shapes and never carry a chain of historical special cases.

That placement is the whole payoff of versioning. It keeps the migration cost in one narrow layer
instead of spreading it across every consumer.

### Projections are pure folds, in memory, rebuilt on open

A projection is `(state, event) => state`, with an `initial()`. Nothing more.

The first implementation keeps projections in memory, rebuilds by full replay when a campaign opens,
and applies each newly appended event incrementally. It does not materialise anything into SQLite.

The reasoning is that replay is the definition of the model, so an implementation that literally
replays is one whose correctness is visible. Materialised projections are a performance decision,
and the honest way to take a performance decision is with a measurement rather than an intuition.
The seam is the `Projection` interface itself, so materialising later changes where state is kept
and not how it is computed.

Purity is a hard requirement, and it is the same commitment ymir makes about determinism for the
same reason: the same log must always produce the same projection. No clock reads, no random values,
no dependence on object or map iteration order, no reaching outside the log for state.

**Gate**: a recorded session fixture of 30 to 50 events, replayed twice, produces byte-identical
projection state, and replayed against both `system-toy` and `system-ironsworn`.

### Corrections are absolute, never relative

This is the decision most likely to be argued with, and the one with the widest consequences.

A revision event carries the full replacement value for what it supersedes. It never carries a
delta. Folding is therefore last-write-wins per field, and a projection never has to un-apply an
event it has already applied.

The alternative, where a revision expresses a difference from what it replaces, forces the fold to
either reverse an earlier event or restart from the beginning on every correction. Reversal requires
every reducer to be invertible, which is a large tax on every future reducer to serve a rare
operation. Restarting makes correction cost proportional to campaign length.

Deltas still exist, and they are simply not revisable. An event that says a resource decreased by
one is a fact that happened. Correcting it means appending another delta that compensates, which is
what the brief already calls a compensating event. The distinction is:

- **State-carrying events** (prose content, an entity's field, a track's value) may be revised, and
  a revision carries the new value in full.
- **Delta events** (a resource moved by an amount, progress was marked) are never revised. They are
  compensated by a further delta.

The log stays honest either way. It records that a correction happened, when, and what it changed.

### Module events are folded by the module, through a new contract channel

Core cannot fold `sys.*` events, because it may not interpret their payloads. The contract as
written has `renderEvent` and `upcasters` but nothing that folds, which means module state cannot
currently be projected at all. This is a genuine hole rather than an oversight to work around.

Proposal: a system module contributes reducers over its own slice of state.

```ts
interface ModuleProjection<S = unknown> {
  id: string; // slice id, namespaced to the module
  initial(): S;
  apply(state: S, event: EventEnvelope, ctx: ProjectionContext): S;
}
```

Core holds the slice opaquely, exactly as it holds payloads: it stores it, hands it back, and never
looks inside. `ProjectionContext` gives read-only access to core projections, because a module
reducer legitimately needs to know things like an entity's current fields, and gives nothing else.

Two constraints follow, and both are real costs:

- A module reducer must be pure, by the same rule as core reducers.
- A module reducer must be platform-neutral, because it runs wherever projections are computed. In
  practice that means the main process, while the same module's rendering runs in the renderer. The
  dependency-direction law already forbids `packages/*` from touching Electron, so this is
  consistent, but it does mean a module cannot assume it runs in a window.

This is `contract-touching`. It changes `SystemModule`, which is a one-way door once a module
outside this repository exists.

### Blobs stay outside the log

Confirmed from the brief. Images and other binary content are content-addressed by hash in the app
data directory. Events and entities reference the hash. A campaign export is log plus entity store
plus blob store as one bundle.

The log therefore stays text, which keeps replay cheap and makes the database file inspectable.

## Not doing

- **No sync, no multi-device, no CRDTs.** The brief commits to local-first with no server ever
  required. Designing for a merge that has no product behind it would distort every decision here,
  starting with `seq`.
- **No deletion of events.** True deletion is one deliberate compaction feature, out of scope for
  this record, and never an everyday operation.
- **No storing of derived values.** Anything computable from the log is computed. This is what makes
  the log authoritative rather than merely historical.
- **No core interpretation of module payloads.** Not in projections, not in queries, not "just for
  search". The moment core reads inside a `sys.*` payload, modules stop being replaceable.
- **No general query language over the log.** Projections are named and purpose-built. A query layer
  is a thing to want later, with evidence.
- **No snapshots yet.** See the open question below.

## Open questions

**How does the renderer see projections?** Projections are computed in main, next to SQLite. The
renderer needs them, and must not know Electron exists, so they cross the typed IPC contract. The
options are to push whole projections on every change, which is simple and wasteful, or to push a
changed slice, which needs a diff or a per-slice version. What would settle it: the size of a
realistic projection for a campaign of a few thousand events, measured rather than guessed.

**When do snapshots become necessary?** A snapshot is a `(seq, serialised state)` pair, and the
pure-fold design makes it easy to add. It is not needed at the sizes a solo campaign plausibly
reaches, but "plausibly" is doing real work in that sentence. What would settle it: measuring full
replay at 1,000, 10,000 and 50,000 events, and picking a threshold with a number behind it.

**May `EffectSuggestion.events()` read projections?** Flagged as open in the module contract. This
record's position is that it should, read-only, because a suggestion like "mark progress" genuinely
depends on current state. That makes `CampaignContext` a read-only projection view. Confirm when the
first real suggestion is built.

**Does a revision need to name which fields it replaces?** Under absolute corrections, a revision
carries a full value. For a prose entry that is obvious. For an entity with twenty fields, replacing
all of them to correct one is lossy about intent, even if the result is identical. A field mask
would preserve intent at the cost of a more complex payload. What would settle it: the first
entity-editing feature.

**Where does roll provenance live in the enum?** `DieValue.source` is `'digital' | 'manual'` today.
A third source is already foreseeable, since integrating a shared 3D dice service would make some
rolls neither local-digital nor physical. This is a payload schema, so adding a value is a versioned
change with an upcaster, which the design supports. Worth deciding early whether the enum is closed
or whether provenance is a richer record carrying the source's identity.

## Consequences elsewhere

- `SystemModule` gains projection reducers. Contract change, one-way door.
- `packages/core` gains the event store, the projection host, and the upcasting reader. It stays
  free of Node and Electron, so the SQLite binding lives in `apps/desktop` behind an interface core
  defines. Core describes what a log needs to do; the app supplies a SQLite implementation.
- The toy module must be able to implement a projection reducer trivially, or the contract is wrong.
  Coin flips need almost no module state, which is exactly why it is the canary.
- Testing gains the permanent honesty tests from the module contract: replay determinism, event
  round-trip through upcasters, and a recorded session fixture as the regression net.

## What would make this record wrong

Written down so the failure is recognisable rather than rationalised.

If a realistic campaign turns out to be tens of thousands of events within a few sessions, the
in-memory full-replay decision is wrong and snapshots stop being an open question. If module
reducers turn out to need platform access, the platform-neutral constraint is wrong and modules need
a different split. If absolute corrections turn out to make the common edit path clumsy, the
correction model is wrong and reversibility has to be paid for after all.
