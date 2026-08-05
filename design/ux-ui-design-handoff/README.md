# Handoff: Solo RPG Companion (working name `ironlog`)

## Overview

A desktop-first solo roleplaying companion for Ironsworn and Ironsworn: Starforged. It is a writing
surface first and a rules engine second. The player writes prose; the app tracks mechanics, offers
to apply them, and never applies them on its own. Every mechanical event is recorded with its
provenance — which dice, which table, digital or physical, accepted or declined.

This bundle contains the visual and interaction design for nine decided surfaces, plus the theming
contract. It does not contain application code.

## About the design files

`Foundations.dc.html` (with its runtime `support.js`) is a **design reference created in HTML**. It
is a single scrolling design document, not an application: each turn of design work is a section,
newest at the top, containing one or two options side by side with numbered annotations beneath.
Open it in a browser and scroll.

**Do not port this file.** The task is to recreate these designs in the target environment. No
codebase exists yet, so the first job is choosing the stack — see "Recommended shape" below — and
then building the framework the module contract describes, with these screens as the visual target.

The `source-briefs/` folder holds the three documents that define the product: the project brief
(vision, constraints, the "assisted but never automatic" principle), the module contract (the
architecture sketch the app should be built to), and the design brief. Read the project brief first.
Where this README and the briefs disagree, the briefs are the product truth and this README is the
visual truth.

## Fidelity

**High fidelity.** Colours, type, spacing, and component anatomy are final and exact. Recreate them
faithfully. Three known gaps:

- **Asset icons are placeholder SVG glyphs.** The real icon set lives in
  `Ironsworn-Starforged-Assets-Sheets.pdf` and `-Singles.pdf` (in the project's uploads, not bundled
  here for size). Extract them during build.
- **Sector map node placement is manual.** No auto-layout is designed. If auto-layout is wanted, the
  pin design has to change — labels this large cannot survive it.
- **No empty states, error states, or first-run-with-no-data screens are designed.** Flag these back
  before building them.

## The one principle that governs everything

The app may compute, suggest, and offer. It may never mutate state without an explicit keystroke.
Every suggestion is rendered in the same visual language — a **dashed 1px border in the accent
colour, a faint background wash, and a slow box-shadow pulse** (see "Ghost block" under Design
Tokens). Accepting is `Enter`. Declining is `Esc`, and a declined suggestion stays visible in the
log, greyed and timestamped. Nothing the player did, or chose not to do, disappears.

Corollary: `Esc` must always be a legitimate, cheap, non-destructive answer. Rolling the oracle idly
should cost nothing and log nothing.

---

## Screens

Nine surfaces, each decided. Section ids in the design file are `{turn}{letter}` — `1b`, `2a`, and
so on — and are shown as visible badges, so "build 5a" is unambiguous.

### 1. Journal — decided: `1b` "Verdict cards"

The primary surface. Where the player writes.

**Layout.** Three columns inside a window frame. Left rail 210px (threads, entities present, pinned
truth). Centre column flexible, 34px 40px 46px padding, prose capped at 60ch. Right rail 236px
(momentum, character stats, live tracks). 38px title bar across the top with session name, event
number, and a keyboard hint. Both rails hide on `⌘.` for a bare writing column.

**Prose.** Literata 18px/1.6, weight 300, colour `ink.primary`. Entity mentions get a 1px underline
in `accent` at 40% and shift to `ink.entity`. Uncommitted text (the sentence being typed) is
`ink.secondary` italic with a 2px accent caret.

**Verdict card.** The centrepiece. A discrete object in the log, `surface.raised` background, 1px
`hairline` border, 6px radius, and a **2px top border in the outcome colour**. Three stacked zones
with 16px 18px padding and 14px gaps:

1. Move name (14px, 600) + stat used (mono 11px, muted), and the outcome at the right as glyph +
   word in the outcome colour (mono 11px, .14em tracking, 500).
2. The dice, mono 15px tabular: action die in a 30px `surface.overlay` box, `+adds =`, total, `vs`,
   then two challenge dice in 30px boxes bordered in the outcome colour.
3. Every available response as a pill chip — 5px 10px, 999px radius, mono 12px. Ordered by
   consequence. The accented chip is the mechanically interesting one (`burn 7 → strong hit ⏎`);
   neutral chips follow (`pay the price P`, `adjust ⌥⏎`); and **the last chip is always dashed and
   reads `just write esc`** — the app stating that ignoring it is legitimate.

