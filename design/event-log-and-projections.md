# The event log and how current state is worked out

Status: accepted, 3 August 2026. Decomposed into epic
[#31](https://github.com/liminalfield/aether-forge/issues/31) and its tasks.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

This is the first design record because everything else depends on what it decides, and because it
is the hardest thing to change later. Once someone has played a campaign, their history is written
in whatever shape we chose here, and we have to keep reading it forever.

## The idea this rests on

Everything that happens in a campaign is written down as a numbered list of small facts, and never
changed afterwards. "Entry written." "Two ten-sided dice rolled, showing 7 and 3." "Track advanced
by two." "Suggestion offered." "Suggestion declined."

That list is the campaign. It is the only thing we store.

Everything the application shows you is worked out by reading the list from the beginning. The
character sheet, a track's current value, which threads have gone quiet, the journal itself: none of
these are stored anywhere. They are recalculated from the list.

This is called event sourcing. The reason to accept its costs is that it gives the product three
things it has committed to:

- **The session log is the real artefact.** It is not a side effect of the app's state. It is the
  state.
- **Anything can be corrected without destroying what happened.** You change the past by adding a
  correction to the end of the list, not by editing history.
- **What the app suggested and what you chose are both recorded.** That is what makes "the app
  computes everything and decides nothing" checkable rather than a slogan.

Two words are used throughout, and this record means something specific by each.

**An event** is one recorded fact, with a number, a type, and some data. It never changes.

**A projection** is any view of the campaign built by reading events in order. A character sheet is
a projection. So is a track's current value, and the list of threads that have not moved recently.
Building one means starting from nothing and applying each event in turn.

## What an event actually looks like

Everything above is easier to judge against a real one. Here is a roll of two six-sided dice.

```json
{
  "id": "01K9QF3W7ZR8XN2VC4MTBD6H1A",
  "seq": 47,
  "at": "2026-08-03T09:12:44.108Z",
  "type": "core.roll.performed",
  "schema_version": 1,
  "system_id": null,
  "causation_id": "01K9QF3W2MJH5PYQ0S8EAK4RN7",
  "revises": null,
  "payload": {
    "request": {
      "dice": [{ "sides": 6, "count": 2 }],
      "reason": { "kind": "check", "refId": "starforged/moves/face_danger" }
    },
    "dice": [
      { "sides": 6, "value": 4, "source": "digital" },
      { "sides": 6, "value": 2, "source": "manual" }
    ]
  }
}
```

Three things about that are deliberate.

**It records what was asked for as well as what came up.** `request` says two six-sided dice were
called for; `dice` says what they showed. Keeping the request means the log still makes sense years
later, after the move that asked for it has changed.

**Where each die came from is recorded separately.** In this example the app rolled one and the
player typed in a real one they had just thrown. People mix, so this is per die rather than per
roll. It is also the field that gains a third possibility if dice are ever rolled through a service
like dddice.

**No total is stored.** There is no `"sum": 6`. A total can be calculated, and calculated things are
never stored. It is also not core's business: whether you add the dice, take the highest, or compare
them against each other is a rule, and rules belong to system modules.

### How events connect

`causation_id` points at the event that caused this one. It always points backwards, because an
event cannot know what it will go on to cause. To follow a chain forwards, you look for events
pointing at the one you are holding.

A single Starforged move produces a chain like this:

| Number | Event                            | Caused by | Carries                                                        |
| ------ | -------------------------------- | --------- | -------------------------------------------------------------- |
| 46     | `sys.ironsworn.move.invoked`     |           | which move, which stat, what was added, what the app suggested |
| 47     | `core.roll.performed`            | 46        | the dice, as above                                             |
| 48     | `sys.ironsworn.move.resolved`    | 47        | a strong hit                                                   |
| 49     | `core.suggestion.offered`        | 48        | "Momentum +1"                                                  |
| 50     | `core.suggestion.accepted`       | 49        |                                                                |
| 51     | `sys.ironsworn.momentum.changed` | 50        | +1                                                             |

So the roll points back at what triggered it, and the outcome points back at the roll.

Events 49 and 50 are the part that makes "the app computes everything and decides nothing"
verifiable. The log records what was proposed and what the player did about it. Had they declined,
50 would say so and 51 would not exist at all.

### What this shows about the split

The roll event contains no stat, no bonuses, and no hit or miss. Core knows about dice and numbers.
It does not know what a stat is, or what counts as a hit.

That is why there is a module event on each side of the roll: one carrying the inputs, one carrying
the interpretation. Putting the stat and the outcome directly onto the roll event would be less work
now, and it would put rulebook concepts permanently inside a core event.

Consulting an oracle shows the same seam with less machinery:

| Number | Event                   | Caused by | Carries                                                               |
| ------ | ----------------------- | --------- | --------------------------------------------------------------------- |
| 60     | `core.roll.performed`   |           | one hundred-sided die, showed 47, typed in by hand                    |
| 61     | `core.oracle.consulted` | 60        | the table, the result, and which content package version it came from |

The roll is only a number. The meaning is a separate event, and it records the package version so
that the log still explains itself after the player updates their content.

### And a re-roll

An ability that lets you reroll a die appends a new `core.roll.performed` whose `revises` points at
the old one, carrying the whole new set of dice rather than "the second die is now a 5".

That is the correction rule described further down, and this is the case that shows why it earns its
place: nothing anywhere has to work out how to un-roll a die.

## What this record covers

How an event is stored, how events are ordered, how projections are built from them, how a system
module takes part when core is not allowed to understand that module's events, and how a correction
to the past is recorded.

Several related things need their own records and are not decided here: what entities and relations
actually mean, the prose journal and its editor, the session-zero flow engine, content packages and
the Datasworn importer, and the image store beyond the fact that it sits outside the log.

## The problems to solve

The commitment above creates four specific risks. This record exists to settle them.

**Rebuilding has to give the same answer every time.** If the calculation looks at the clock, or
uses a random number, or depends on the order items happen to come out of a lookup table, then the
same campaign can show different values on different days. That would make the whole model
untrustworthy, and it would make bugs almost impossible to chase.

**Rebuilding has to be fast enough to do constantly.** If showing a track's value means re-reading
ten thousand events, the app will feel slow.

**Corrections must not force a rebuild from scratch.** If correcting something means undoing an
event that was already applied, every calculation has to know how to run backwards. That is a large
permanent tax.

**Core cannot understand module events.** Core is forbidden from looking inside the data of a system
module's events, which is what keeps modules replaceable. But something has to turn those events
into state. Nothing in the module contract currently does, which is a gap rather than an oversight.

## Decisions

### One SQLite file per campaign

Each campaign is a single database file under the application's data directory, which is what the
current code already does.

A campaign is the thing a person exports, backs up, and might one day hand to someone else. Keeping
one campaign in one file makes all three of those a file operation instead of a careful query.

The events table holds the log. One row per event:

| Column           | What it holds                                                              |
| ---------------- | -------------------------------------------------------------------------- |
| `id`             | A unique identifier for this event                                         |
| `seq`            | Its position in the campaign: 1, 2, 3, and so on                           |
| `at`             | When it happened, by the computer's clock. For display only                |
| `type`           | What kind of event it is, for example `core.entry.revised`                 |
| `schema_version` | Which version of this event type's data shape was used when it was written |
| `system_id`      | Which system module owns it, if any                                        |
| `causation_id`   | The event that caused this one, for example the roll that led to an effect |
| `revises`        | The earlier event this one corrects, if any                                |
| `payload`        | The event's data, as JSON                                                  |

The database itself refuses updates and deletes on this table, using SQLite triggers that raise an
error. Append-only is the central promise of the whole design, and a promise enforced by the
database survives a careless change to the code above it.

### Events are numbered by whoever writes them, one at a time

The next event's number is the highest number so far, plus one, worked out inside the same
transaction that inserts it.

This is safe because only one thing ever writes: the Electron main process. The window you interact
with cannot open the database at all. It has no filesystem access, no `require`, and no Node. It
asks the main process to do things through a small list of named channels, and that is the only way
in.

So there is never a moment when two writers could both claim number 47.

This assumption is worth stating plainly because a future feature could break it without meaning to.
A second window writing directly, a background worker, or anything that syncs would all violate it.
If any of those ever arrive, event numbering is the first thing that has to be redesigned.

### Order comes from the number, never from the clock

`at` records when something happened, for a person reading their own log. It is never used to sort,
compare, or resolve anything.

Clocks go backwards. People travel, change timezones, and have machines with the wrong date. None of
that may be able to reorder someone's campaign.

### Old events are translated on the way in, not stored twice

Every event records which version of its data shape was used when it was written. When we later
change that shape, for example by adding a field, we write a small translation function that turns
the old shape into the new one.

That translation happens when an event is read, before anything else sees it. So the calculations
that build projections only ever handle the current shape, and never accumulate a pile of "if this
is an old one" special cases.

The log itself is never rewritten. A campaign from a year ago is read through translations, not
migrated.

### State is rebuilt in memory, from the beginning, when a campaign opens

Opening a campaign reads its events in order and builds the projections. After that, each new event
updates them as it is written. Nothing is cached to disk.

Every calculation that builds a projection must be predictable: given the same current state and the
same event, it always returns the same result. It may not look at the clock, use random values,
depend on the order items come out of a lookup table, or read anything outside the events it is
handed.

The reason to start with the simple version is that replaying the log is the definition of the
model, so an implementation that literally replays it is one whose correctness you can see. Storing
projections in the database is a speed optimisation, and speed optimisations should be made when
there is a measurement showing they are needed.

The structure is arranged so that storing them later changes where state is kept, not how it is
calculated.

**How we will check this:** a recorded session of thirty to fifty events, replayed twice, produces
exactly the same state both times. The same test runs against both the Ironsworn module and the toy
module.

### A correction replaces a value, it never describes a change to one

This is the decision most likely to be wrong, and the one with the widest reach.

When you correct something, the correction carries the new value in full. If a journal entry is
edited, the correction contains the new text. If an entity's field was wrong, the correction
contains what it should be. Building a projection then means later values win, and no calculation
ever has to undo something it already did.

The alternative is a correction that describes a difference from what it replaces. That forces every
calculation to be reversible, so that the old event can be backed out. Reversibility is a permanent
cost paid by every future calculation, in order to serve a rare operation. The other way out is to
rebuild from the beginning after every correction, which gets slower as a campaign grows.

Some events are inherently about change rather than value: momentum dropped by one, progress was
marked. Those are not corrected. They are compensated, by adding another event that moves the value
back, which is what the brief already describes. The log then shows what happened and what was done
about it, which is more honest than a silent fix.

So there are two kinds of event, and the distinction has to be clear when each event type is
designed:

- **Events that carry a value** may be corrected, and the correction carries the whole new value.
- **Events that carry a change** are never corrected. They are compensated by a further change.

### Invoking a move is its own event, separate from the roll

> Amended by `checks-and-moves.md`, and annotated here later than that record promised, 7 August
> 2026: the invocation event carries what the check ran with, and not what was suggested. The
> suggestion audit lives in the `core.suggestion.*` events, which did not exist when this was
> written. The example chain near the top of this record says "what the app suggested" for event 46
> for the same reason, and is wrong the same way.

When a move is invoked, that is recorded as an event in its own right, before the roll it causes. It
carries which move, which stat was chosen, what was added, and which of those the application
suggested rather than the player deciding.

Hanging that information on the roll event instead would mean one event per move rather than two.
There are two reasons not to.

Core owns the roll event, and core does not know what a stat is. Putting the inputs there would put
rulebook vocabulary inside a core event permanently, and that is exactly the split the project
exists to keep.

The stronger reason is that this is what makes the audit trail real. The product promises the log
records what the application suggested and what the player actually chose. If those inputs live only
on a core roll event, then either core has to learn what a stat is, or that information is not
recorded anywhere.

The cost is one extra event for every move. That is accepted.

### System modules calculate their own state

Core may not look inside a module's event data. That rule is what makes modules replaceable, and it
is not negotiable. But module events have to become state somehow.

The module contract currently lets a module render its events and translate old ones. It has nothing
that turns them into state. That is a hole, and it needs a new part of the contract:

```ts
interface ModuleProjection<S = unknown> {
  id: string; // names this slice of state
  initial(): S; // what it starts as
  apply(state: S, event: EventEnvelope, ctx: ProjectionContext): S;
}
```

Core holds that state without understanding it, in exactly the way it already holds event data. It
stores it, hands it back when asked, and never looks inside. `ProjectionContext` gives the module
read-only access to core's own projections, because a module reasonably needs to know things like an
entity's current fields.

Two costs come with this, and both are real.

A module's calculation has to be predictable, by the same rule as core's.

A module's calculation also has to be plain computation, with no access to the outside world. No
reading files, no network calls, no Electron, no touching the browser page. This is because it runs
inside the main process, where state is rebuilt and where there is no page to touch, while the same
module's display code runs in the window. If a module ever needs information from outside, it has to
be fetched elsewhere and handed in as data.

**This changes the module contract, which is a one-way door.** Once a module exists outside this
repository, changing this shape breaks it.

### Images live outside the log

Images and other files are stored separately, named by a hash of their contents, with events and
entities referring to them by that hash. This is already decided in the brief and is repeated here
because it affects replay speed.

Keeping the log to text is what makes replaying it cheap, and what makes a campaign file something
you can open and read.

### You can carry a campaign to another machine

A campaign can be exported to a single file and imported somewhere else. Take it on a laptop, play
on the trip, bring it home.

This is not syncing. Nothing happens automatically, nothing runs in the background, there is no
account, and nothing talks to a server. It is a file you move, and you decide when.

The bundle is the log, the entities and the images together, which the brief already describes.

The part worth designing carefully is what happens when it comes back, because by then two copies
exist and they may have both been played. Numbered events that never change make this cheap to work
out:

- **If only one side moved on**, there is nothing to decide. Say your desktop's campaign still ends
  at event 120 and the copy you brought back continues to 147. The desktop simply takes events 121
  to 147. Nothing is lost and nobody is asked anything.
- **If both sides moved on**, they have genuinely diverged. Perhaps the desktop reached 131 while
  the travelling copy reached 147, and events 121 onwards are different on each. The application
  will not try to combine them. That is the merging problem this design deliberately does not take
  on, and quietly guessing would be worse than refusing. It says clearly that both have been played
  since they parted, and offers to keep the imported one as a separate campaign so that nothing is
  destroyed.

To make that comparison trustworthy, the bundle carries a fingerprint of the history it shares with
the original, so that two campaigns that merely happen to share an identifier are never mistaken for
the same campaign.

The honest advice the application should give alongside this feature is to play in one place at a
time. The divergence case exists to protect you, not to be a workflow.

## What we are deliberately not doing

**No syncing between devices.** Your campaign lives on your machine. There is no account and no
server. You can still carry a campaign to another machine yourself, as described above; what we are
not building is anything that does it for you, in the background, while you are playing in two
places.

This is worth explaining rather than asserting, because it is the reason event numbering can stay
simple. If two devices could both edit a campaign while offline, they would both create event 47,
and we would have to either pick a winner or give up on simple numbering entirely. The established
answer is a family of data structures called CRDTs, which merge edits from several places without
anything coordinating them. They work, and they make every part of this design more complicated.
Nothing in the product asks for it, so we are not paying for it.

**No deleting events.** Permanently removing history is a separate, deliberate feature, and not
something that happens in normal use.

**No storing anything that can be calculated.** If it can be worked out from the log, it is worked
out. Storing it as well creates two sources of truth, and one of them will drift.

**Core never looks inside module event data.** Not for projections, not for search, not "just this
once". The moment it does, modules stop being replaceable.

**No general way to query the log.** Projections are specific and named. A query layer is something
to build when there is a real need.

**No snapshots yet.** See below.

## Open questions

Each of these is genuinely undecided. Each says what would settle it.

**How does the window get the campaign's current state?**

> Settled by `reading-and-writing-the-journal.md`, 4 August 2026, by measuring: at ten thousand
> entries the whole journal crosses the IPC boundary in under twenty milliseconds, and drawing it is
> where the time goes. The window gets the whole thing, and windowed rendering is the fix if drawing
> ever matters.

Projections are built in the main process, next to the database. The window needs them, and it
cannot reach into the main process directly, so the state has to be sent across.

The simple option is to send the whole projection whenever anything changes. That is easy to get
right and wasteful. The other option is to send only what changed, which needs a way to work out
what changed.

_What would settle it:_ measuring how large a realistic projection actually is for a campaign of a
few thousand events. If it is small, send the whole thing and stop thinking about it.

**When do we need to save snapshots?**

A snapshot is a saved copy of the state as of event N, so that opening a campaign can start from
there instead of from event 1.

The design makes snapshots easy to add later. What is unclear is when they become necessary, and "a
solo campaign will never get that big" is an assumption, not a measurement.

_What would settle it:_ timing a full replay at one thousand, ten thousand and fifty thousand
events, and choosing a threshold from those numbers.

**When the app proposes an effect, may it look at current state?**

When a move suggests "mark progress", working out what to suggest may depend on the current state of
that track.

The module contract flags this as open. This record's position is that it should be allowed, but
read-only. Suggestions may read; only accepting one writes anything.

_What would settle it:_ building the first real suggestion and seeing whether it needs state.

**Should a correction say which fields it is replacing?**

> Settled by `entities-and-tracks.md`, 7 August 2026, by dissolving it: an entity edit was never a
> correction. `core.entity.changed` names the fields it sets and carries each one's whole new value,
> so nothing is lost and nothing is repeated. Corrections stay whole, and `revises` keeps meaning
> only "this event was written wrongly".

Under the decision above, a correction carries the whole new value. For a journal entry that is
obviously right. For an entity with twenty fields, replacing all twenty to fix one loses the
information that only one was meant to change, even though the result is identical.

Recording which fields were intended would preserve that, at the cost of a more complicated event.

_What would settle it:_ the first entity-editing feature, and whether the log reads sensibly without
it.

**Should exporting a campaign mark the original as put aside?**

If you export to take a campaign travelling, the copy left behind could be marked as handed over, so
that opening it warns you before you play and create a divergence you will have to sort out later.

That prevents the awkward case rather than reporting it. It is also annoying in the obvious way: if
the travelling machine is lost, stolen, or simply not with you, you would have to override the
warning to use your own campaign, and a warning people routinely override is worse than none.

_What would settle it:_ using export and import in practice for a few real trips and seeing whether
divergence actually happens or is a hypothetical.

**What do we record about where a roll came from?**

> Settled by `rolling-dice.md`, 5 August 2026: each die's source is a record naming where it came
> from (`digital`, `manual`, or a named service carrying that service's own identifiers), not a word
> from a fixed list. The same record also decided that a roll names no content package, so the aside
> below about rolls recording a package version is superseded too.

A roll currently records, for each die, whether it was rolled by the app or typed in by hand.

Integrating dddice adds a third case: a die rolled by a service. That is a change to a recorded
event shape, which is permanent once campaigns exist, so it is worth deciding early whether this
stays a short list of options or becomes a small record that can also hold something like the dddice
room and roll identifier, the way roll events already record which content package version they
used.

_What would settle it:_ the dddice design record, which should come before the first roll event is
ever written.

## What this changes in other parts of the project

**The module contract gains a new part.** Modules will need to supply the calculation that turns
their own events into state, as described above. This is a permanent change to the contract.

**Core gains the event store, the code that builds projections, and the translation layer for old
events.** Core is not allowed to touch Electron or the filesystem, so core defines what a log has to
be able to do, and the desktop app supplies the SQLite implementation of it. Core describes; the app
provides.

**The toy module has to be able to do this trivially.** If implementing a projection for a coin flip
is awkward, the contract is wrong. That is the whole reason the toy module exists.

**Testing gains three things** that the module contract already asks for: checking that a replay
gives the same answer twice, checking that every event type survives being written and read back
through its translations, and a recorded session used as a regression test for the whole engine.

## How we would know this design is wrong

Written down now, so that if it happens we notice, instead of explaining away the symptoms.

**If a normal campaign reaches tens of thousands of events after only a few sessions**, then
rebuilding state by replaying everything will be too slow, and snapshots stop being an open question
and become required work.

**If a module turns out to genuinely need access to files, the network, or the page** in order to
work out its state, then the rule that module calculations are plain computation is wrong, and
modules need to be split differently, with the outside-world part living somewhere else.

**If corrections that carry whole values make ordinary editing awkward**, for instance if editing
one field of an entity produces confusing history, then the correction model is wrong and we will
have to pay for reversibility after all.
