import { useEffect, useState } from 'react';

import { Button, slot, tokens } from '@aether-forge/ui';

import type { CheckView, RunCheckRequest } from '../shared/ipc';

/**
 * Starting a check.
 *
 * Everything on screen here came from a module. The window is told what inputs
 * a check takes, what each is called, and what values a choice offers, and it
 * draws that. It contains no word from any rulebook, which is what makes a
 * second game system something that arrives rather than something that is
 * ported.
 *
 * There is no browser for choosing among many checks. One is enough to prove
 * the path, and a real one needs content packages. See the exclusions in the
 * epic.
 */

const LABEL = {
  fontFamily: 'var(--font-numeric)',
  fontSize: tokens.type.micro,
  letterSpacing: tokens.tracking.capsWide,
  textTransform: 'uppercase',
  color: slot('ink', 'muted'),
} as const;

const FIELD = {
  background: slot('ground', 'raised'),
  color: slot('ink', 'primary'),
  border: `1px solid ${slot('ink', 'hairline')}`,
  borderRadius: tokens.radius.sm,
  padding: `${tokens.radius.md} ${tokens.space[8]}`,
  fontFamily: 'var(--font-numeric)',
  fontSize: tokens.type.compact,
} as const;

/** How many dice a check asks for, which is how many a person may type in. */
function diceWanted(check: CheckView): number {
  return (check.dice ?? []).reduce((total, spec) => total + spec.count, 0);
}

export interface RunACheckProps {
  readonly checks: readonly CheckView[];
  readonly onRun: (request: RunCheckRequest) => void;
  readonly busy: boolean;
}

export function RunACheck({ checks, onRun, busy }: RunACheckProps): React.JSX.Element | null {
  const [checkId, setCheckId] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [thrown, setThrown] = useState('');

  const chosen = checks.find((check) => check.id === checkId);

  // Whatever is first, until somebody says otherwise. A surface that opens with
  // nothing chosen makes a person pick before they can see what picking does.
  useEffect(() => {
    if (checkId === '' && checks[0] !== undefined) setCheckId(checks[0].id);
  }, [checkId, checks]);

  if (chosen === undefined) return null;

  const wanted = diceWanted(chosen);
  const typedIn = thrown
    .split(/[\s,]+/u)
    .filter((each) => each !== '')
    .map(Number);

  const run = (): void => {
    const numbers: Record<string, number> = {};
    for (const input of chosen.inputs) {
      // Every input has a number, and an empty box means nought rather than a
      // refusal to proceed. Nothing here blocks a person from rolling.
      // An untouched box holds the suggestion when there is one, and a person
      // who typed something else has already declined it by typing.
      const fallback = input.suggested?.value ?? 0;
      numbers[input.id] = Number(inputs[input.id] ?? fallback) || 0;
    }

    onRun({
      systemId: chosen.systemId,
      checkId: chosen.id,
      inputs: numbers,
      // Absent means the application rolls. Present means somebody threw them
      // and typed in what they showed, and everything downstream is identical.
      ...(typedIn.length === wanted && wanted > 0 ? { thrown: typedIn } : {}),
    });
  };

  return (
    <section
      data-testid="run-a-check"
      style={{
        display: 'grid',
        gap: tokens.space[16],
        padding: tokens.space[16],
        border: `1px solid ${slot('ink', 'hairline')}`,
        borderRadius: tokens.radius.md,
        background: slot('ground', 'sunken'),
      }}
    >
      <div style={{ display: 'grid', gap: tokens.space[4] }}>
        <label style={LABEL} htmlFor="which-check">
          Check
        </label>
        <select
          id="which-check"
          data-testid="which-check"
          value={checkId}
          onChange={(event) => {
            setCheckId(event.target.value);
            setInputs({});
            setThrown('');
          }}
          style={FIELD}
        >
          {checks.map((check) => (
            <option key={check.id} value={check.id}>
              {check.name}
            </option>
          ))}
        </select>
      </div>

      {chosen.inputs.map((input) => (
        <div key={input.id} style={{ display: 'grid', gap: tokens.space[4] }}>
          <label style={LABEL} htmlFor={`input-${input.id}`}>
            {input.label}
          </label>

          {/*
            A choice input is drawn as its number alone. There is nowhere yet to
            keep what each named option is worth, and nothing records which name
            was picked, so a list of them would be a control that does nothing,
            which is worse than no control. The names return when a character
            sheet exists to give them values.
          */}
          <input
            id={`input-${input.id}`}
            data-testid={`input-${input.id}`}
            inputMode="numeric"
            placeholder="0"
            value={
              inputs[input.id] ??
              (input.suggested === undefined ? '' : String(input.suggested.value))
            }
            onChange={(event) => setInputs((held) => ({ ...held, [input.id]: event.target.value }))}
            style={FIELD}
          />

          {input.suggested !== undefined && (
            <p
              data-testid={`suggested-${input.id}`}
              style={{
                margin: 0,
                color: slot('ink', 'muted'),
                fontFamily: 'var(--font-ui)',
                fontSize: tokens.type.small,
              }}
            >
              Suggested: {input.suggested.value}, because {input.suggested.why}. Type to use
              something else.
            </p>
          )}
        </div>
      ))}

      {wanted > 0 && (
        <div style={{ display: 'grid', gap: tokens.space[4] }}>
          <label style={LABEL} htmlFor="thrown">
            Dice you threw
          </label>
          <input
            id="thrown"
            data-testid="thrown"
            value={thrown}
            placeholder={`${String(wanted)} numbers, or leave it empty to roll`}
            onChange={(event) => setThrown(event.target.value)}
            style={FIELD}
          />
        </div>
      )}

      <Button data-testid="roll-it" disabled={busy} onClick={run} style={{ justifySelf: 'start' }}>
        {typedIn.length === wanted && wanted > 0 ? 'Take those dice' : 'Roll it'}
      </Button>
    </section>
  );
}
