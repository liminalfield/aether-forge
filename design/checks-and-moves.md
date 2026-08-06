# Checks, and what follows from them

Status: proposed, 6 August 2026. Not yet agreed, not yet decomposed.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

A check is the structure behind what a rulebook calls a move: you decide how you are going about
something, you roll, and what you rolled means something. It is the last large undesigned piece of
the model, and almost everything visible in the design waits on it. The verdict card is the
centrepiece of the whole interface and it is a picture of one check.

It is also where the promise the project is built on either becomes real or quietly does not. The
application computes everything and decides nothing. A check is the one place where it would be
easiest, and most tempting, to decide.

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

Eight events for one move. That is the cost, and it buys the thing the product exists for: every one
of those steps is separately visible, separately revisable, and separately declinable. Read it back
in a year and it says what the application proposed and what the player actually did about it.

Two of them are the audit trail rather than the mechanics. Delete 46, 47, 51 and 52 and the campaign
still ends up in the same state; what you lose is any way to tell whether the player chose Kinetic
or was told to.

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

Core stores that and never opens it. `weak-hit` is a word core has no opinion about.

## Decisions

### Interpretation happens once, and the answer is recorded

A module says what a roll meant. That answer is written into the event and never worked out again.

The alternative is to record only the dice and ask the module to interpret them each time the log is
read. It is tempting, because it means a fixed rule fixes the past too. It is also the end of the
guarantee everything else rests on: the same log always produces the same projection. Under that
model, updating a module rewrites campaigns that were finished years ago, silently, and a player who
never touched their game finds a hit turned into a miss.

So interpretation joins rolling. Both are done once, before the event exists, and everything
downstream reads the answer rather than recomputing it.

The cost is real and worth stating. A module with a bug in its interpretation writes wrong outcomes,
and fixing the module does not fix the events. Those get corrected the way anything else does, by
appending a revision, one at a time, deliberately. That is worse for the mistake and better for
everything else.

### Core never learns what a stat is

The events on either side of a roll belong to the module. Core owns the dice and the audit trail; it
does not own the meaning.

This is why there are two module events rather than one. Putting the inputs on the roll would mean
core carrying a stat, and putting the outcome there would mean core carrying a hit. Neither word
belongs anywhere in `packages/core`, and the whole architecture exists so that another system can
arrive without touching it.

The identifiers a module writes into its own payloads, like
`starforged/moves/adventure/face_danger`, are data rather than vocabulary. Core stores that string
and never reads it.

### A suggestion is offered, and the log says what happened to it

Four things can happen to a suggestion: it is offered, and then accepted, adjusted, or declined. All
four are core events, and they are the only part of this that core understands.

**A declined suggestion is recorded.** That is the point. If declining left no trace, the log would
say what the player did and never what they chose not to do, and the claim that the application
decides nothing would be unfalsifiable. A history where every suggestion was taken and a history
where none were offered look identical unless the offer is written down.

Accepting a suggestion is what appends whatever it proposed. The module supplies the proposal; core
appends it; nothing is applied by the module itself. That is not a matter of trust. The contract has
no channel through which a module could write to the log, so "applied automatically" is not a thing
that can be built without changing the contract, which is a decision rather than an oversight.

### The suggestion events are the record of what was suggested, and the module event is not

The accepted event log record says `sys.ironsworn.move.invoked` carries "which move, which stat,
what was added, and which of those the application suggested rather than the player deciding".

This record proposes that it carries the first three and not the last.

What the application suggested is already in events 46 and 47, in full, with the reason it gave. A
second copy inside the module's payload is two records of one fact, and two records of one fact
eventually disagree. It is also the same mistake this project has now caught three times: on
`request.reason`, on the identifier inside a superseding roll, and on the number inside an oracle
consultation. The pattern is worth naming rather than rediscovering.

So the module event says what the check was run with. The core events say where those values came
from. Following `causation_id` backwards from the invocation reaches the acceptance that produced
it.

### Nothing about a check is ever refused

A player can pick any stat the check offers, or none of them. They can set a modifier to anything.
They can decline the roll's outcome by revising it. There is no state a check can be in that the
application will not record.

This is not a rule anybody has to remember, and it must not become one. There is nowhere in the
contract to put "illegal": a check declares inputs and interprets results, and neither of those is a
channel through which a module could refuse. Keeping it that way is the whole design.

