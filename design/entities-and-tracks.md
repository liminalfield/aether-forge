# Entities, and the tracks they carry

Status: proposed, 7 August 2026. Not yet agreed, not yet decomposed.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

Four earlier records name this as the thing they are waiting for. A check types its stat in at the
point of rolling because there is no character to read one from. The pre-roll half of
assisted-but-sovereign is built and idle because a suggestion has nothing to read. The journal
defers rich text because a mention needs something to mention. The right rail of the design holds
tracks that do not exist. This record is about the thing under all of that: what an entity is, how
one comes to exist, how it changes, and how a track rides on one.

## The idea this rests on

An entity is a named thing in the campaign with some recorded facts about it. A character, an NPC, a
faction, a place, a ship, a vow. Like everything else, it is not a row that gets updated: it is a
projection, worked out by reading the log. What is stored is the moments: the moment something was
first written down, and each moment somebody changed what is known about it.

Two words carry this record.

**A field** is one recorded fact about an entity: its name, its description, a stat, a rank. Fields
are plain values, and different kinds of entity carry different fields.

**A track** is a row of segments some of which are filled, with a number saying how many. A vow's
progress, a clock's wedges, a condition meter. A track belongs to an entity, and an entity may carry
none, one, or several.

## What an entity looks like in the log

A character is created during session zero, and later her player corrects a stat. Three events:

```json
{
  "seq": 12,
  "type": "core.entity.created",
  "schema_version": 1,
  "system_id": null,
  "payload": {
    "entityId": "01K9QG8MZV5T2XW4YB7NC3RD9F",
    "entityType": "sys.ironsworn-starforged.character",
    "fields": { "name": "Vess", "edge": 1, "heart": 2, "iron": 1, "shadow": 2, "wits": 3 }
  }
}
```

```json
{
  "seq": 13,
  "type": "core.track.started",
  "schema_version": 1,
  "payload": {
    "entityId": "01K9QG8MZV5T2XW4YB7NC3RD9F",
    "trackId": "health",
    "segments": 5,
    "filled": 5
  }
}
```

```json
{
  "seq": 58,
  "type": "core.entity.changed",
  "schema_version": 1,
  "payload": {
    "entityId": "01K9QG8MZV5T2XW4YB7NC3RD9F",
    "fields": { "iron": 2 }
  }
}
```

Three things about those are deliberate.

**The fields are plain data and core stores them without judging them.** Core does not know what
`iron` is. It knows the entity has a field called `iron` holding 2, and it can say so to anything
that asks. The words are the module's; the storage is core's. This is a different arrangement from
`sys.*` payloads, which core refuses to read at all: entity fields are core's own data, because the
journal, the rails, the mention search and the export all have to work over entities of every type,
including types from modules that are no longer installed.

**A change carries the fields it sets, whole.** Event 58 says `iron` is now 2. It does not say "+1",
and it does not repeat the four stats that did not change. The event log record left one question
open in exactly this place: a correction that replaces a twenty-field entity to fix one field loses
the information that one field was meant. The answer is that an entity change was never a correction
at all. It is its own event, it names what it sets, and each named field carries its whole new value
rather than a delta. Nothing is lost, nothing is repeated, and no event needs to be revised to
change a description. `revises` stays for what it always meant: this event was written wrongly, here
is what it should have said.

