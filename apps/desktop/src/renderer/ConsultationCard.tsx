import { Label, ResultCard, tokens, type CardDie } from '@aether-forge/ui';

import type { RecordedConsultationView } from '../shared/ipc';

/**
 * What an oracle said, in the journal where it was asked.
 *
 * Drawn as a card and not in a ghost block, on purpose. The ghost block means
 * the application is proposing something and a person has not decided. An
 * answer a die gave is the opposite of undecided: it is part of what happened,
 * and drawing it as a proposal would offer it for approval it does not need.
 * The design record says this and says it disagrees with the handoff.
 *
 * The tone is `match`, which is the fourth outcome colour, the one that means
 * "something turned up" rather than good or bad. An oracle answer is neither.
 *
 * See `design/consulting-an-oracle.md`.
 */

function inWords(from: string): string {
  if (from === 'manual') return 'thrown';
  if (from === 'digital') return 'rolled';
  return from;
}

function toCardDice(consultation: RecordedConsultationView): readonly CardDie[] {
  return consultation.dice.map((die) => ({ value: die.value, from: inWords(die.from) }));
}

export interface ConsultationCardProps {
  readonly consultation: RecordedConsultationView;
}

export function ConsultationCard({ consultation }: ConsultationCardProps): React.JSX.Element {
  return (
    <div data-testid="consultation-card">
      <ResultCard
        name={consultation.name}
        {...(consultation.group === '' ? {} : { detail: consultation.group })}
        outcome={{ label: 'Consulted', glyph: '✦', tone: 'match' }}
        dice={toCardDice(consultation)}
        reference={`${consultation.package.id} ${consultation.package.version}`}
      >
        <p
          data-testid="oracle-answer"
          style={{
            margin: 0,
            fontFamily: 'var(--font-prose)',
            fontSize: tokens.type.reading,
            lineHeight: tokens.lineHeight.normal,
          }}
        >
          {consultation.answer}
        </p>

        {/*
          The range the number landed in. Kept visible because a person reading
          this back after updating a package can tell whether the table moved
          underneath them, which is the whole reason the event records it.
        */}
        <Label size="line" as="p" data-testid="oracle-row">
          {consultation.row.from}–{consultation.row.to}
        </Label>
      </ResultCard>
    </div>
  );
}
