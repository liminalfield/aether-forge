# Design records

One document per feature, named `<feature>.md`. Written and agreed before the feature's issues
exist, and before any of its code is written. The workflow around these documents is in `CLAUDE.md`.

## What a design record is

A record of thinking, not a manual. It is written to be argued with.

It states what is settled and why. It records what was considered and excluded, with the reasoning,
because the excluded options are the part a future reader cannot reconstruct. It preserves
superseded proposals rather than deleting them, annotated with what replaced them. It may state
disagreement, and it may leave questions open as long as they are marked open.

## What it is not

It is not user documentation. Nothing here is published to a documentation site if one ever exists,
and no user-facing page may reference an open question, a rejected approach, a revision history or a
future intention from these files.

It is not the project decision record. `00-PROJECT-BRIEF.md` holds decisions binding the whole
project. A design record that needs to change one of those has to change the brief, which is the
maintainer's decision.

It is not authoritative over the code. Where a record and the code disagree, the code is right and
the record needs a status annotation saying what changed and when.

## Shape

There is no rigid template, because a storage format and an interaction model do not want the same
structure. Most records will want:

- What the feature is, and the problem it solves.
- The decisions taken, each stated as a claim with its reasoning.
- What was excluded, and why. Name the tempting wrong answer.
- Open questions, marked as open, with what would settle each.
- The consequences that reach other parts of the system, especially anything touching the module
  contract or an event payload schema, which are one-way doors.

The epic issue derived from a record is a summary of it, not a copy. The record holds the reasoning;
the epic holds the plan.

## Style

`CLAUDE.md` governs the writing: plain language, no em dashes, no marketing vocabulary, no hedges
where the answer is known. Length is not a virtue.
