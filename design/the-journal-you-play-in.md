# The journal you play in

Status: proposed, 8 August 2026. Not yet agreed, not yet decomposed.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

The maintainer opened the application, chose the move at the top of a list of fifty-four, pressed
the only button, and got a card saying "Begin a Session. As written. It happens as the move says."
He could not tell what any of it meant, and he was right not to.

Everything under that surface works. This record is about the surface.

## What is wrong, specifically

Four things, and they are separate faults rather than one.

**A move's own words are never shown.** The application imports the full text of all fifty-six moves
and displays none of them. Begin a Session says, in the book and in our own data, to review what
happened last time, set a flag, and envision the scene. The screen says "It happens as the move
says", which is a sentence I wrote as a stand-in for eighteen different moves and which tells a
person nothing.

**A move with no dice is offered a roll.** Eighteen of the fifty-four have no roll at all. The
button says "Roll it" anyway, and pressing it records that the move happened, which is defensible in
the log and absurd on screen.

**Choosing a move is a dropdown of fifty-four.** Nothing chose Begin a Session; it is simply first.
A person who wants Face Danger has to know it exists and find it.

**Nothing about the campaign is visible while writing.** The character's stats, the vows and their
progress all exist and are all in a rail you have to look for, below the writing, out of the way.

## What it should be

The design settled this and this record is not reopening it. The window is a centre column you write
in, with the campaign either side of it. What follows is the part of that worth building now, and
what it deliberately leaves for later.

You write. When something happens that a move covers, you press a key, and a box opens over the page
with a search in it, the way asking an oracle already works. You type part of the move's name, and
you can read what the move says before you commit to it. If it rolls, you roll or type in your dice.
If it does not, you record that you did it. The card lands where you were writing. While all this
happens, your character and your vows are visible at the right, because they are what you are
playing.

## Decisions

### A move's text is shown before it is invoked, not after

The palette shows the chosen move's own words. That is the fix for the thing that made the
application incomprehensible, and it costs nothing to build: the text is already imported, hashed
into the package, and sitting unreferenced in the registry.

It is shown at choosing time rather than on the card afterwards. By the time a card exists the
question "what does this move do" has already been answered by doing it, and a card carrying the
full text of a move would bury what actually happened under a paragraph a person has read before.

The card keeps its reference to the move, so the text stays one step away.

### A move with no dice gets a different verb, and no dice

"Roll it" on a move with nothing to roll is the application lying about what the button does. A move
with no roll gets a button that says it is recording that the move happened, and no box for dice.

What such a move records does not change: an invocation and a resolution, exactly as now. It is the
words on screen that were wrong, not the events. And the resolution's summary stops being "it
happens as the move says" and becomes nothing at all, because the move's own text said it and the
card should not paraphrase a book badly.

That leaves a card with a name and no summary, which is honest: what happened is that you did the
thing the move describes.

### Moves are found the way oracles are found

A key opens a box over the page, with a search. This is the same shape as the oracle palette, which
is deliberate: two palettes that behave differently would be two things to learn for no reason.

They stay two palettes rather than one, because what you do next differs. Choosing an oracle rolls
immediately. Choosing a move shows you the move and then asks for stats. Merging them would mean a
box whose second half changes shape depending on what you picked, which is harder to learn than two
boxes with one job each.

The permanent form panel at the foot of the writing goes away when this lands. It was built to reach
the engine from a window and it did that.

### The right rail shows what you are playing

The character's stats and the vows with their progress, at the right, while you write. Both are
already computed and already cross the IPC boundary; the rail is a view of what the entities surface
already has.

Only what exists gets a rail. Threads, session recaps and pinned truths are named in the design and
are not built, and an empty rail is worse than no rail.

### The centre column stays as it is

Prose, cards, in the order they happened. Rich text, inline mentions and roll results woven into
sentences are the editor's work and wait on their own record, as they always have.

## What we are deliberately not doing

- **The command palette as one surface for everything.** Two palettes now; a general one is a
  question for when there is a third thing to put in it.
- **The reference browser.** Reading all the moves, as a place you go, is its own surface. This
  shows one move's text where a person needs it.
- **The left rail.** Threads and entities-present need threads, which do not exist.
- **The character sheet.** A rail is not a sheet. The sheet is its own surface and its own record.
- **Rich text and inline mentions.** Waiting on the editor, as before.
- **Removing the entities rail.** It moves to the right and keeps working; the dossier panes are
  later.

## Open questions

**Which key opens the moves palette?**

The oracle has one. A second needs one that is not already taken and not one a person hits by
accident while writing. _What would settle it:_ trying both keys for a session and noticing which
one is reached for by mistake.

**Does a no-roll move need any confirmation at all?**

Perhaps choosing it from the palette is the act, and a second button is ceremony. Against that: a
palette where choosing writes an event immediately makes an accidental keystroke into a permanent
record. _What would settle it:_ using it, and counting the accidents.

**How much of a long move's text belongs in the palette?**

Some moves are three lines and some are two screens. Showing all of it makes the palette a document
viewer; truncating it hides the part that mattered. _What would settle it:_ reading the longest one
in the corpus at the palette's real width.

## How we would know this design is wrong

- A person still cannot tell what a move does after reading the palette, which would mean the text
  is not the missing thing.
- Two palettes are confusing rather than clarifying, which would mean the one-surface argument was
  right.
- The right rail is ignored during play, which would mean what a person needs while writing is not
  what is in it.

## What this changes elsewhere

- **`design/the-verdict-card.md` gets an annotation.** It excluded the rails and choosing a check
  from a list; both exclusions end here, and it should say so.
- **A channel for a move's text**, which the registry holds and nothing has ever sent.
- **The check surface is replaced**, not extended. The form panel goes.
- **`interpretNoRoll` loses its summary**, which means a module's outcome may carry an empty
  summary, which the contract already allows.
