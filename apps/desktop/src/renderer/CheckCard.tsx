import { useState } from 'react';

import {
  Chip,
  ChipRow,
  ResultCard,
  slot,
  TABULAR_NUMERALS,
  tokens,
  type CardDie,
} from '@aether-forge/ui';

import { adjustKeyIntent, cardKeyIntent, isAdjustableDraft, type FocusedControl } from './keyboard';
import type { OfferAnswer, RecordedCheckView, RecordedOfferView } from '../shared/ipc';

/**
 * One check, drawn as the card and the answers underneath it.
 *
 * The card itself knows nothing about any game. This turns what the log holds
 * into what the card takes, and that mapping is the only thing here that is
 * specific to anything.
 */

/**
 * Where a die came from, in words a person reads.
 *
 * The log says `digital` or `manual`, or names a service. Those are the words
 * the record uses; these are the words a person uses. Anything unrecognised is
 * shown as it was recorded rather than hidden, because a die from a service
 * nobody has heard of still came from somewhere.
 */
function inWords(from: string): string {
  if (from === 'manual') return 'thrown';
  if (from === 'digital') return 'rolled';
  return from;
}

/**
 * Emphasis is carried, never decided here. The module says which dice its
 * outcome turned on, the timeline marks them, and the card draws the mark. A
 * module that says nothing leaves every die plain.
 */
function toCardDice(check: RecordedCheckView): readonly CardDie[] {
  return check.dice.map((die) => {
    const base = { value: die.value, from: inWords(die.from) };
    const labelled = die.label === undefined ? base : { ...base, label: die.label };
    return die.emphasis === true ? { ...labelled, emphasis: true } : labelled;
  });
}

/** What it ran with, in the module's own words for each input. */
function detailOf(check: RecordedCheckView): string | undefined {
  const parts = check.inputs.map((input) => `${input.label} ${String(input.value)}`);
  return parts.length === 0 ? undefined : parts.join('  ');
}

export interface CheckCardProps {
  readonly check: RecordedCheckView;
  readonly onAnswer: (offerId: string, answer: OfferAnswer) => void;
  readonly busy: boolean;
}