Below, a provenance footer strip: `surface.void` at 50%, 10px 18px, mono 11px muted — the dice,
whether physical or digital, and the Datasworn move id. Never hidden behind an expander.

After a choice the card collapses to a single line with the chosen chip still visible.

**Momentum (right rail).** A bar chart of the legal range, not a number: ten columns, lit up to the
current value, dark above. The current column carries a 12px accent glow. Columns below the reset
value use `accent.deep`. Below it the value in mono 22px tabular. When an impact drops max momentum
to 9, the chart loses a column — the state change becomes physically visible.

### 2. Tracks and clocks — decided: `2a` "Instrument", with `2b`'s ready-to-resolve moment

**Ticks are drawn, not filled.** A progress box is a 1px bordered square, and each of its four ticks
is one stroke of an X-in-a-box, layered as CSS gradients: tick 1 top edge, tick 2 right edge, tick 3
the `135deg` diagonal, tick 4 the `45deg` diagonal. Four strokes close the box. Each stroke draws in
90ms with no scale and no bounce. A partially filled box is legible from across the room, and a
progress roll counts filled boxes, so the eye counts what the rules count.

**Clocks are round and belong to the world.** A 26–62px circle, 1px border in `pressure`, filled
with `conic-gradient(pressure 0 <n×90>deg, transparent …)`. Square + accent = the player's progress.
Round + pressure = the world's. These two never share a shape or a hue.

**The one ceremony.** When a track reaches enough boxes to roll, a 260ms aurora sweep crosses it,
the border warms to `outcome.strong`, and a line of copy says it is ready. Individual ticks stay
silent. Under `prefers-reduced-motion` the sweep becomes an instant border and copy change — the
moment must still be marked.

**Archived tracks** stay in the panel on a `surface.void`-tinted background with their accent
replaced by neutral grey. Never faded with container opacity (it destroys text contrast); the
colours change instead.

### 3. Session zero — decided: `3b` "Question, with the world accumulating"

One truth at a time, left; the accumulating truth sheet, right, 400px.

Left column, 52px 56px padding: a mono label (`truth 4 of 14 · precursors`, 10.5px, .2em, accent),
the question in Literata 30px weight 300, then three stacked options as full-width rows — `R` roll,
`P` pick, `W` write — the active one bordered and washed in accent. Below, the ghost block with the
rolled result: roll number and table range, the result in Literata 18px, and the key legend
(`⏎ keep · R again · esc leave unanswered`).

**Right pane.** Each answered truth is a category label (mono 10px caps), the truth in Literata
15px, and **a provenance line: `written`, `rolled 22 · kept`, `rolled 74 · rewritten`.** That line
is the audit trail the product exists to celebrate. Unanswered truths stay in the list in muted
italic, labelled as open questions — the same treatment threads get, so the front door teaches the
journal's vocabulary.

`Esc` is labelled "leave this truth unanswered", never "skip". Unanswered truths become open
questions on the threads list.

### 4. Sector map — decided: `4a` "Constellation", hex grid on, `4b` as a second view

**The chart.** A dark plate (see the note on theming below) with a layered radial-gradient starfield
and a faint `2E6E8E` nebula wash at 30% 10%. Above it, an SVG hex grid, and above that the routes,
and above that the nodes.

**Hex grid.** Pointy-top hexes, `stroke rgba(127,212,245,0.13)`, 0.8px, in an SVG `<pattern>` at 72
× 41.57 userSpaceOnUse. Note: a pattern tile clips paths that overhang its bounds, so the tile must
contain nine translated copies of the hex pair (−1/0/+1 in each axis) for the lattice to be
continuous. Toggles on `H` and as a persisted preference. When on, nodes snap to hex centres; when
off, they keep their exact coordinates.

**Nodes carry type in shape, state in colour.** Ring = settlement, ringed disc = planet, broken hull
= derelict or debris. Cyan = travelled or current, mint = discovered this session, grey = known but
unvisited. Current position is a dashed halo around the node — the same dashed language as every
other provisional thing in the app; in transit the halo sits on the route line between two nodes.
Labels are always on, in Literata 15–16px, with a mono caps subtitle. That fixes the useful maximum
around thirty nodes per sector, which matches how a Starforged sector actually grows. A legend sits
bottom-left.

**Routes.** Travelled: `stroke-dasharray 1.2 1` in accent at 55%. Known but untravelled: `0.6 1.4`
in `ink.secondary` at 40%.

