import { useState } from 'react';

import { Chip, ChipRow, ResultCard, slot, tokens, type CardDie } from '@aether-forge/ui';

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

function toCardDice(check: RecordedCheckView): readonly CardDie[] {
  return check.dice.map((die) => {
    const base = { value: die.value, from: inWords(die.from) };
    return die.label === undefined ? base : { ...base, label: die.label, emphasis: true };
  });
}

/** What it ran with, in the module's own words for each input. */
function detailOf(check: RecordedCheckView): string | undefined {
  const parts = Object.entries(check.inputs).map(([input, value]) => `${input} ${String(value)}`);
  return parts.length === 0 ? undefined : parts.join('  ');
}

export interface CheckCardProps {
  readonly check: RecordedCheckView;
  readonly onAnswer: (offerId: string, answer: OfferAnswer) => void;
  readonly busy: boolean;
}

/** What became of an offer, once somebody has answered it. */
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
        fontSize: '11px',
        letterSpacing: '.14em',
        textTransform: 'uppercase',
      }}
    >
      {offer.label}: {said}
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
    <div style={{ display: 'grid', gap: tokens.space.sm }}>
      {offer.why !== undefined && (
        <p style={{ margin: 0, color: slot('ink', 'muted'), fontSize: tokens.fontSize.sm }}>
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
              style={{
                width: '5ch',
                background: slot('ground', 'overlay'),
                color: slot('ink', 'primary'),
                border: `1px solid ${slot('ink', 'hairline')}`,
                borderRadius: tokens.radius.sm,
                padding: '4px 6px',
                fontFamily: 'var(--font-numeric)',
                fontSize: '12px',
              }}
            />
            <Chip
              hint="⌥⏎"
              data-testid="adjust-it"
              disabled={busy || Number.isNaN(Number(changingTo)) || changingTo.trim() === ''}
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

        if (event.key === 'Escape') {
          event.preventDefault();
          onAnswer(first.id, { kind: 'declined' });
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          onAnswer(first.id, { kind: 'accepted' });
        }
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
          style={{ margin: 0, fontFamily: 'var(--font-prose)', fontSize: '15px', lineHeight: 1.5 }}
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
