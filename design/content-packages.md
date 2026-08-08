# Content packages, and the importer that fills them

Status: accepted, 8 August 2026 (#157). Decomposed into epic
[#158](https://github.com/liminalfield/aether-forge/issues/158) and its tasks.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

The application knows one move. `system-ironsworn` declares Face Danger in code, with its text
written into the module, because there is no other place for content to come from. A solo RPG
companion with one move and no tables to consult is a dice roller. This record is about where the
rest comes from: what a content package is, how one gets into the application, what the log records
about using one, and where Datasworn is allowed to exist.

## The idea this rests on

Game content and game rules are different things, and the application treats them differently.

**Content** is what was written to be read: the names and text of moves, the tables an oracle
answers from, the descriptions of entity types. It is data, it is licensed, and it changes when its
publisher revises it.

**Rules** are what the module computes: what a strong hit is, which dice an action roll uses, what
happens to a track. They are code, in a system module, and they change only with the module.

A **content package** is a sealed box of content with a label on the outside. The label (the
manifest) says what it is, which systems can use it, what license it carries, and a hash of what is
inside. The box holds tables, documents, and entity templates in one neutral shape that core
understands, plus a compartment core does not open, for things only the owning module can read.

## What a package looks like

The label first, because everything else hangs off it:

```json
{
  "id": "datasworn-community.starforged",
  "version": "0.2.4",
  "title": "Ironsworn: Starforged Ruleset",
  "systems": ["ironsworn-starforged"],
  "license": "CC-BY-4.0",
  "attribution": "Ironsworn: Starforged is copyright Shawn Tomkin, used under CC BY 4.0.",
  "source": "bundled",
  "contentHash": "sha256-…"
}
```

And one table from inside, in the neutral shape:

```json
{
  "id": "starforged/oracles/core/action",
  "name": "Action",
  "dice": { "sides": 100, "count": 1 },
  "rows": [
    { "from": 1, "to": 1, "text": "Abandon" },
    { "from": 2, "to": 2, "text": "Acquire" }
  ]
}
```

Two things about those are deliberate.

**The license is machine-readable and the attribution is carried, not linked.** The application
renders attribution because CC-BY requires it, and it can only render what it holds. A package whose
license the build does not allow never gets bundled, which `check:licenses` and `check:content-leak`
already police.

**The table's rows carry ranges, not just texts**, because `core.oracle.consulted` records the row a
number landed on, range and all, and the two shapes have to agree. That event exists already; this
record supplies the thing it consults.

## Decisions

### Datasworn stops at the importer, and the importer is one implementation

Datasworn is the interchange format this project consumes, and `packages/importer-datasworn` is the
only place in the repository allowed to name a Datasworn type. It transforms Datasworn JSON into
content packages, and the same TypeScript implementation runs in two places: at build time,
producing the packages bundled into the application, and at runtime, when a person imports a file.
Both produce identical output, which is the only arrangement under which "it works bundled" and "it
works imported" are one claim instead of two.

The importer is tested against golden files: fixed Datasworn input, checked-in expected output. A
version bump of a Datasworn package regenerates the goldens in the same pull request, and that
regeneration is reviewed as a content-model change. This is already law in `CLAUDE.md`; the record
repeats it because the goldens are the importer's real specification.

The source packages are `@datasworn-community/*`, the live lineage, pinned exact: `starforged` at
0.2.4 and `core` at 0.2.9 as of this record, both verified against the registry today rather than
remembered. Classic Ironsworn (`ironsworn-classic` 0.2.2) follows once Starforged works; the
maintainer plays Starforged, and one real system end to end beats two half-imported ones.

### Installing a package is not a campaign event

The module contract's sketch listed a `core.package.*` event family. This record removes it, and the
argument is worth writing down.

A campaign log is the history of one game. Which packages are installed is a fact about a machine:
install a package and every campaign on that machine can see it; carry a campaign to another
machine, as the bundle feature already supports, and the packages do not come along. Recording
installation into the campaign log would write machine state into game history, and the export would
either drag it about or strip it, both wrong.

What the log actually needs it already has: `core.oracle.consulted` stamps the package id and
version it resolved against, per consultation. That is the audit trail. A campaign opened on a
machine that lacks a package it references still replays perfectly, because every consultation
recorded its row; what is lost is only the ability to consult that package anew, and the application
says so rather than pretending otherwise.

So the registry is application state: bundled packages inside the install, imported ones copied into
the application data directory, hashed on the way in, never referenced in place. A manifest index,
not an event log.

### Moves arrive as content; what they mean stays code

A Datasworn move is text, a name, an identifier, and structured hints about how it rolls. It is not
executable, and the contract forbids a module shipping exhaustive executable rules anyway.

The split: the package carries each move as a **document** (its text, for the reference browser
later) plus structured facts (its identifier, which stats it offers, what kind of roll it is). The
module carries a small set of **interpreters**, one per kind of roll Starforged actually has: the
action roll, the progress roll, the no-roll procedure. At load, the module builds its
`CheckDefinition` list by joining the two: identity, name, `docRef` and stat options from the
installed content; `roll`, `decisive`, `interpret` and outcome styles from the interpreter the
move's kind selects.

Face Danger's hand-written declaration retires when this lands, and every other Starforged move
arrives at the same moment, because they are rows of content joined to the same three interpreters,
not eighty hand-written checks.

A move whose kind the module does not recognise is listed as reference text and offers no check,
which is honest: the application can show what it cannot yet run.

### Oracle providers resolve; the registry lists

The contract's seam stands: providers resolve a result they are handed, and rolling belongs to the
roll machinery, which is what makes a typed-in d100 identical to a rolled one everywhere. The first
provider is the obvious one, answering from installed packages' tables. Its `resolve` finds the row
a number lands on and returns the text, the table, and the package stamp for the event.

`listTables` exists for the oracle surface later and for `followUps`; nothing in this record builds
that surface. Consulting stays reachable the way the recorded session already does it: a roll, then
a consultation caused by it.

### Bundled content is CC-BY, and imports may be more

The release artifacts bundle only CC-BY packages, so they stay freely redistributable. CC-BY-NC
community content installs through the runtime import flow instead, landing in the application data
directory as an installed package with its license carried honestly. Licensed non-open content
(Mythic tables, non-SRD 5e) is not touched by this record at all: the empty-container design the
brief describes is real and deferred, and nothing here forecloses it.

Test fixtures use obviously-dummy content, as the recorded session already does, and
`check:content-leak` remains the backstop against real imported content reaching git.

## What we are deliberately not doing

- **No oracle surface.** The palette and the reference browser are design-system and rail work,
  after this. The engine path (install, list, resolve, record) is this record.
- **No user-side extraction tool** for licensed non-open content, and no empty containers yet.
- **No Mythic provider.** The provider seam accommodates it; nothing builds it.
- **No asset cards.** Datasworn carries assets; they ride into packages inside the module's
  compartment (`raw`) when the module wants them, and their surface is wave-two work. The importer
  does not interpret them yet.
- **No package update UI.** Updating means importing a newer version; what happens to older stamps
  is already answered by the stamps themselves.
- **No cross-package dependencies.** The contract lists `requires` as an open question; nothing here
  needs it, so nothing here decides it.

## Open questions

**How does an installed package live on disk?**

One JSON file per package beside a small index, or rows in the application's SQLite. JSON files are
inspectable and trivially copied; SQLite is already open and transactional. It matters for import
atomicity (a half-copied package must not look installed) and for how fast the registry lists at
startup. _What would settle it:_ the first implementation step, measuring startup with the real
Starforged package, which is a few megabytes.

**How much of a Datasworn table does the neutral row keep?**

Datasworn rows can carry embedded results, links to further tables, and formatting. The neutral
shape above keeps text and range, plus `followUps` on the outcome. Whether that loses something a
surface will want (a result that names a second table to roll) is unknown until the full corpus is
imported and read. _What would settle it:_ importing the real package and diffing what the goldens
drop against what the printed book does with those rows.

**Which document shape does the reference browser want?**

Documents are "renderable, hyperlinkable" in the contract sketch and nothing more yet. Markdown with
stable anchors is the obvious candidate, and wrong obvious candidates are how formats calcify. _What
would settle it:_ the reference browser's own design record; until then documents keep the source's
structure as faithfully as the importer can manage.

## How we would know this design is wrong

- The importer needs module-specific knowledge to produce a neutral package, which would mean the
  neutral shape is not neutral and Datasworn did not stop at the importer.
- The three interpreters do not cover the real move list, and the number of kinds starts growing
  toward the number of moves, which would mean moves-as-content was the wrong split and the
  contract's warning about exhaustive executable rules was being re-learned.
- A second machine opening an exported campaign needs anything beyond the stamps to make sense of
  it, which would mean package state leaked into game history after all.

## What this changes elsewhere

- **The module contract changes in three places.** §2 loses the `core.package.*` family, with the
  argument above. §3's sketch becomes the implemented shape. §9's assembled module gains how a
  module receives its installed packages at load.
- **`packages/importer-datasworn` becomes real**, with the pinned `@datasworn-community/*`
  dependencies, golden tests, and both entry points.
- **`system-ironsworn` stops hand-declaring Face Danger** and starts building its checks from
  content joined to interpreters. The toy is untouched: it declares no packages, consumes none, and
  everything must keep working, which is the canary's whole job.
- **The recorded session's dummy consultation** stays exactly as it is, which is itself a test: a
  consultation against a package the machine does not hold must remain readable forever.
