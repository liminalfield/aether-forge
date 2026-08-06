# Checks, and what follows from them

Status: proposed, 6 August 2026. Not yet agreed, not yet decomposed.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

A check is the structure behind what a rulebook calls a move: you decide how you are going about
something, you roll, and what you rolled means something. It is the last large undesigned piece of
the model, and almost everything visible in the design waits on it. The verdict card is the
centrepiece of the whole interface and it is a picture of one check.

The project promises that the application computes everything and decides nothing. A check is the
hardest place to keep that promise. The application knows the rules and it knows the character, so
it would be easy to let it pick the stat, roll, and apply the result while the player watches. Most
of this record is about not doing that.

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

Eight events for one move. That is a lot, and it is worth seeing the number now rather than after
agreeing to the design.

What the eight buy is that each step can be read, changed or refused on its own, and that a year
later the log still says what the application proposed and what the player did about it.

Four of them are mechanics: the invocation, the roll, the outcome, and the change to momentum. The
other four, numbered 46, 47, 51 and 52, are the record of what was suggested. Take those four out
and the campaign ends in exactly the same state. What you lose is any way to tell whether the player
chose Kinetic or was told to.

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
does the identifier naming the move.

## Decisions

### Interpretation happens once, and the answer is recorded

A module says what a roll meant. That answer is written into the event and never worked out again.

The alternative is to store only the dice, and ask the module what they meant every time the log is
read. That is tempting, because then correcting a rule would correct every campaign that ever used
it.

It would also break the guarantee everything else here depends on, which is that the same log always
produces the same state. If a module's answer is worked out at reading time, then updating that
module changes campaigns that were finished years ago. A player who has not opened their game since
last winter would find a hit had become a miss, with nothing anywhere recording that it changed.

So interpretation works the same way rolling does. Both happen once, before the event is written,
and everything afterwards reads the recorded answer instead of working it out again.

There is a real cost. A module with a bug in it writes wrong outcomes, and fixing the module later
does not fix those events. They have to be corrected one at a time, by appending a revision, the
same way anything else in the log is corrected. That is worse for the person who hit the bug and
better for everybody whose finished campaigns stay as they left them.

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

**A declined suggestion is recorded**, and this is the part that matters most. If declining left no
trace, the log would say what the player did and never what they turned down. There would then be no
way to check the claim that the application decides nothing, because a campaign where every
suggestion was taken and one where none were ever offered would look identical. A history where
every suggestion was taken and a history where none were offered look identical unless the offer is
written down.

Accepting a suggestion is what writes whatever it proposed into the log. The module supplies the
proposal, core writes it, and the module never writes anything itself. This is not a matter of
trusting modules to behave. A module has no way to write to the log at all. For anything to be
applied without a person accepting it, the contract would have to grow a new channel, and somebody
would have to decide to add one.

### The suggestion events are the record of what was suggested, and the module event is not

The accepted event log record says `sys.ironsworn.move.invoked` carries "which move, which stat,
what was added, and which of those the application suggested rather than the player deciding".

This record proposes that it carries the first three and not the last.

What the application suggested is already in events 46 and 47, in full, with the reason it gave. A
second copy inside the module's payload is two records of one fact, and two records of one fact
eventually disagree.

This is the same mistake three times over. It happened with `request.reason` on a roll, with the
identifier inside a superseding roll, and with the rolled number inside an oracle consultation. Each
time, one fact was about to be written in two places. Naming the pattern here should make the fourth
one quicker to spot.

So the module event says what the check was run with. The core events say where those values came
from. Following `causation_id` backwards from the invocation reaches the acceptance that produced
it.

### Nothing about a check is ever refused

A player can pick any stat the check offers, or none of them. They can set a modifier to anything.
They can decline the roll's outcome by revising it. There is no state a check can be in that the
application will not record.

This is not a rule anybody has to remember, and it must not become one. There is nowhere in the
contract to put the word "illegal". A check does two things: it says what inputs it takes, and it
says what a result means. Neither of those lets a module say no. Keeping it that way is the whole
design.

The one check that exists is the same one dice have: a value has to be a number. That is not a
judgement about play.

### A check may not roll at all

Some procedures have no dice. A check whose roll is absent runs the same path, gathers the same
inputs, and produces an outcome from them alone.

This looks like a minor case and is not. It is how a system with fewer dice, or a procedure like
taking stock of where you are, uses the machinery that already exists rather than needing a second
kind built alongside it.

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

## Open questions

**How much can a player adjust before it stops being the same suggestion?**

`adjusted` is one of the four things that can happen to a suggestion, and the obvious case is a
number: the application proposes −1 momentum and the player makes it −2. What is unclear is whether
adjustment reaches anything other than a number.

_Why it matters:_ if anything about a proposal can be adjusted, then a module has to describe which
parts are adjustable and what the limits are, and a suggestion stops being a small thing.

If only a number can be adjusted, a suggestion stays simple. A player who wants to change anything
else has to decline it and do that thing by hand. That is more work for them, and nobody has
measured how often it would come up.

_What would settle it:_ building the narrow version, playing with it, and counting how often
declining turns out to be someone's way of adjusting something that was not a number.

**Does a check need to record what it was reading at the time?**

An interpretation often depends on campaign state: a progress roll reads the track it is rolling
against. That value is in the log already, as whatever event last changed it, so the outcome can be
explained by replaying. But nothing points at it directly.

_Why it matters:_ if understanding event 50 means first replaying everything before it, then reading
the log is a much bigger job than it sounds, and only a program can do it. If instead every check
writes down the values it read, those events get bigger, and the same fact ends up recorded twice:
once where it was set, and again inside the check. This record argues against exactly that a few
sections above.

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
