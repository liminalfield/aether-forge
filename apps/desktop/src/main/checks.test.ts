import type { CheckDefinition } from '@aether-forge/core';
import { STARFORGED_SYSTEM_ID } from '@aether-forge/system-ironsworn';
import { CALL_IT, TOY_SYSTEM_ID } from '@aether-forge/system-toy';
import { describe, expect, it } from 'vitest';

import type { CheckView } from '../shared/ipc';
import { describeChecks } from './checks';
import { loadFixtureSystems } from './content-fixture';
import { loadedSystems, playableSystems } from './systems';

loadFixtureSystems();

const described = (): readonly CheckView[] => describeChecks(undefined).checks;

const find = (id: string): CheckView | undefined => described().find((check) => check.id === id);

/** Everything this build loads, playable or not. */
const everything = (): readonly CheckView[] => describeChecks(undefined, loadedSystems()).checks;

const findAnywhere = (id: string): CheckView | undefined =>
  everything().find((check) => check.id === id);

describe('what crosses to the window', () => {
  it('describes every check a playable system declares', () => {
    const expected = playableSystems().flatMap((system) => system.checks.map((check) => check.id));

    expect(described().map((check) => check.id)).toEqual(expected);
  });

  it('leaves the canary out of what a person is offered', () => {
    // The toy is loaded so that every contract-consuming path runs against two
    // systems. It is not a game, and offering its coin flip beside a real check
    // would be showing somebody a test fixture.
    expect(described().some((check) => check.systemId === TOY_SYSTEM_ID)).toBe(false);
    expect(loadedSystems().some((system) => system.systemId === TOY_SYSTEM_ID)).toBe(true);
  });

  it('describes it perfectly well when asked for it', () => {
    // Not offered is not the same as not supported. The canary still has to
    // cross this boundary as cleanly as anything else.
    const toy = describeChecks(
      undefined,
      loadedSystems().filter((s) => s.systemId === TOY_SYSTEM_ID),
    );

    expect(toy.checks.map((check) => check.id)).toEqual([CALL_IT.id]);
  });

  it('says which system each one belongs to', () => {
    expect(findAnywhere(CALL_IT.id)?.systemId).toBe(TOY_SYSTEM_ID);
    expect(find(playableSystems().flatMap((system) => system.checks)[0]?.id ?? '')?.systemId).toBe(
      STARFORGED_SYSTEM_ID,
    );
  });

  it('carries no function across', () => {
    // The reason this exists. A check declares `interpret`, and an input may
    // declare `suggest`, and neither survives a process boundary. What crosses
    // has to be data or the window gets a broken object and no explanation.
    const anyFunctionIn = (value: unknown): boolean =>
      typeof value === 'function' ||
      (typeof value === 'object' && value !== null && Object.values(value).some(anyFunctionIn));

    expect(anyFunctionIn(described())).toBe(false);
  });

  it('survives being serialised, which is what actually happens to it', () => {
    const crossed: unknown = JSON.parse(JSON.stringify(described()));
    expect(crossed).toEqual(described());
  });

  it('lists them in the same order every time', () => {
    // A list that reorders itself between two reads is a list a person cannot
    // learn.
    expect(described()).toEqual(described());
  });
});

describe('a check with inputs', () => {
  const faceDanger = playableSystems().flatMap((system) => system.checks)[0];

  it('describes each one well enough to draw', () => {
    const inputs = find(faceDanger?.id ?? '')?.inputs ?? [];

    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.id).not.toBe('');
      expect(input.label).not.toBe('');
      expect(['choice', 'number']).toContain(input.kind);
    }
  });

  it('carries the values a choice offers, so the window need not know them', () => {
    // The gate. The window draws these labels without containing any of them.
    const choice = find(faceDanger?.id ?? '')?.inputs.find((input) => input.kind === 'choice');

    expect(choice?.options?.length).toBeGreaterThan(0);
    for (const option of choice?.options ?? []) {
      expect(typeof option.label).toBe('string');
      expect(typeof option.value).toBe('number');
    }
  });

  it('leaves options off an input that offers no fixed set', () => {
    // Absent rather than present and empty. Over IPC those are different
    // things, and a window drawing an empty list of choices shows a control
    // with nothing in it.
    const number = find(faceDanger?.id ?? '')?.inputs.find((input) => input.kind === 'number');

    expect(number).toBeDefined();
    expect(number).not.toHaveProperty('options');
  });

  it('says what it will roll', () => {
    const dice = find(faceDanger?.id ?? '')?.dice ?? [];

    expect(dice.length).toBeGreaterThan(0);
    for (const die of dice) {
      expect(die.sides).toBeGreaterThan(1);
      expect(die.count).toBeGreaterThan(0);
    }
  });
});

describe('the toy, which takes no inputs at all', () => {
  it('describes just as well as the one that does', () => {
    // The canary. A check with nothing to fill in has to cross this boundary as
    // cleanly as one with two, or the boundary is shaped around one system.
    const callIt = findAnywhere(CALL_IT.id);

    expect(callIt?.name).toBe(CALL_IT.name);
    expect(callIt?.inputs).toEqual([]);
  });

  it('still says what it will roll', () => {
    expect(findAnywhere(CALL_IT.id)?.dice).toHaveLength(1);
  });
});

describe('a check that rolls nothing', () => {
  it('is described with no dice rather than with none of them', () => {
    // Taking stock of where you are uses the same machinery and rolls nothing.
    const rollsNothing: CheckDefinition = {
      id: 'example.dummy/take-stock',
      name: 'Take stock',
      roll: null,
      inputs: [],
      outcomes: [{ id: 'done', label: 'Done', tone: 'match', glyph: '\u25CB' }],
      interpret: () => ({ id: 'done', label: 'Done', summary: 'You looked around.', suggests: [] }),
    };

    const only = describeChecks(undefined, [
      {
        systemId: 'example',
        checks: [rollsNothing],
        templates: [],
        checkEvents: {
          invoked: 'sys.example.check.invoked',
          resolved: 'sys.example.check.resolved',
        },
        playable: true,
      },
    ]).checks[0];

    expect(only).not.toHaveProperty('dice');
    expect(only?.name).toBe('Take stock');
  });
});

describe('the window is told, never asked to know', () => {
  it('hands over exactly what the module declared, inventing and dropping nothing', () => {
    // Everything a person will read on screen came from a module. This walks
    // both directions so that a mapping which quietly renamed a label, or lost
    // one of a choice's values, fails here rather than on screen.
    for (const system of loadedSystems()) {
      for (const declared of system.checks) {
        const crossed = findAnywhere(declared.id);

        expect(crossed?.name).toBe(declared.name);
        expect(crossed?.inputs.map((input) => input.label)).toEqual(
          declared.inputs.map((input) => input.label),
        );

        for (const input of declared.inputs) {
          const describedInput = crossed?.inputs.find((each) => each.id === input.id);
          expect(describedInput?.options).toEqual(
            input.options === undefined ? undefined : [...input.options],
          );
        }
      }
    }
  });
});
