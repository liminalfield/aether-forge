# Rolling dice

Status: proposed, 5 August 2026. Not yet agreed, not yet decomposed.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

Dice are the last big piece of the core model with no declared shape. Two things are waiting on it:
rolling through dddice ([#12](https://github.com/liminalfield/aether-forge/issues/12)), and the
recorded session fixture that is meant to be the regression net for the whole engine. Neither can
start until a roll event has a settled shape, because a payload schema is permanent from the first
event ever written.

The accepted event log record sketched a roll event and then deliberately left one question open,
saying it should be settled "before the first roll event is ever written". This is that record.

## A worked example first

Two six-sided dice. The application rolled one and the player typed in a real one they had just
thrown across the table.

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
      "dice": [{ "sides": 6, "count": 2 }]
    },
    "dice": [
      { "sides": 6, "value": 4, "source": { "kind": "digital" } },
      { "sides": 6, "value": 2, "source": { "kind": "manual" } }
    ]
  }
}
```

That is the whole thing. No total, no stat, no hit or miss, no mention of what was being attempted.
Core knows dice and numbers. Everything that gives those numbers meaning lives in the events either
side of this one.

Three changes from the sketch in the event log record, each argued below: `source` is a record
rather than a word, `request.reason` is gone, and nothing here names a content package.

## Decisions

### Rolling happens before the event exists, and never again

The number is generated once, by whatever surface the player is using, and written into the event.
Reading the log back never rolls anything.

This sounds obvious and it is the single most important property here. The project promises that the
same log always produces the same projection, which means projection code cannot read a clock or a
random number. A die whose value were generated during replay would break that on the first read,
and it would break it silently: the campaign would be different every time it was opened.

So the value is in the payload, and the dice have already been thrown by the time anything durable
exists. There is nowhere else the number could live.

### A roll records what was asked for and what came up

`request` says two six-sided dice were called for. `dice` says what they showed.

Keeping the request matters years later, when the move that asked for it has been rewritten or the
module that defined it has been replaced. Without it, a roll of three dice is three numbers with no
indication of what they were for or whether any are missing.

**No total is stored.** There is no `"sum": 6`. Totals are calculated, and calculated things are
never stored. Whether you add the dice, take the highest, or compare them against each other is a
rule, and rules belong to system modules.

Dice keep the optional `label` a module can put on them, because a module handing back three dice
needs to say which is which, and it is the module's own word for its own concept. Core stores the
label and never reads it.

### Where each die came from is a record, not a word

This is the question the event log record left open.

Today the shape is a word: `"source": "digital"` or `"source": "manual"`. Rolling through a service
like dddice is a third case, and it needs to carry more than its own name. To audit a roll that
happened in a dddice room you need the room and dddice's own identifier for the roll, the same way
an oracle result records which package version produced it.

So `source` becomes a small record:

```json
{ "sides": 6, "value": 4, "source": { "kind": "digital" } }
{ "sides": 6, "value": 2, "source": { "kind": "manual" } }
{ "sides": 10, "value": 7, "source": { "kind": "service", "service": "dddice", "ref": "room/4kD9/roll/8812" } }
```

The alternative was to keep the word and add a separate optional field next to it for the service
details. That is terser for the common case, and it was rejected: a field whose presence depends on
the value of another field is the shape that produces "these two disagree" bugs, and a payload
schema cannot be tidied up later. Paying two extra characters on every ordinary die is the cheaper
end of that trade.

`kind` keeps the brief's existing words, `digital` and `manual`, so nothing has to be relearned.

**This does not build dddice.** It settles the shape so that dddice can be designed without a
contract-touching change to an event people already have in their campaigns. What `ref` contains for
a given service is that service's business, and core never parses it.

Per die rather than per roll, because people mix. Three dice from a service and one typed in because
it fell on the floor is an ordinary evening. When several dice do come from one service roll the
reference repeats across them, which is redundant, and that is accepted rather than solved: one
place to look beats a lookup table.

### A roll names no content package

The brief says roll events record the content package id and version they rolled against. This
record proposes that they do not, and that the brief is amended to say so.

A roll of two six-sided dice for a move rolls against no package. Dice are dice. What actually
depends on a package version is the resolution of a number into a row of a table, and that is a
separate event which already carries it:

| Number | Event                   | Caused by | Carries                                                        |
| ------ | ----------------------- | --------- | -------------------------------------------------------------- |
| 60     | `core.roll.performed`   |           | one hundred-sided die, showed 47, typed in by hand             |
| 61     | `core.oracle.consulted` | 60        | the table, the row it produced, the package id and its version |

Putting a package on the roll as well would mean two records of one fact, and the one on the roll
would be empty for every roll that is not a table lookup. The audit trail the brief is asking for
survives intact, on the event that can actually be affected by a package changing underneath it.

This is a change to a decision in `00-PROJECT-BRIEF.md` and therefore the maintainer's to make. The
proposed replacement wording: _events that resolve a roll against a table record the content package
id and version they used_.

### `request.reason` is dropped

The sketch carried `reason: { kind: 'check', refId: 'starforged/moves/face_danger' }`. This record
proposes removing it, which is a change to the module contract.

It duplicates `causation_id`. The roll is already caused by the module event that says which move
was invoked, which stat was chosen and what was added. `refId` is a second, weaker record of the
same fact, and two records of one fact eventually disagree.

It also puts a module-shaped identifier inside a core payload. Core would not interpret it, so this
is not a vocabulary violation, but it is core carrying a module's business for no gain.

The case it was covering is a table roll with nothing before it: you consult an oracle directly, so
there is no causing event and `reason.kind: 'table'` was the only hint what the dice were for. That
is covered by the event that follows, `core.oracle.consulted`, which names the table. At the moment
of rolling, core does not need to know why.

The cost is that a roll event read entirely on its own, with no neighbours, says less than it did.
Events are read in a log, next to the events around them, so that is a cost worth paying.

### Correcting a die and rerolling a die are different, and the log says which

Both append a new `core.roll.performed` whose `revises` points at the old one, carrying the whole
new set of dice rather than a description of what moved. That much is settled already, and it is
what means nothing anywhere has to work out how to un-roll a die.

But two quite different things arrive in that shape:

- **A correction.** You typed 4 and the die on the table says 7. The first roll never happened. It
  was a mistake in recording, not in the fiction.
- **A reroll.** An ability let you throw one of them again. The first roll did happen, it mattered,
  and a rule replaced it.

A projection does not care: the newest version wins either way. A person reading their own campaign
back cares a great deal, and so does the promise that the log is an honest record of what happened.
Without something to tell them apart, a history of six rolls cannot say whether this character got
lucky or whether someone kept fixing typos.

So the payload of a superseding roll carries why:

```json
"supersedes": { "roll": "01K9QF3W7ZR8XN2VC4MTBD6H1A", "because": "corrected" }
"supersedes": { "roll": "01K9QF3W7ZR8XN2VC4MTBD6H1A", "because": "rerolled" }
```

The alternative considered was to infer it: a reroll is granted by something, so the new roll would
have a `causation_id` pointing at a module event, and a correction would not. It was rejected. It
makes the absence of a field carry meaning, it breaks for any system with a plain reroll button and
no event behind it, and it breaks again the first time a correction has a cause of its own. Meaning
that is inferred from absence is meaning that quietly stops being true.

If a second event type later wants the same distinction, this should move up into the core event
envelope next to `revises` rather than being copied. It is on the roll payload now because the roll
is the only event type that has both cases.

### Validation is range only, and range means one to the number of sides

A d10 cannot show 12, and it cannot show 0. Values are whole numbers from 1 to `sides`.

That is the entire check. A value a rule would forbid is allowed. A combination a rule would forbid
is allowed. A player who wants to record that they rolled three sixes on three dice can do so, and
the application has nothing to say about it.

This is worth stating precisely because it is one of the only places validation exists at all, which
makes it the place someone will later be tempted to add "just one more" check to. There is no
channel through which a module could ask for one, and that is deliberate.

## What we are deliberately not doing

**Suggestion events.** The `core.suggestion.*` family is the sovereignty audit trail, and it belongs
with the design of checks and moves, not with dice. A roll neither offers nor accepts anything.

**dddice.** This settles the shape a service roll would be recorded in. Everything else about #12,
the connection, the consent to use it, the rooms, the content security policy, is its own record.

**Oracle providers.** The module contract already has them, and the seam it describes holds:
providers resolve a result they are handed and never roll. Nothing here changes that, and nothing
here designs the provider surface.

**Checks and moves.** `CheckDefinition` and outcomes are the module contract's §6 and are the next
thing after this, not part of it.

**A dice tray, or any interface at all.** This is the event shape. What the rolling surface looks
like is a separate piece of work and does not need deciding to write the schema.

## Open questions

**Should a roll be able to record dice that were not asked for?**

`request` says two dice, `dice` says what came up. Nothing currently says they must match, and a
player who throws a third die by accident and wants to record it honestly has no way to do so that
is not a lie in one direction or the other.

_Why it matters:_ if they are allowed to differ, every module reading a result has to cope with
receiving something it did not ask for, forever. If they are required to match, the log cannot
record something that really happened.

_What would settle it:_ deciding whether the request is a record of what was asked for, or a
constraint on what may be recorded. Playing with physical dice for a few sessions and noticing
whether the mismatch ever comes up would answer it faster than reasoning about it.

**Does a correction to a roll need to say what was wrong with it?**

The decision above records whether a roll was corrected or rerolled. It does not record why the
correction was needed, and a misread die and a mistyped die are not the same mistake.

_Why it matters:_ only for reading history back, which is exactly the thing that justified making
the distinction in the first place. The argument for stopping here is no stronger than the argument
for going one step further, which is why this is a question rather than a decision.

_What would settle it:_ correcting real rolls and seeing whether the reason is ever wanted, or
whether "corrected" is enough on its own.

## What this changes elsewhere

**The module contract changes in two places**, and both are contract-touching. `DieValue.source`
becomes a record. `RollRequest.reason` is removed. Neither has been implemented, so the cost is
editing a document rather than migrating anything.

**The brief needs one amendment**, on roll events and content packages, described above. Nothing
else here contradicts it.

**Core gains the roll event family and the oracle consultation event**, declared the way the journal
events are declared, with their translations from version 1 and a round-trip test.

**The toy module gains a coin flip that is a real roll.** A d2 through `core.roll.performed` with no
module event at all is what the module contract predicted, and it is the cheapest possible check
that the shape is not secretly Ironsworn-shaped.

**The recorded session fixture becomes possible**, which is the regression net the event log record
asked for and the reason this is worth doing before anything else.

## How we would know this is wrong

**If `source` as a record turns out to be the wrong extension point**, because the third case is not
a service but something else entirely, then a shape chosen for a service will have to hold something
it does not fit. The mitigation is that `kind` is open, but a payload schema is permanent and this
is the decision here with the least evidence behind it.

**If nobody ever uses the distinction between a correction and a reroll**, then it is a field on
every superseding roll that exists to serve a history nobody reads, and the simpler shape would have
been right.

**If dropping `request.reason` makes roll events unreadable in practice**, because reading a log
means looking at one event at a time far more often than this record assumes, then the duplication
it removed was buying something real.