The one check that exists is the same one dice have: a value has to be a number. That is not a
judgement about play.

### A check may not roll at all

Some procedures have no dice. A check whose roll is absent runs the same path, gathers the same
inputs, and produces an outcome from them alone.

Written down because it looks like an edge case and is not: it is how a system with fewer dice than
Ironsworn, or a procedure like taking stock of a situation, uses the same machinery instead of
needing a second one.

### A module proposes drafts, not events

The module contract currently says a suggestion's `events(ctx)` returns `EventEnvelope[]`. That is
wrong and this record corrects it.

An envelope carries an identifier, a position in the log, a timestamp and a schema version. Every
one of those is core's to assign when it writes, and a module that filled them in would either be
ignored or believed, and both are bad. A module returns a draft: a type, a payload, and nothing
else.

## What we are deliberately not doing

**Entities, sheets and tracks.** A check reads values and proposes changes to them, and today those
values have nowhere to live. This record covers the check; §7 of the module contract is its own
piece of work and the larger one.

**Progress tracks.** They are the most obvious thing a check wants to mark, and they are entities.
Same reason.

**The verdict card.** The interface for a check is a design surface, and it needs this to exist
before it can be built rather than the other way round.

**Content packages.** Real checks come from Datasworn. Until the importer exists a module declares
its checks in code, which is enough to prove the shape and is how the toy will always do it.

**Follow-up checks.** A suggestion whose proposal is "now roll damage" is a chain of checks. It fits
the shape as described and nothing here is built for it.

## Open questions

**How much can a player adjust before it stops being the same suggestion?**

`adjusted` is one of the four things that can happen to a suggestion, and the obvious case is a
number: the application proposes −1 momentum and the player makes it −2. What is unclear is whether
adjustment reaches anything other than a number.

_Why it matters:_ if a proposal is adjustable in general, then a module has to describe what about
it is adjustable, and the shape of a suggestion grows a great deal. If it is one number, the shape
stays small and a player wanting something else declines and does it by hand, which is more steps
for a case nobody has measured.

_What would settle it:_ playing with the narrow version and noticing how often declining is used as
a way of adjusting something that was not a number.

**Does a check need to record what it was reading at the time?**

An interpretation often depends on campaign state: a progress roll reads the track it is rolling
against. That value is in the log already, as whatever event last changed it, so the outcome can be
explained by replaying. But nothing points at it directly.

_Why it matters:_ if a reader has to reconstruct the state at event 50 to understand why 50 says
what it does, then "the log explains itself" is weaker than it sounds. If instead every check
records the values it read, payloads grow and the same fact lives in two places, which this record
spends a section above arguing against.

_What would settle it:_ trying to explain a progress roll from the log alone, once there are
progress tracks to roll against.

## What this changes elsewhere

**The module contract changes in three places**, all of §6. `EffectSuggestion.events` returns drafts
rather than envelopes. `CheckOutcome` gains nothing but its recording is now specified: the outcome
is written into the module's own event rather than recomputed. And the note about what the
invocation event carries drops the suggestion audit, which lives in core events.

**Core gains the `core.suggestion.*` family**: offered, accepted, adjusted, declined. Four event
types, and the only part of a check core understands.

**The accepted event log record gains an annotation**, on what the invocation event carries.

**Both modules gain a check.** The toy gets one: call a coin flip, two outcomes, no suggestions. If
that is awkward, the contract is wrong and the toy is not what needs fixing.

**The recorded session fixture gains a whole check**, which is the first time it will contain a
suggestion that was declined.

## How we would know this design is wrong

**If recording the outcome turns out to freeze real bugs into real campaigns**, often enough that
people are correcting events by hand, then the trade between a trustworthy log and a fixable one was
made in the wrong direction, and the answer is probably a supported way to reinterpret a range of
events rather than abandoning the guarantee.

**If eight events per move makes the log unreadable**, so that a person scrolling their own campaign
sees bookkeeping rather than a story, then the audit trail is correct and its presentation is not,
and the interface needs to fold the suggestion events into the move they belong to.

**If modules end up wanting to refuse things**, and keep finding ways to express refusal through
inputs that offer no valid option, then sovereignty is being enforced by the shape of the contract
and worked around in practice, which is worse than an honest enforcement channel would have been.
