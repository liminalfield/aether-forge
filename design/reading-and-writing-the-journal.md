# Reading and writing the journal

Status: accepted, 4 August 2026. Decomposed into epic
[#48](https://github.com/liminalfield/aether-forge/issues/48) and its tasks.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

The campaign log works and the window does not use it. You can write something and watch a number go
up. What you wrote is stored correctly, and then never shown back to you.

The session log is the product. This is the record for making it one.

## What this is about

A person playing alone, writing about it as they go. They need to read back what they wrote, fix a
line they got wrong, and see the campaign accumulate underneath them.

Everything underneath already works: entries are recorded, corrections replace rather than edit, and
the state is worked out by reading the log. None of it is reachable from the window.

## What it looks like

The window shows the campaign as a document, oldest at the top, newest at the bottom, with the place
you write at the end. It reads the way it was written.

```
  The Sundered Reach, forty years after the last supply run.

  I take the shuttle down through the debris field.

  The airlock opened on the second try, which is somehow worse.        edited

  ┌──────────────────────────────────────────────────────────┐
  │ What happened?                                           │
  └──────────────────────────────────────────────────────────┘
                                                    [ Record it ]
```

Behind the third line are two events, not one:

| Position | Event                | Supersedes | Carries                                             |
| -------- | -------------------- | ---------- | --------------------------------------------------- |
| 9        | `core.entry.created` |            | "The airlock did not open."                         |
| 14       | `core.entry.revised` | 9          | "The airlock opened on the second try, which is..." |

The window shows the corrected text and says it was edited. Both events stay in the log forever.

## Decisions

### An entry is one act of writing

Whatever you typed before pressing record. Not a paragraph, not a scene, not a session.

It is the unit you can correct, so it should be the unit you were thinking in when you wrote it. A
person who writes three paragraphs in one go and later wants to fix a word in the second one is
correcting that piece of writing, which is how they remember it.

Session boundaries are a real thing and they are not this. They will be their own event when there
is a reason for one.

### The window is sent the whole journal, then only what changes

Opening a campaign sends the journal across. After that, recording or correcting an entry sends the
one entry that changed.

The accepted event log record left this open on purpose and said it should be settled by measuring
rather than guessing. This is the simple end of that: whole thing once, then small updates. It
avoids re-sending everything on every keystroke without needing a way to work out differences.

A measurement went in with it, and it settled the question. See below.

> **Amended at decomposition, 4 August 2026.** As first written this said the main process sends the
> changed entry, which meant it speaking to the window unprompted. That is not needed yet: the
> window is the only thing that can change the campaign, so the answer to its own request carries
> the entry that changed. Something that speaks first earns its place when something other than the
> window can change state, and the first of those will be import. The paragraph below about the
> contract gaining its first push is left in place, deliberately, as the thing that becomes true
> then.

### Correcting edits in place, and says so

You click a line, change it, and it is changed. No dialog, no ceremony.

The window then marks it as edited and can show what it said before. That is not decoration. The
whole model rests on the log being honest about what happened, and an interface that silently
presents a correction as though it were the original teaches you not to trust it. Something you were
told about is something you can rely on.

### A correction supersedes the most recent version, not the original

Correcting an entry three times should read as a chain: the third supersedes the second, which
supersedes the first. Not three separate events all claiming to supersede the original.

Both work today, because a correction resolves back to the entry it belongs to either way. The chain
is chosen because it reads correctly to a person following the history, which is the whole reason
the field exists.

This needs a small change in core: an entry has to expose which event holds its current version, so
the window can say what the next correction supersedes.

### Plain text now, rich text when there is something to embed

The brief chose TipTap for inline entity mentions and inline roll results. Neither can be built:
mentions need entities, which do not exist, and roll results need roll events, which have no
declared shape.

Adding a rich text editor now would buy formatting nobody asked for, commit the project to a
dependency, and still not allow the thing the dependency was chosen for.

The cost of waiting is real and worth stating plainly: the writing surface gets built twice, and
writing is the product. The judgement is that a second pass at the editor is cheaper than carrying
an editor that cannot yet do its job, and that the second pass will be better informed by then.

## What was measured

Campaigns seeded through the real log, then opened in the packaged application. Times are from
launching it to being able to read the campaign, on the machine this was developed on.

| Entries | Launch to readable | Asking for it | Sent to window | On disk  |
| ------- | ------------------ | ------------- | -------------- | -------- |
| 0       | 265 ms             | 16 ms         | 0 KB           | 32 KB    |
| 100     | 287 ms             | 1 ms          | 24 KB          | 56 KB    |
| 1,000   | 350 ms             | 2 ms          | 243 KB         | 344 KB   |
| 2,500   | 698 ms             | 5 ms          | 609 KB         | 820 KB   |
| 5,000   | 1,966 ms           | 8 ms          | 1,220 KB       | 1,600 KB |
| 10,000  | 7,247 ms           | 19 ms         | 2,440 KB       | 3,172 KB |

One run, so the times move by a few per cent between runs and the sizes do not move at all. The 16
ms against an empty campaign is the first launch of the six paying for everything that has not been
loaded yet, not a cost of asking for nothing.

**Sending the whole journal is not the problem, and is not going to become one.** Ten thousand
entries cross to the window in under twenty milliseconds. The worry that shaped this decision was
misplaced, which is the useful thing a measurement does.

**Drawing it is the problem, and it gets worse faster than the journal grows.** Between one thousand
and ten thousand entries the journal grows tenfold and the wait grows twentyfold, because every
entry is an element on the page whether or not anyone is looking at it.

So: comfortable to a couple of thousand entries, noticeable at five thousand, and unusable at ten.
For scale, an entry here is a paragraph, so ten thousand of them is a campaign someone has written
in for years.

**What to do when it matters**, and it is not what this record originally assumed. The fix is to
draw fewer entries, not to send fewer. Show a window of the journal around where the reader is and
add to it as they scroll. Nothing about the message needs changing, which is worth knowing before
anyone spends a week making it smaller.

Not doing that now. At a thousand entries the application opens in under four tenths of a second,
and building for a campaign nobody has yet written is how a simple thing becomes a complicated one.

The measurement lives in `apps/desktop/measure` and is run with
`pnpm --filter aether-forge-desktop measure`. It is deliberately not part of the test suite: it
answers a question rather than guarding against a regression.

## What we are deliberately not doing

**Inline entity mentions.** Entities do not exist.

**Inline roll results.** Rolls have no declared shape. This is the next thing worth designing, and
#12 also waits on it.

**A user interface for export and import.** The engine can carry a campaign to another machine and
bring it home. Putting a menu item on it is related work and its own piece.

**Deleting an entry.** History is append-only. What deletion would even mean here is a question for
the compaction feature, not for a journal.

**Anything for very long journals.** No paging, no virtualised list. Measured rather than guessed
at: see above for when this stops being true and what to do about it.

## Open questions

**Should the window show what an entry said before?**

The decision above says an edited entry is marked as edited. Whether you can read the previous
version, and where that lives, is a separate question. The information is in the log either way.

_What would settle it:_ correcting things in real use and noticing whether the old text is ever
wanted.

**Does writing need to survive a crash before it is recorded?**

Half-typed text lives only in the window. Closing the application loses it, which is ordinary for a
text box and would be surprising for something calling itself a journal.

_What would settle it:_ deciding whether unrecorded writing is part of the campaign at all. If it
is, it needs to be stored, and storing something that is not yet an event is a new idea that wants
care.

## What this changes elsewhere

**Core gains one field on an entry**, naming the event that holds its current version, so a
correction can supersede the right thing.

**The IPC contract gains its first push, later.** Everything so far has been the window asking a
question and getting an answer. The main process speaking first is a new pattern needing its own
care around subscribing and cleaning up, and it is not being built for this feature. See the
amendment above.

**The application starts using `openCampaign`.** It currently holds a log directly. Once the window
shows a projection, the campaign has to be the thing it holds, which is what makes appending and
state stay in step.

## How we would know this is wrong

**If entries turn out to be the wrong size**, because people write in long stretches and want to fix
single sentences, then correcting a whole entry will feel blunt and the unit needs rethinking before
too many campaigns exist.

**If the plain text surface makes writing unpleasant enough that people stop**, then waiting for
mentions and roll results was the wrong trade, and the editor should have come first regardless of
what it could not yet do.

**If marking an entry as edited makes people avoid correcting things**, then honesty in the
interface has a cost nobody predicted, and how it is shown needs to change even though what is
recorded does not.
