# Checks, and what follows from them

Status: accepted and built. Proposed 6 August 2026 (#100); decomposed and implemented across #109 to
#115 without this line being updated. Corrected 7 August 2026.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

A check is the structure behind what a rulebook calls a move: you decide how you are going about
something, you roll, and what you rolled means something. It is the last large undesigned piece of
the model, and almost everything visible in the design waits on it. The verdict card is the
centrepiece of the whole interface and it is a picture of one check.

The application knows the rules and it knows the character. It could pick the stat, roll, and apply
the result while the player watches. It must not.

## The whole thing, once, in order

A player faces down something dangerous. Here is every event that produces, in the order it lands.

| Number | Event                            | Caused by | Carries                                                   |
| ------ | -------------------------------- | --------- | --------------------------------------------------------- |
| 46     | `core.suggestion.offered`        |           | "Use Kinetic. Your vehicle is built for this."            |
| 47     | `core.suggestion.accepted`       | 46        |                                                           |
| 48     | `sys.ironsworn.move.invoked`     | 47        | which move, which stat, what was added                    |
| 49     | `core.roll.performed`            | 48        | one six-sided die and two ten-sided, and what they showed |
| 50     | `sys.ironsworn.move.resolved`    | 49        | a weak hit                                                |
| 51     | `core.suggestion.offered`        | 50        | "Momentum −1"                                             |
| 52     | `core.suggestion.adjusted`       | 51        | the player made it −2                                     |
| 53     | `sys.ironsworn.momentum.changed` | 52        | −2                                                        |

Eight events for one move.

Four are mechanics: the invocation, the roll, the outcome, the change to momentum. Four are the
record of what was suggested: 46, 47, 51 and 52.

Remove those four and the campaign ends in the same state. You lose the ability to tell whether the
player chose Kinetic or was told to.

Here is the resolution, in full:

```json
{
  "id": "01K9QF3XA1B2C3D4E5F6G7H8J9",
  "seq": 50,
  "at": "2026-08-06T21:14:02.771Z",
  "type": "sys.ironsworn.move.resolved",
  "schema_version": 1,
  "system_id": "ironsworn-starforged",
  "causation_id": "01K9QF3X8ZY7XW6VU5TS4RQ3PN",
  "payload": {
    "check": "starforged/moves/adventure/face_danger",
    "outcome": "weak-hit",
    "summary": "You succeed, but at a cost."
  }
}
```

Core stores that payload and never looks inside it. `weak-hit` means nothing to core, and neither
does the move identifier.

## Decisions

### Interpretation happens once, and the answer is recorded

A module says what a roll meant. That answer is written into the event and never worked out again.

The alternative is to store only the dice, and ask the module what they meant every time the log is
read. That is tempting, because then correcting a rule would correct every campaign that ever used
it.

It also breaks the guarantee everything else depends on: the same log always produces the same
state. Updating a module would change campaigns finished years ago. A player who has not opened
their game since last winter would find a hit had become a miss, with nothing recording the change.

Interpretation works the way rolling does. It happens once, before the event is written. Everything
afterwards reads the recorded answer.

A module with a bug writes wrong outcomes. Fixing the module does not fix them. Each one has to be
corrected by hand, by appending a revision.

### Core never learns what a stat is

The events on either side of a roll belong to the module. Core owns the dice and the audit trail; it
does not own the meaning.

There are two module events rather than one because of this. Putting the inputs on the roll would
mean core carrying a stat. Putting the outcome there would mean core carrying a hit. Neither word
belongs in `packages/core`.

The identifiers a module writes into its own payloads, like
`starforged/moves/adventure/face_danger`, are data rather than vocabulary. Core stores that string
and never reads it.

### A suggestion is offered, and the log says what happened to it

Four things can happen to a suggestion: it is offered, and then accepted, adjusted, or declined. All
four are core events, and they are the only part of this that core understands.

**A declined suggestion is recorded.** Without it, a campaign where every suggestion was taken and
one where none were ever offered look identical. There would be no way to check whether the
application decides anything.

Accepting a suggestion writes what it proposed into the log. The module supplies the proposal and
core writes it.

A module cannot write to the log at all. Applying something without a person accepting it would need
a new channel in the contract, which somebody would have to add on purpose.

### The suggestion events are the record of what was suggested, and the module event is not

The accepted event log record says `sys.ironsworn.move.invoked` carries "which move, which stat,
what was added, and which of those the application suggested rather than the player deciding".

This record proposes that it carries the first three and not the last.

What the application suggested is already in events 46 and 47, in full, with the reason it gave. A
second copy inside the module's payload is two records of one fact, and two records of one fact
eventually disagree.

This is the same mistake three times over. It happened with `request.reason` on a roll, with the
identifier inside a superseding roll, and with the rolled number inside an oracle consultation. Each
time, one fact was about to be written in two places. Watch for the fourth.

So the module event says what the check was run with. The core events say where those values came
from. Following `causation_id` backwards from the invocation reaches the acceptance that produced
it.

### Nothing about a check is ever refused

A player can pick any stat the check offers, or none of them. They can set a modifier to anything.
They can decline the roll's outcome by revising it. There is no state a check can be in that the
application will not record.

There is nowhere in the contract to put the word "illegal". A check does two things: it says what
inputs it takes, and it says what a result means. Neither lets a module say no.

The only thing refused is a value that is not a number.

### A check may not roll at all

Some procedures have no dice. A check whose roll is absent runs the same path, gathers the same
inputs, and produces an outcome from them alone.

A system with fewer dice than Ironsworn uses the same machinery. So does a procedure like taking
stock of where you are. Neither needs a second kind of check built for it.

### A resolved check records the values it was reading

You roll against a progress track with seven boxes filled. The resolved event says "strong hit". It
also says the track was at seven.

The application could work that out either way, by replaying the log up to that event, so this is
not about what can be shown on screen.

It is about corrections. If somebody later revises an old event that marked the track, replaying now
gives a different number than was true at the time. The outcome is already recorded, so it stays
"strong hit". A reader then sees a strong hit next to a track that replay says was at six, and six
may not produce a strong hit. The log contradicts itself and there is no way to tell which half is
wrong.

Recording the seven says what the player was looking at when they rolled.

This is the same reasoning that records the outcome instead of recomputing it. It is also not the
duplication this record argues against elsewhere: "the track was at seven" is a computed value at a
moment, not a second copy of the event that set it, in the same way a roll records the dice rather
than a random seed.

What a check reads is whatever its inputs took from campaign state, so the module already knows the
list. It records the values it used, and nothing else.

### Every part of a suggestion can be changed, and describing them is compulsory

The application suggests "Momentum −1" and the player makes it −2. Some suggestions have no number:
"Mark progress on the Kingfisher repair" has a target instead.

A player can change any part of any suggestion. A proposal describes its own fields, and the
contract requires it rather than allowing it.

The narrower option was to allow only an amount to change. It costs less, and it means some
suggestions can be adjusted and some cannot, because some have no amount in them. The player presses
adjust and sometimes nothing happens. Whether it works depends on which suggestion is in front of
them, which is not something anybody can learn.

Making the description optional produces the same problem by a different route. Modules would
describe some proposals and not others, and the player would still be guessing.

So a proposal carries a small description of its fields: what each one is, and what kind of value it
takes. Every module pays that cost. The toy pays nothing, because its check proposes nothing, and
that is the canary confirming the addition is not Ironsworn-shaped.

The player's change is recorded on `core.suggestion.adjusted`, so the log holds what was proposed
and what was used.

### A module proposes drafts, not events

The module contract currently says a suggestion's `events(ctx)` returns `EventEnvelope[]`. That is
wrong and this record corrects it.

An envelope carries an identifier, a position in the log, a timestamp and a schema version. Core
assigns all four when it writes the event. If a module filled them in, core would have two choices
and neither is good: ignore what the module wrote, which makes the fields pointless, or trust it,
which lets a module hand out positions in a log it cannot see.

A module returns a draft instead: a type, a payload, and nothing else.

## What we are deliberately not doing

**Entities, sheets and tracks.** A check reads values and proposes changes to them, and today those
values have nowhere to live. This record covers the check; §7 of the module contract is its own
piece of work and the larger one.

**Progress tracks.** They are the most obvious thing a check wants to mark, and they are entities.
Same reason.

**The verdict card.** How a check looks on screen is design work, and it needs the check to exist
first.

**Content packages.** Real checks come from Datasworn. Until the importer exists a module declares
its checks in code, which is enough to prove the shape and is how the toy will always do it.

**Follow-up checks.** A suggestion whose proposal is "now roll damage" is a chain of checks. It fits
the shape as described and nothing here is built for it.

## What this changes elsewhere

**The module contract changes in four places**, all of §6.

`EffectSuggestion.events` returns drafts rather than envelopes.

`EffectSuggestion` gains a description of its own fields, so any part of a proposal can be changed.
Compulsory, not optional.

`CheckOutcome` is recorded rather than recomputed, and it carries the campaign values the check
read.

The note about what the invocation event carries drops the suggestion audit, which lives in core
events.

**Core gains the `core.suggestion.*` family**: offered, accepted, adjusted, declined. Four event
types, and the only part of a check core understands.

**The accepted event log record gains an annotation**, on what the invocation event carries.

**Both modules gain a check.** The toy gets one: call a coin flip, two outcomes, no suggestions. If
that is awkward, the contract is wrong and the toy is not what needs fixing.

**The recorded session fixture gains a whole check**, which is the first time it will contain a
suggestion that was declined.

## How we would know this design is wrong

**If recording the outcome freezes real bugs into real campaigns**, often enough that people spend
their evenings correcting events by hand, then this record chose wrong. The fix would probably be a
supported way to reinterpret a stretch of the log on purpose, rather than going back to working the
outcome out fresh every time.

**If eight events per move makes the log unreadable**, so that somebody scrolling their own campaign
sees bookkeeping instead of a story, then the events are right and the way they are shown is wrong.
The interface would need to fold the four suggestion events into the move they belong to, so a
reader sees one thing rather than eight.

**If modules keep finding ways to refuse things anyway**, by offering a choice with no usable option
in it, then the contract is stopping them saying no directly while letting them say it sideways.
That is worse than giving them a proper way to refuse, because the refusal still reaches the player
and nothing in the log records that it happened.

**If describing every field of a proposal turns out to be more work than modules will do well**, so
that the descriptions are thin or wrong and the interface renders nonsense, then compulsory was the
wrong call and the narrower version should return, with the inconsistency accepted and stated.