**Selection pane, 330px right.** A place-shaped entity card: name, description, the oracle results
as a mono field list (first look, access, zone, visited), then everything the log has tied to this
location — vows, clocks, and open questions. This is the only place in the app where a deferred
question resurfaces on its own. Action chips at the bottom.

**Second view (`⌥2`).** `4b`'s route ledger: geography discarded, sequence kept. The route as a
horizontal rail with spurs hanging off it, the expedition track that got you there in `2a` tally
boxes beneath, and per-system panels for rival claims and next passage. Same data model, so this is
cheap. `⌥1` returns to the chart.

### 5. Oracle — decided: `5a` "Palette", with two things borrowed from `5b`

**Palette.** Summoned over the journal on `⌘O`; the journal stays visible behind a
`rgba(5,8,14,.72)` scrim. 720px wide, `surface.raised`, 8px radius, positioned 54px from the top.

Header row: a search glyph, the question **typed in plain language** ("who is still moving in
here"), a caret, and a mono hint. The typed question is kept with the result, so the log records
what the player wanted to know as well as what came back.

Option rows below, each with a 74px mono caps type label — `ask`, `table`, `table`, `write`. The ask
row carries **the three odds inline as chips** (unlikely / 50-50 / likely); arrow keys move between
them and Enter rolls. Two keystrokes from typing to answer.

Result arrives in the ghost block: the odds and the roll (`d100 → 34 vs 50`), a match called out in
violet at the right, then the answer in Literata 30px with its meaning spelled out in prose beside
it. **A match on an oracle ask is the most story-productive event in the system; a number alone
hides it.** Key legend:
`⏎ keep & write · R roll again · T follow with a table · esc discard, nothing logged`.

Borrowed from `5b`: the **consultation strip** (a chain of rolls in one line of questioning
accumulates and lands as a single log entry, `Tab` moves to the next suggested table) and the
**highlighted table row**, shown in the palette on demand.

**Reference browser (`5b`).** A destination you open deliberately, and the same screen you read
oracles from when not playing. Left rail of tables by category plus recents. Centre: the table title
with its Datasworn id, roll/manual chips, and the full range table with the rolled row highlighted —
2px accent left border, accent wash, larger type, the roll number at the right. `M` lets the player
type a physically-rolled number and the same row lights up. Physical dice are a first-class input,
not a fallback.

### 6. Entity panes — decided: both, split by type

**`6a` "Playkit sheet" for the player's own character.** An instrument. Identity and the five stats
as a row of 5 equal boxes (mono 22px value over a 9.5px caps label). Condition meters as 5-segment
bars with a mono `4/5` at the right. **Impacts as the full printed set of chips**, marked ones solid
in `outcome.weak`, unmarked ones dashed and muted — so the player can see what is _not_ wrong with
them. Assets as cards with their abilities in readable prose, purchased dots filled and unpurchased
hollow, following the printed card's own logic. Vehicles are assets with a condition meter, not a
separate entity type. **Every card carries one line of session provenance** —
`used tonight · event 12`, `damaged tonight · event 24`, `not used tonight` — which is what turns a
sheet into a record. A fulfilled vow keeps its boxes, in mint, with the resolving roll beneath it.

**`6b` "Dossier" for everything else** — NPCs, factions, places, craft. One template, five sections:
description in Literata 17px, a one-line mechanical strip that expands on `⌥M`, "what it carries",
"what it is committed to", and **"appears in"** — the connection graph as a list of the last few
times this entity mattered, which is more useful for a character than a constellation and much
cheaper. Left rail groups entities by type, with an "unnamed" group for open questions like _whoever
paid the indenture_.

Both panes carry `6a`'s per-item provenance and `6b`'s "appears in".

### 7. Assets — decided: both, `7a` permanent and `7b` as an end-of-session prompt

**`7a` "Card wall".** The browsable deck and the assets reference in one. Left rail: categories with
counts, three show-toggles (hers already / affordable now / out of reach), and a "suits her vows"
filter that matches cards against the player's open vows. Centre: a search field and a 3-column card
grid.

Cards keep the printed anatomy — category, icon, three ability dots, condition meter where the card
has one. **Three distinct treatments, not badges:** affordable-and-recommended (accent border,
accent-washed header, a `0 0 0 1px` accent halo), owned or plain (neutral border), and blocked
(dimmed surface, dimmed header, and the blocker stated in prose with the fix named — "requires an
intact hull; the Kingfisher is battered"). Prerequisites are a Datasworn field, so blocked states
are generated. On an owned card, the **next unbought ability** is the one displayed, its dot dashed
like every other pending thing. Upgrading is the same gesture as taking, at a different price. A
dashed "write your own asset" tile closes the grid.

The app's only opinions here are two short suggestion lines — _suits her new vow_, _Oyelaran?_ —
both ignorable, neither reordering the grid.

**`7b` "Advancement ledger".** Appears once at end of session when experience is unspent, and `⌥A`
drops into the wall. Sixty-seven cards collapse to the four live choices, as a table: cost, what it
buys, **and a "why now" column drawn from the log** ("The CHORUS vow is an information problem and
she has nothing for it"). Experience is a row of dots, lit and unlit. Overspending is allowed as a
_selection_ and reported as `1 short` rather than blocked, so two options can be held side by side
before choosing. Banking is a row in the ledger with its own arithmetic, not a dismissal.

### 8. Themes — decided: `8b` warm ground for Ironsworn, `9a` + `9b` for light

Four built-in themes plus one:

| Theme                             | Ground               | Accent                | Pressure            |
| --------------------------------- | -------------------- | --------------------- | ------------------- |
| Glacial dark (Starforged default) | `#05080E` blue-black | `#7FD4F5` ice         | `#D9A85C` amber     |
| Glacial light                     | `#EEF3F8` cool paper | `#156587` deep ice    | `#96601A`           |
| Ember dark (Ironsworn default)    | `#100C09` warm black | `#E09A5C` ember       | `#9FC9E8` cold blue |
| Ember light                       | `#F4EEE4` parchment  | `#964A14` burnt umber | `#185A7C`           |
| Paper (either ruleset)            | `#FFFFFF`            | theme accent          | theme pressure      |

The ember variant rotates **eleven values and zero components**. That is the theming contract: a
theme is a palette, never new component design. Note the pressure hue rotates _opposite_ to the
accent in each family, preserving the rule that player progress and world pressure never share a
hue.

**Light is not an inversion.** Accents darken rather than lighten (`#7FD4F5` → `#156587`), because a
pale accent on a pale ground has nowhere to go; the outcome hues darken by the same rule. Elevation
reverses: in dark, raised surfaces get lighter; in light, raised surfaces go whiter than a tinted
page. Same token names, opposite ramp order. Prose weight goes 300 → 400, because thin serif on a
bright ground loses its stroke — the only typographic value a theme may change.

**The sector map stays dark in every theme**, as a chart on a dark plate. A starfield on white does
not exist.

### 9. User themability — the slot contract

Users can author themes. Fourteen colour slots, in four groups:

- **Ground (5)** — `void`, `sunken`, `base`, `raised`, `overlay`. The user picks `void`; the rest
  derive along a lightness ramp and can each be overridden.
- **Ink (4)** — `primary`, `secondary`, `muted`, `hairline`. Contrast-checked against ground:
  primary ≥ 7:1, secondary and muted ≥ 4.5:1. A failing value is corrected at render and the user is
  told.
- **Accent (2)** — `accent` (player progress) and `pressure` (world clocks). **The one hard rule in
  the contract: these must differ by at least 60° of hue.**
- **Outcome (3 editable + 1 locked)** — strong hit, weak hit, miss are editable; **match stays
  violet** because it is the one signal that must never be mistaken. Every outcome carries its glyph
  (▲ ◐ ▼ ✦) as well as its hue, so a colourblind or badly chosen palette still reads.

Themes are a small JSON file, exportable and shareable — the same distribution model as the
rulesets. **A theme that fails a rule still saves**; the app corrects at render and notes it in the
editor rather than refusing.

Out of the user's reach: fonts, spacing, radius, motion timings, glyphs, and the shapes of tracks
and clocks. Those carry the meaning that makes a screen readable at a glance. One exception: prose
weight, nudgeable one step.

---

## Interactions and behaviour

### Keyboard map

Keyboard-first throughout; the mouse is never required. Every shortcut visible in the UI it affects,
in mono, muted.

| Key          | Action                                                                         |
| ------------ | ------------------------------------------------------------------------------ |
| `⌘K`         | Command palette                                                                |
| `⌘O`         | Oracle palette                                                                 |
| `⏎`          | Accept the offered suggestion                                                  |
| `Esc`        | Decline / discard / leave unanswered — always safe, always logged as a decline |
| `⌥⏎`         | Adjust — open the two-field editor on a suggestion                             |
| `P`          | Pay the price                                                                  |
| `R`          | Roll again                                                                     |
| `T`          | Follow with a table                                                            |
| `W`          | Write it yourself                                                              |
| `M`          | Enter a physical roll by hand                                                  |
| `⌥M` / `⌥⇧M` | Mark / unmark a track                                                          |
| `⌥R`         | Roll progress                                                                  |
| `H`          | Toggle the hex grid                                                            |
| `⌥1` / `⌥2`  | Sector chart / route ledger                                                    |
| `⌥0`         | Fit map to view                                                                |
| `N`          | New node (map) / new homebrew asset (assets)                                   |
| `⌥A`         | Browse all asset cards                                                         |
| `⌘\`         | Toggle rails                                                                   |
| `⌘.`         | Focus mode                                                                     |
| `Tab`        | Next entity / next suggested oracle table                                      |
| `⌫`          | Deselect                                                                       |

Unmarking a track and reversing a decision are **ordinary actions, not undo dialogs**.

### Motion

Three durations only: **90ms enter** (a tick stroke, a chip appearing), **140ms settle** (a value
counting to its new number, a ghost hardening into committed state), **260ms ceremony** (the aurora
sweep when a track becomes rollable). Easing `cubic-bezier(.2,.8,.2,1)` throughout.

The ghost pulse is a 3.4s `ease-in-out` infinite loop on **box-shadow only** — never opacity, which
would drag the text contrast down with it.

Under `prefers-reduced-motion`: durations to 0, the pulse becomes a static border, and the ceremony
becomes an instant border-and-copy change.

### Suggestion lifecycle

1. A move resolves, or the app infers something from the log.
2. A ghost block appears — dashed accent border, wash, pulsing shadow. In the journal the affected
   rail value simultaneously shows its **ghost delta** (`7 → 2` at ~60% opacity, bar not yet
   redrawn). Same suggestion, two places, one keystroke.
3. `⏎` commits: the rail number counts down over 140ms, the ghost hardens, a log entry is written
   with full provenance.
4. `Esc` declines: the block stays in place, greyed and timestamped. The audit trail is visible, not
   archived.

---

## Design tokens

### Glacial dark (the reference theme)

```
surface.void      #05080E      ink.primary     #E8EEF6   14.1:1
surface.sunken    #0A0F18      ink.secondary   #A8B7CB    8.2:1
surface.base      #0E1420      ink.muted       #7E92A8    4.9:1
surface.raised    #141C2A      ink.entity      #CFE8F6
surface.overlay   #1B2534

hairline          rgba(150,180,215,.12)
divider.strong    rgba(150,180,215,.26)
border.default    rgba(150,180,215,.16)

accent            #7FD4F5      outcome.strong  #8FE3C0  ▲
accent.deep       #2E6E8E      outcome.weak    #D9A85C  ◐
pressure          #D9A85C      outcome.miss    #CE6B75  ▼
                               outcome.match   #A98BFF  ✦  (locked)
```

`#6F8299` existed as a `faint` token and was removed from all text use — it fails 4.5:1 on
`surface.base`. Use `ink.muted` for the smallest text; reserve anything fainter for structure.

### Ember dark

```
surface.void      #100C09      ink.primary     #F2EAE0
surface.sunken    #1A1310      ink.secondary   #C4B3A2
surface.base      #1A1310      ink.muted       #9A8B7C
surface.raised    #241A14      ink.entity      #F5DFC6
surface.overlay   #31241B

hairline          rgba(215,190,165,.12)
accent            #E09A5C      accent.deep     #8A5326
pressure          #9FC9E8      outcome.miss    #D0625F
```

### Light themes

```
Glacial light   page #EEF3F8  raised #FFFFFF  ink #101820 / #2C4256 / #4C6478
                accent #156587  pressure #96601A  miss #B23A46
Ember light     page #F4EEE4  raised #FFFCF7  ink #1E1710 / #4A3B2C / #6E5A45
                accent #964A14  pressure #185A7C  miss #A83A32
Paper           page #FFFFFF  rail #FAFBFC     ink #111417 / #33393F / #5A6672
```

### Type

| Role            | Font          | Size / line-height                          | Weight              |
| --------------- | ------------- | ------------------------------------------- | ------------------- |
| Prose           | Literata      | 18–19 / 1.6–1.62, measure 60–66ch           | 300 dark, 400 light |
| Display         | Literata      | 24–40 / 1.1–1.25                            | 300                 |
| UI              | Archivo       | 13 / 1.45                                   | 400, 500, 600       |
| Label           | Archivo       | 11, uppercase, .14em                        | 500                 |
| Mono label      | IBM Plex Mono | 10–10.5, uppercase, .16em                   | 400                 |
| Dice / numerics | IBM Plex Mono | 13–15, `font-variant-numeric: tabular-nums` | 400, 500            |

Tabular numerals are mandatory on every dice value, meter, and clock reading. Numbers that shift
width when they change are unreadable in a rail.

### Space, radius, shadow

```
space    4 · 8 · 12 · 16 · 24 · 32 · 48 · 64
radius   3 (chip, small box) · 6 (card, panel) · 10 (window) · 999 (pill)
shadow   window   0 40px 90px -50px rgba(0,0,0,.9)
         overlay  0 30px 70px -20px rgba(0,0,0,.85)
         glow     0 0 12–16px <accent at 30–55%>   — current momentum column, lit bars only
```

### Ghost block (the suggestion primitive)

```
border      1px dashed <accent at 40%>
radius      6px
background  linear-gradient(180deg, <accent at 5%>, transparent)
animation   ghostpulse 3.4s ease-in-out infinite
            @keyframes ghostpulse {
              0%,100% { box-shadow: 0 0 0 0 <accent at 0%>; }
              50%     { box-shadow: 0 0 0 1px <accent at 30%>; }
            }
padding     16–20px
```

---

## State

Read `source-briefs/02-MODULE-CONTRACT.md` for the intended architecture; it is the authority. What
the designs assume of it:

- **An append-only event log** is the source of truth. Character state, tracks, and entities are
  projections over it. Screens display derived state but every value traces to an event.
- **Every mechanical event carries provenance**: dice values, digital or physical, the Datasworn id
  of the move or table consulted, timestamp, and session number. The UI shows this, so it cannot be
  optional in the model.
- **Suggestions are first-class records**, not transient UI. A suggestion has offered / accepted /
  declined states and a declined one renders in the log forever.
- **Rulesets are data.** Moves, oracles, assets, and truths come from Datasworn JSON (`classic.json`
  is in the project's uploads; Starforged equivalent needed). Nothing about Ironsworn versus
  Starforged should be hardcoded in a component — including the impact/debility chip row, which
  swaps wholesale per ruleset.
- **Themes are data**: a 14-slot JSON document, with validation applied at render, not at save.
- **Entities are one type with a kind discriminator.** Character, NPC, faction, place, vehicle, and
  derelict all render from `6a` or `6b`; vehicles are assets with a condition meter.
- Open questions — unanswered session-zero truths, deferred oracle questions — are threads, and
  surface on both the threads list and the relevant entity.

## Recommended shape

No stack is prescribed by the briefs, so: a local-first desktop app. Everything here is
keyboard-driven, offline-capable, and single-user — there is no server in this design. Tauri or
Electron with React, or a native shell if preferred. Data local, exportable as plain files, since
the product's stated position is that the player owns their log.

## Assets

- **Asset card icons** — placeholders in the design. Real set in
  `Ironsworn-Starforged-Assets-Sheets.pdf` / `-Singles.pdf`. Extract during build.
- **Fonts** — Literata, Archivo, IBM Plex Mono. All three are open-licensed and available from
  Google Fonts; bundle them rather than loading from a CDN, since the app is offline-first.
- **Rules data** — Datasworn JSON. `classic.json` (Ironsworn) is in the project uploads; the
  Starforged dataset is needed.
- No images, photography, or illustration is used anywhere in the design.

## Files in this bundle

```
Foundations.dc.html   The design document — nine turns, newest at top. Open in a browser.
support.js            Runtime required by the design document.
source-briefs/
  00-PROJECT-BRIEF.md   Vision and constraints. Read first.
  02-MODULE-CONTRACT.md Intended architecture.
  03-DESIGN-BRIEF.md    Design brief this work answers.
README.md             This file.
```

Reading the design document: each `<section>` is one turn of work, newest at the top. Options are
badged `1a`, `1b`, `2a` and so on; annotations sit beneath each option and a "Decided" or
"Recommendation" block closes each turn. The turns as decided: 1 journal, 2 tracks, 3 session zero,
4 sector map, 5 oracle, 6 entities, 7 assets, 8 ember variant, 9 light and themability. The token
sheet is at the bottom of turn 1.

## Open questions for the developer to raise

1. Empty states, error states, and first-run-with-no-campaign are undesigned.
2. Sector map auto-layout — not designed, and it would change the pin design.
3. Session recap / end-of-session summary is only implied by `7b`.
4. Multi-character and co-op play are out of scope in these designs; confirm before modelling for
   them.
