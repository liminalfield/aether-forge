# Consulting an oracle

Status: proposed, 8 August 2026. Not yet agreed, not yet decomposed.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

The application holds 249 tables and no way to reach one. The event that records a consultation has
existed since August, the provider that resolves one was built with content packages, and nothing in
the window can ask a question. This record is about the asking.

## What an oracle is, in this application

A player alone has nobody to ask. An oracle is what they ask instead: a table of results, a die, and
an agreement to take what comes and make something of it.

Two different things get called an oracle, and they behave differently enough that this record has
to keep them apart.

**A table.** "What is the theme of this place?" You roll a hundred-sided die and read the row it
lands on. The answer is a phrase somebody wrote, and it comes from a content package.

**A yes or no.** "Is the airlock still powered?" You decide how likely it is, roll, and get yes or
no. There is no table of phrases. There is a number: if you said the answer is likely, anything up
to 75 is yes.

Both end in the same place. A die was rolled, an answer was read, and both are written into the log
so the session explains itself later.

## What it looks like when it works

You are writing about approaching a derelict. You want to know what you find. You press a key. A box
appears over the page, you type "derelict", and it lists the tables whose names match. You choose
one, and either press the button or type in the number from the die already on your table. The
answer appears in the journal where you were writing, with the table it came from and the die that
decided it.

The second kind is shorter. You press the key, type your question, choose how likely you think it
is, and get yes or no.

## What is already built

Worth saying plainly, because most of this record is about the last mile.

- `core.oracle.consulted` records the table, the row (its range and its text) and the package id and
  version it came from. It carries no die value: the roll is its own event and this one is caused by
  it.
- `OracleProvider` in the contract, with `listTables` and `resolve`. Providers resolve; they never
  roll. That seam is what makes a typed-in die identical to a rolled one everywhere.
- One provider, answering from installed packages, in the desktop application.
- The roll machinery, with per-die provenance.

Nothing here changes any of that.

## Decisions

### A yes-or-no oracle is a rule, so the module supplies it

Datasworn ships no table of odds. Ask the Oracle is a move whose text names five likelihoods (almost
certain, likely, fifty-fifty, unlikely, small chance) and the numbers behind them live in the
rulebook, not in the data.

By this project's own split, that makes them rules rather than content, and rules belong to the
module. So `system-ironsworn` contributes a second oracle provider: five tables it builds itself,
each with two rows, one saying yes and one saying no.

This costs nothing and buys the thing that matters. A yes-or-no answer records exactly like a table
answer, so one event shape covers both, the journal draws them the same way, and nothing downstream
has to know which kind it was.

It also puts a real second provider in front of the contract, which has had one since it was
written. If two providers cannot coexist, the contract is wrong and this is where it shows.

### The answer is a fact, and does not wear the ghost block

The handoff draws an oracle result in a ghost block. This record does not, and the disagreement is
worth writing down.

The ghost block means one thing: the application is proposing this and you have not decided. An
oracle answer is the opposite. You asked a question, a die answered it, and the answer is now part
of what happened. Drawing it as an undecided proposal would say the application is offering it for
approval, which is not what an oracle is for and would make the dashed border mean two things.

If the application ever suggests a follow-up table to consult, that suggestion is a proposal and
gets the ghost block, because it genuinely is one.

### Finding a table is searching, not choosing from a list

There are 249 tables in one package, across thirteen groups, and more arrive with every package
somebody installs. A list is not a way to find something in 249 items.

So the surface is a search: type part of a name, see what matches, choose one. Matching is on the
table's own name and the group it sits in, because "derelict" should find the derelict tables even
though no table is called exactly that.

The handoff describes typing the question in plain language. This record does less: it matches words
against names. Understanding a question well enough to pick a table for it is a different piece of
work and this does not pretend to it.

### Consulting is not a check

Ask the Oracle is a move, and a person may well read it before they ask. But consulting is its own
act with its own event, and it does not go through the check machinery.

They are different shapes. A check takes inputs, rolls, and asks a module what the dice meant. A
consultation takes a table, rolls, and reads a row. Forcing one through the other would mean
inventing inputs a consultation does not have and an interpretation it does not need.

The move's text stays available as reference, because it is a document in a package like every other
move.

### The answer lands in the journal

The session log is the product, so an oracle answer belongs in it, in the order it happened, beside
the prose and the checks. That means the timeline carries a third kind of item.

It is drawn like a card, quietly: the question or the table's name, the answer, the die that decided
it and where it came from, and the package the answer was read from. The package matters for the
same reason the roll's provenance does, and it is already on the event.

## What we are deliberately not doing

- **Pinned oracles and a roll history panel.** The handoff's oracle surface has both. Neither is
  needed to ask a question, and both are easier to design once asking exists.
- **The reference browser.** Reading the rules is its own surface, and it wants the documents this
  application imports but does not yet show. Its own record.
- **Follow-up tables.** Datasworn rows can point at further tables. Carrying that through the
  importer, the event and the surface is real work and none of it is needed to answer one question.
- **Mythic-style providers** whose tables change with campaign state. The seam accommodates them;
  nothing builds one.
- **Putting the answer into the prose automatically.** The answer lands in the journal as its own
  item. Weaving it into a sentence is the rich-text editor's business, and that waits on mentions.
- **Rerolling a consultation.** A roll can already be superseded, and what that means for an answer
  read off a table is a question worth its own thinking.

## Open questions

**What does a person actually type to find a table?**

Matching words against a table's name and group is the cheap answer, and it will be wrong somewhere:
the table that answers "who is this person" is called Character Name, and nothing about that
matches. _What would settle it:_ using it for a session and writing down every question that failed
to find its table.

**Should the five likelihoods be five tables or one table with a chosen threshold?**

Five two-row tables is the shape that needs no new event and no new concept, which is why this
record proposes it. It is also slightly a lie: they are one question asked five ways, not five
tables. It shows if a surface ever wants to list "all tables" and finds five odds sitting among the
real ones. _What would settle it:_ building the search and seeing whether they are noise in it.

**Does a consultation need to record the question a person asked?**

The event records the table and the row. It does not record "I wanted to know if the airlock was
powered". A person reading their log a year later may find the answer without the question useless.
_What would settle it:_ reading back a session that used the yes-or-no oracle several times, where
the table name is the same every time and only the question differed.

## How we would know this design is wrong

- The two providers need different event shapes, which would mean a yes-or-no answer is not a table
  lookup after all.
- Searching by name is so bad that people stop using the oracle, which would mean the handoff's
  plain-language question was load-bearing rather than aspirational.
- Answers in the journal read as clutter rather than as the record of a session, which would mean a
  consultation belongs somewhere other than the timeline.

## What this changes elsewhere

- **The timeline gains a third kind of item**, beside entries and checks.
- **`system-ironsworn` gains an oracle provider** and, with it, the first real test of two providers
  coexisting.
- **The desktop application gains channels** for listing what can be consulted and for consulting
  it, and the surface to reach them.
- **The module contract's §4 becomes code**, the way §3 and §6 already have.
- **Nothing about the event changes.** It was designed for this and this is the first thing to use
  it.