**The track is its own event, not a field.** A track's state changes far more often than an entity's
facts, it changes by amounts ("two ticks of progress"), and what changed it matters ("marked from
Face Danger" reads differently from "marked, no reason given"). Folding tracks into fields would
make every advance a field rewrite and lose the amount. So a track is started once, and then
advanced.

## Decisions

### Entity types come from modules, entities belong to core

A module contributes entity templates: a type identifier, a name, the fields entities of that type
usually carry, and the tracks they usually start with. The Ironsworn module declares a character
with five stats and three condition meters, and a vow with a rank and a ten-segment progress track.

A template describes. It never enforces. An entity may carry fields its template does not mention,
may lack fields it does, and may exist with no template at all: a free-form entity with a name and a
description is first-class, not a degraded case. This is the same posture as everywhere else in the
contract. There is no channel through which a template could refuse an entity, and adding one would
be the same mistake as a check that refuses a stat.

Templates are read the way glyphs and tones are read: from the module as it stands today, for
presentation and for offering. What a template mainly does is power creation ("new vow" knows what a
vow starts with) and give a sheet its shape later.

### Created where you are writing, named or not

The brief calls for create-as-you-write: an entity born from the sentence being typed. Two things
follow.

**Creation is one small event, not a form.** `core.entity.created` needs a type and whatever fields
the moment supplies, which may be nothing but a name, and may not even be that.

**A name is optional.** The design's left rail has an "unnamed" group for open questions like
"whoever paid the indenture". That is an entity with no name yet, and it must be recordable the
moment it matters, not once somebody has thought of what to call it. An entity's display name is its
`name` field when it has one, and something honest like its type and age when it does not.

The editor mechanics of mentioning (the `@`, the underline, the inline creation flow) belong to the
journal's rich-text record, which has been waiting on this one. This record supplies what it needs:
an entity can exist, sparsely, from one keystroke's worth of information.

### A track is started, advanced, and re-set, and each is a change

Three events: `core.track.started` fixes the shape (how many segments, how full it begins),
`core.track.advanced` moves it by an amount (positive or negative), and `core.track.set` states a
new fill outright, for the moments a rule or a person says "it is now at 3" rather than "it moved by
2".

All three are change-events in the event log record's terms: they are compensated, not corrected.
Un-marking progress is a further advance with a negative amount, and the log keeps both, which is
what a record of a game is. `revises` on a track event means only "I wrote the wrong number in".

There is no legality anywhere in this. A track can be advanced past full and below empty, and the
projection reports what the log says. Whether 12 segments of 10 means something (an Ironsworn
momentum above its cap does) is the module's business at presentation time, never a refusal at
recording time. The one refusal, matching rolls, is shape: a track cannot be started with a negative
number of segments, because that is not a track, the way a d10 showing 12 is not a die.

### Suggestions reach entities through the same door as everything else

When a weak hit proposes "mark two progress on this vow", that is the existing suggestion machinery,
unchanged: the module proposes a draft `core.track.advanced`, the four `core.suggestion.*` events
record what was offered and what the player did, and accepting writes the track event. Entities do
not get their own consent channel; they use the one the product already has.

This record makes the pre-roll half real too. A `CheckInput` whose source is `read` can name the
entity field it reads, so "Face Danger with iron" can arrive with iron's actual value and the audit
trail of where it came from, declinable as ever. The wiring of `suggest` is its own decomposition
step, but the shape it reads from is decided here.

### The projection answers the questions the surfaces ask

One core projection holds current entities: for each, its type, its fields as of now, its tracks and
their fill, and which events last touched it. That is enough for the left rail (entities by type,
unnamed grouped), the dossier's facts, the sheet's stats, and a mention search.

The dossier's "appears in" list is not stored anywhere. An entity's appearances are the events that
reference it, found by reading the log, the same way a roll's chain is followed. Storing a
connection graph would be a second copy of facts the log already holds, and two records of one fact
eventually disagree.

## What we are deliberately not doing

- **No relation events.** The brief says "typed graph", and the graph this record ships is the
  computed one: entities appear together where events say they did. Explicit, named relations
  ("sworn to", "owes") are real and wanted, and they arrive with threads, where the reasons to store
  them (staleness, narrative weight) actually live.
- **No threads.** Open loops, staleness, "previously on" are the next record, on top of this one.
- **No sheet layout.** `SheetDefinition`, its regions and its derived values are presentation, and
  they belong with the playkit-sheet surface work. The sheet's data (fields, tracks) is this record;
  the instrument drawn from it is not.
- **No mentions.** The journal's rich-text record owns the editor. This record only guarantees an
  entity can exist the moment the editor wants one.
- **No portraits or blobs.** The blob store is untouched and still deferred.
- **No entity deletion.** Putting an entity away (dead, resolved, irrelevant) is a field like any
  other ("status"), or a module's convention. True deletion stays with the compaction feature.

## Open questions

**How does the application know which entity is the player's character?**

The sheet, the pre-roll stat read, and momentum all need "the character" rather than "a character".
A campaign could record it (an event marking an entity as played), or it could stay a convention
(the first character-typed entity). It matters because `suggest` has to pick whose iron to read.
_What would settle it:_ the session-zero flow design, which is where the character comes from in
play; until then, the projection can expose character-typed entities and the surfaces take the
first.

**Does a template change when its module updates, and what happens to existing entities?**

Nothing in this design stores template contents, so an updated template simply describes future
creations and current presentation. But a module that renames a field (say `iron` becomes `frame`)
leaves old entities carrying a field the template no longer names. The design tolerates this (extra
fields are legal), but whether modules owe an upcaster for entity fields the way they owe one for
payloads is undecided. _What would settle it:_ the first real module update that renames a field;
until one exists, deciding would be guessing.

**Is `filled` the only state a track needs?**

Ironsworn progress fills in ticks (four per box), clocks fill in wedges, condition meters are a
number. One integer covers all three so far, with the module owning what a unit means. Scene
challenges pair a track with a clock, which this design writes as two tracks on one entity. If some
system needs per-segment state (a burned segment, a locked wedge), `filled` is too small. _What
would settle it:_ stress-testing the 5e and Mythic columns of the contract document against real
mechanics from those systems.

## How we would know this design is wrong

- An entity type that cannot be expressed as fields plus tracks shows up in the first module beyond
  Ironsworn, and needs its own event family to be usable.
- The "appears in" computation is too slow on a real campaign, which would mean the log walk needs
  an index, and the fix is an index, not stored relations.
- Creation-in-flow turns out to need more than one event's worth of ceremony, which would mean the
  create event is shaped wrong for how writing actually happens.

## What this changes elsewhere

- **The module contract §7 changes.** `EntityTemplate` loses nothing but gains nothing either; the
  sketch's `SheetDefinition` is explicitly split off to the surface work. `TrackSpec` moves from
  sketch to code. The contract document gains the core-owns-entity-fields distinction, which it
  currently does not state.
- **The event log record's open question about corrections naming fields is settled** by this
  record: entity changes name their fields and carry whole values, and corrections stay whole. The
  record gets its annotation when this one is accepted.
- **Both modules gain templates.** Ironsworn declares character and vow. The toy declares none, and
  every entity surface must render a campaign whose modules declare no templates, which is the
  canary doing its job.
- **The recorded session fixture gains an entity**, created sparsely, changed once, with a track
  advanced by a declined and then an accepted suggestion.
- **`suggest` becomes implementable**, which is the point.
