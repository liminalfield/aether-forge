import type {
  CheckDefinition,
  CheckInput,
  ContentPackage,
  EffectSuggestion,
  ProjectionContext,
} from '@aether-forge/core';
import { entities, nameOf } from '@aether-forge/core';

import { MOMENTUM_CHANGED, STARFORGED_SYSTEM_ID } from './ids.js';
import {
  ACTION_ROLL_OUTCOMES,
  interpretActionRoll,
  interpretNoRoll,
  interpretProgressRoll,
  NO_ROLL_OUTCOMES,
  PROGRESS_ROLL_OUTCOMES,
  type SuggestsFor,
} from './interpreters.js';

/**
 * The whole move list, built from installed content joined to the three
 * interpreters.
 *
 * Identity, name, document reference and stat options come from the package;
 * what the dice mean comes from the interpreter the move's kind selects.
 * A move of a kind this module does not run (the special-track pair, for
 * now) offers no check, and its document remains readable, which is the
 * honest split: the application can show what it cannot yet run.
 *
 * The compartment is read with a narrow reader of this module's own,
 * because a package is whatever its file says until somebody has read it,
 * and core hands the compartment over unread on purpose.
 */

interface MoveFact {
  readonly id: string;
  readonly name: string;
  readonly kind: 'action' | 'progress' | 'none' | 'special';
  readonly stats: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const KINDS = ['action', 'progress', 'none', 'special'] as const;

function readFact(value: unknown): MoveFact | undefined {
  if (!isRecord(value)) return undefined;
  const { id, name, kind, stats } = value;
  if (typeof id !== 'string' || id === '' || typeof name !== 'string' || name === '') {
    return undefined;
  }
  if (!KINDS.includes(kind as MoveFact['kind'])) return undefined;
  if (!Array.isArray(stats) || !stats.every((each) => typeof each === 'string')) return undefined;
  return { id, name, kind: kind as MoveFact['kind'], stats: stats as string[] };
}

function readFacts(box: ContentPackage): readonly MoveFact[] {
  if (!isRecord(box.raw)) return [];
  if (box.raw['formatVersion'] !== 1) return [];
  const moves = box.raw['moves'];
  if (!Array.isArray(moves)) return [];
  return moves.flatMap((each) => {
    const fact = readFact(each);
    return fact === undefined ? [] : [fact];
  });
}

/**
 * The stat the application would use for this move, read from the character.
 *
 * The campaign's first character-typed entity stands in for "the character"
 * until session zero decides the question; among the stats this move
 * actually offers, the strongest is suggested, with whose it is said.
 */
function suggestAmong(stats: readonly string[]) {
  return (context: ProjectionContext): { value: number; why: string } | undefined => {
    const character = context
      .stateOf(entities)
      .entities.find((each) => each.entityType === `sys.${STARFORGED_SYSTEM_ID}.character`);
    if (character === undefined) return undefined;

    let best: { stat: string; value: number } | undefined;
    for (const stat of stats) {
      const value = character.fields[stat];
      if (typeof value !== 'number') continue;
      if (best === undefined || value > best.value) best = { stat, value };
    }
    if (best === undefined) return undefined;

    const whose = nameOf(character) ?? 'the character';
    return { value: best.value, why: `${best.stat} is the strongest ${whose} has` };
  };
}

/** A proposal to move momentum, every field described, per the contract. */
function momentumSuggestion(checkId: string, by: number, reason: string): EffectSuggestion {
  return {
    id: `${checkId}#momentum`,
    label: `Momentum ${by > 0 ? '+' : ''}${by}`,
    fields: [
      { id: 'by', label: 'Amount', kind: 'number' as const },
      { id: 'reason', label: 'Reason', kind: 'text' as const },
    ],
    proposes: {
      type: MOMENTUM_CHANGED,
      systemId: STARFORGED_SYSTEM_ID,
      payload: { by, reason },
    },
  };
}

/**
 * Per-move opinions about what an outcome proposes.
 *
 * Content cannot carry these, because an effect is a rule and the contract
 * forbids content pretending to be rules; a move nobody tuned proposes
 * nothing, which is honest. Tuning grows move by move, by hand, on purpose.
 */
function tunedProposals(checkId: string): SuggestsFor | undefined {
  const TUNED: Readonly<Record<string, Readonly<Record<string, [number, string]>>>> = {
    'starforged/adventure/face_danger': {
      'strong-hit': [1, 'a clean success'],
      'weak-hit': [-1, 'a cost paid'],
      miss: [-2, 'it went badly'],
    },
  };

  const tuned = TUNED[checkId];
  if (tuned === undefined) return undefined;
  return (outcomeId) => {
    const proposal = tuned[outcomeId];
    return proposal === undefined ? [] : [momentumSuggestion(checkId, proposal[0], proposal[1])];
  };
}

const NOTHING: SuggestsFor = () => [];

function actionCheck(fact: MoveFact): CheckDefinition {
  const suggests = tunedProposals(fact.id) ?? NOTHING;
  const inputs: CheckInput[] = [
    {
      id: 'stat',
      label: 'Stat',
      kind: 'choice',
      source: 'chosen',
      options: fact.stats.map((stat) => ({ id: stat, label: stat, value: 0 })),
      suggest: suggestAmong(fact.stats),
    },
    { id: 'bonus', label: 'Bonus', kind: 'number', source: 'chosen' },
  ];

  return {
    id: fact.id,
    name: fact.name,
    docRef: fact.id,
    roll: {
      dice: [
        { sides: 6, count: 1, label: 'action' },
        { sides: 10, count: 2, label: 'challenge' },
      ],
    },
    decisive: 'challenge',
    inputs,
    outcomes: ACTION_ROLL_OUTCOMES,
    interpret: (roll, inputs) => interpretActionRoll(roll, inputs, suggests),
  };
}

function progressCheck(fact: MoveFact): CheckDefinition {
  const suggests = tunedProposals(fact.id) ?? NOTHING;
  return {
    id: fact.id,
    name: fact.name,
    docRef: fact.id,
    roll: { dice: [{ sides: 10, count: 2, label: 'challenge' }] },
    decisive: 'challenge',
    inputs: [{ id: 'progress', label: 'Progress', kind: 'number', source: 'chosen' }],
    outcomes: PROGRESS_ROLL_OUTCOMES,
    interpret: (roll, inputs) => interpretProgressRoll(roll, inputs, suggests),
  };
}

function noRollCheck(fact: MoveFact): CheckDefinition {
  return {
    id: fact.id,
    name: fact.name,
    docRef: fact.id,
    roll: null,
    inputs: [],
    outcomes: NO_ROLL_OUTCOMES,
    interpret: () => interpretNoRoll(),
  };
}

/** Every check the given packages describe for this system, in content order. */
export function checksFrom(packages: readonly ContentPackage[]): readonly CheckDefinition[] {
  return packages
    .filter((box) => box.manifest.systems.includes(STARFORGED_SYSTEM_ID))
    .flatMap(readFacts)
    .flatMap((fact) => {
      if (fact.kind === 'action') return [actionCheck(fact)];
      if (fact.kind === 'progress') return [progressCheck(fact)];
      if (fact.kind === 'none') return [noRollCheck(fact)];
      return [];
    });
}