/** When it was answered, in words a person reads at a glance. */
function saidWhen(at: string): string {
  return new Date(at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * What became of an offer, once somebody has answered it.
 *
 * The answer keeps its moment. A refusal is part of the record, and a record
 * says when.
 */
function Settled({ offer }: { readonly offer: RecordedOfferView }): React.JSX.Element {
  const said = {
    accepted: 'taken',
    adjusted: 'changed, then taken',
    declined: 'refused',
    offered: 'waiting',
  }[offer.fate];

  return (
    <p
      data-testid="settled-offer"
      style={{
        margin: 0,
        color: slot('ink', 'muted'),
        fontFamily: 'var(--font-numeric)',
        fontSize: tokens.type.tiny,
        letterSpacing: tokens.tracking.caps,
        textTransform: 'uppercase',
      }}
    >
      {offer.label}: {said}
      {offer.answeredAt !== undefined && (
        <span data-testid="settled-when" style={{ float: 'right', ...TABULAR_NUMERALS }}>
          {saidWhen(offer.answeredAt)}
        </span>
      )}
    </p>
  );
}

/**
 * One unanswered offer, and the three things a person can do about it.
 *
 * Adjusting is only offered where the module described a field that can hold a
 * number. A proposal describing nothing changeable gets take and refuse, which
 * is the honest set rather than a control that would do nothing.
 */
function Offer({
  offer,
  onAnswer,
  busy,
}: {
  readonly offer: RecordedOfferView;
  readonly onAnswer: (offerId: string, answer: OfferAnswer) => void;
  readonly busy: boolean;
}): React.JSX.Element {
  const adjustable = offer.fields.find((field) => field.kind === 'number');
  const [changingTo, setChangingTo] = useState('');

  return (
    <div style={{ display: 'grid', gap: tokens.space[8] }}>
      {offer.why !== undefined && (
        <p style={{ margin: 0, color: slot('ink', 'muted'), fontSize: tokens.type.base }}>
          {offer.why}
        </p>
      )}

      <ChipRow label={offer.label}>
        <Chip
          weight="leading"
          hint="⏎"
          aria-keyshortcuts="Enter"
          data-testid="take-it"
          disabled={busy}
          onClick={() => onAnswer(offer.id, { kind: 'accepted' })}
        >
          {offer.label}
        </Chip>

        {adjustable !== undefined && (
          <>
            <input
              aria-label={`${adjustable.label}, instead`}
              data-testid="adjust-to"
              inputMode="numeric"
              value={changingTo}
              placeholder={adjustable.label}
              onChange={(event) => setChangingTo(event.target.value)}
              onKeyDown={(event) => {
                const intent = adjustKeyIntent(event.key, changingTo);

                // Enter is consumed whatever the draft says, so a value the
                // field will not use can never fall through to anything that
                // would answer the offer some other way.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  if (intent === 'use' && !busy) {
                    onAnswer(offer.id, {
                      kind: 'adjusted',
                      used: { [adjustable.id]: Number(changingTo) },
                    });
                  }
                }

                // Escape with a draft clears the draft and goes no further.
                // With nothing typed it is left to bubble, and the card
                // declines: one press abandons the number, the next the offer.
                if (intent === 'clear') {
                  event.preventDefault();
                  event.stopPropagation();
                  setChangingTo('');
                }
              }}
              style={{
                width: '5ch',
                background: slot('ground', 'overlay'),
                color: slot('ink', 'primary'),
                border: `1px solid ${slot('ink', 'hairline')}`,
                borderRadius: tokens.radius.sm,
                padding: `${tokens.space[4]} ${tokens.radius.md}`,
                fontFamily: 'var(--font-numeric)',
                fontSize: tokens.type.small,
              }}
            />
            <Chip
              hint="⌥⏎"
              data-testid="adjust-it"
              disabled={busy || !isAdjustableDraft(changingTo)}
              onClick={() =>
                onAnswer(offer.id, {
                  kind: 'adjusted',
                  used: { [adjustable.id]: Number(changingTo) },
                })
              }
            >
              Use that instead
            </Chip>
          </>
        )}

        {/*
          Always last, always dashed, and it says so. This is the product's
          whole position in one control: an interface where declining is harder
          to find than accepting has an opinion, whatever the log records.
        */}
        <Chip
          weight="declining"
          hint="esc"
          aria-keyshortcuts="Escape"
          data-testid="just-write"
          disabled={busy}
          onClick={() => onAnswer(offer.id, { kind: 'declined' })}
        >
          Just write
        </Chip>
      </ChipRow>
    </div>
  );
}

export function CheckCard({ check, onAnswer, busy }: CheckCardProps): React.JSX.Element {
  const waiting = check.offers.filter((offer) => offer.fate === 'offered');
  const settled = check.offers.filter((offer) => offer.fate !== 'offered');
  const detail = detailOf(check);

  return (
    <div
      data-testid="check-card"
      tabIndex={0}
      onKeyDown={(event) => {
        const first = waiting[0];
        if (first === undefined || busy) return;

        // The focused control wins. A chip's Enter is that chip's click and
        // must reach it untouched; the adjust field stops what it consumes
        // before it gets here. The decision itself lives in keyboard.ts,
        // where it is tested as the table of cases it is.
        const focused: FocusedControl =
          event.target === event.currentTarget
            ? 'card'
            : event.target instanceof HTMLButtonElement
              ? 'chip'
              : 'field';
        const withModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

        const intent = cardKeyIntent(event.key, withModifier, focused);
        if (intent === 'none') return;

        event.preventDefault();
        onAnswer(first.id, { kind: intent === 'accept' ? 'accepted' : 'declined' });
      }}
      style={{ outlineColor: slot('accent', 'accent') }}
    >
      <ResultCard
        name={check.name}
        {...(detail === undefined ? {} : { detail })}
        outcome={{
          label: check.outcome.label,
          glyph: check.outcome.glyph,
          tone: check.outcome.tone,
        }}
        dice={toCardDice(check)}
        reference={check.checkId}
      >
        <p
          data-testid="outcome-summary"
          style={{
            margin: 0,
            fontFamily: 'var(--font-prose)',
            fontSize: tokens.type.reading,
            lineHeight: tokens.lineHeight.normal,
          }}
        >
          {check.outcome.summary}
        </p>

        {waiting.map((offer) => (
          <Offer key={offer.id} offer={offer} onAnswer={onAnswer} busy={busy} />
        ))}

        {settled.map((offer) => (
          <Settled key={offer.id} offer={offer} />
        ))}
      </ResultCard>
    </div>
  );
}
