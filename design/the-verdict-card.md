# Rolling a check in the window

Status: accepted 6 August 2026 (#116) and built. Decomposed and implemented across #127 to #135
without this line being updated. Corrected 7 August 2026.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

> Two of its exclusions ended on 8 August 2026, in `design/the-journal-you-play-in.md` (#189). This
> record said it was not doing the rails and not doing a way of choosing a check from a list. Both
> are built: the entities rail sits at the right of the writing, and moves are found in a palette
> with a search in it. The form panel this record's decomposition produced has been deleted, and the
> card itself is unchanged.

Everything a check needs exists except a place to do one. Core sequences the events, both modules
declare a check, the log records what was suggested and what was refused, and none of it can be
reached from the window. This is the surface that reaches it.

The card it produces is the centrepiece of the design. It is also the first thing in the application
that shows a person a decision and waits.

## What it looks like when it works

You write a line about walking into something dangerous. You press a key. The application offers a
stat, saying why. You take it, or you pick a different one, or you type your own number. You roll,
or you throw real dice and type in what they showed. A card appears in the log saying what happened,
and underneath it, what the application thinks should follow. You take that, change it, or ignore
it.

Then you carry on writing.

## Decisions

### Running a check is two acts, not one

The window asks the main process to run a check. It gets back the outcome. Then, separately, it says
what the player decided about each suggestion.

It has to be two, because the player cannot answer a suggestion they have not seen. One call that
took the answers up front would mean the application deciding what you would say.

So the first act writes the invocation, the roll, the resolution and the offers. The second writes
the answer and, if it was taken, the thing it proposed.

### A suggestion can sit unanswered, including across a restart

Between those two acts, the log holds an offer nobody has answered. Close the application there and
it is still unanswered when you open it again.

That is a real state rather than a broken one. The projection that reads suggestions already treats
it as real. A person interrupted mid-decision should find the decision waiting, not gone.

### Your stats are typed at the point of rolling, and nothing remembers them

A check needs a number for the stat. There is nowhere to keep one. Entities, sheets and characters
are section 7 of the module contract and a whole epic of their own.

Two things could be done about that. Build a small character now, holding five numbers, and replace
it when entities arrive. Or type the number each time.

This record chooses typing it, and the reason is the replacement rather than the effort. A character
built now would be a shape people's campaigns record events against, and events are permanent.
Getting it wrong means either living with it or writing translations for a model that existed for a
few weeks.

Typing a number every roll is worse to use and costs nothing later. It is also not a placeholder in
the usual sense: every input is editable at the point of rolling anyway, permanently, because that
is what the application promises. This changes how often you use that, not whether it exists.

### The main process rolls, and the window can hand in dice instead

Randomness lives in the main process, beside the other two unpredictable inputs it already supplies
when an event is written: the time, and the identifier.

The window can supply die values instead of asking for a roll. That is not a concession for testing.
It is manual entry, which every roll surface has to accept anyway, because a person throwing real
dice types in what they showed.

So a test that needs known dice uses the same route a player uses with a handful of dice on the
table. There is no test-only path, and nothing has to be reached into.

When the window supplies nothing, the main process rolls and the dice are recorded as digital. When
it supplies values, they are recorded as manual. Everything downstream is identical.

### The card is a component, and it knows nothing about Ironsworn

The handoff describes the card in Starforged terms: an action die in a box, `+adds =`, a total,
`vs`, two challenge dice bordered in the outcome colour.

The component cannot work that way. A system with one die, or five, or none, has to produce a card
too, and `packages/ui` may not contain the word for a challenge die.

So the card takes a list of dice with their labels, a total where the module supplies one, and an
outcome with a glyph and a colour. The Ironsworn arrangement comes out of that list because the
module labelled its dice, not because the component knows what it is drawing.

### Physical dice reach exactly the same card

Every roll surface takes typed-in die values, and the card looks identical whichever way the number
arrived. The provenance strip underneath says which it was.

This costs nothing to build because it was decided at the bottom of the stack. A die carries where
it came from, and the card reads that field.

### The card says it is fine to ignore it

The last chip is always dashed and says so, and pressing escape takes it.

That is the product's whole position, expressed in one control. An interface where declining is
harder than accepting has an opinion, whatever the log records.

## What we are deliberately not doing

**The rails.** The design puts threads and entities on the left, and stats and tracks on the right.
None of those exist.

**A collapsed card.** The design collapses a card to one line after a decision. Worth having, and it
needs a decision about what happens when you scroll back to an old one, so it is its own step.

**Momentum as a bar chart.** It is in the right rail, and the right rail is not being built.

**Progress tracks.** A check that marks progress needs somewhere to mark it.

**Choosing a check from a list.** One check is enough to prove the path. A browser for sixty-seven
of them is the reference surface, and it needs content packages.

## Open questions

**What happens to an unanswered suggestion when you scroll away from it?**

The log keeps it. The window has to decide whether the card stays open in place, moves somewhere, or
stays in the history looking answerable.

_Why it matters:_ a suggestion from forty entries ago that is still live is either a useful reminder
or a piece of litter, and the answer probably depends on how long ago it was.

_What would settle it:_ leaving one unanswered on purpose during a session and seeing whether it is
wanted or in the way.

## What this changes elsewhere

**The IPC contract gains two channels**, one to run a check and one to answer a suggestion.

**The offer event gains a second version.** Found while decomposing this record, not while writing
it. Two acts only work if an offer can be answered from the log alone, in a later session, and
version 1 of `core.suggestion.offered` recorded neither which parts of a proposal a person may
change nor which module the proposal belongs to. Without the first, somebody pressing adjust is
guessing at what is in front of them, which is the state the contract requires every proposal to
describe its fields in order to prevent. Without the second, the offer cannot be turned back into an
event at all, because a module event has to name its system.

Both could have been worked out again by asking the module when the offer is answered. That was
rejected. It makes an old offer depend on the module still declaring the same check the same way,
and recording an answer once rather than asking again later is the whole reason `CheckOutcome` is
written into the log. An event payload schema is permanent once a campaign has written one, so this
was worth doing before anything could.

**`packages/ui` gains the components the card is built from**: a chip, a chip row, and the card
itself. All named without a word from any rulebook.

**The window gains a second thing it can do.** Until now it writes prose. This is the first surface
where the application proposes something and waits.

## How we would know this design is wrong

**If typing a stat every roll makes the feature unusable** rather than tedious, then waiting for
entities was wrong and a small character should have been built after all.

**If two acts turn out to be one too many**, because every player answers immediately and the
unanswered state never happens, then the seam bought nothing and a single call would have been
simpler.

**If the card cannot express a system that is not Ironsworn**, once a second one exists, then taking
a list of dice was not general enough and the component is quietly Starforged-shaped after all.
