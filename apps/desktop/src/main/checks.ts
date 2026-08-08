import type { CheckDefinition, CheckInput, ProjectionContext, SystemId } from '@aether-forge/core';

import type { CheckInputView, CheckView, ChecksView } from '../shared/ipc';
import { playableSystems, type LoadedSystem } from './systems';

/**
 * Describing a check to the window.
 *
 * A check as a module declares it cannot cross a process boundary: it carries
 * `interpret`, and an input may carry `suggest`, and both are functions. What
 * crosses is what the window has to draw, and nothing else.
 *
 * This is why the window can show Face Danger without containing the word for a
 * stat. It is handed a label and a set of values and it draws them. A second
 * game system arriving needs no change here and none in the window.
 *
 * Nothing here can fail, so nothing here returns a failure. The channel wraps
 * it, because the window handles every channel the same way and a result type
 * that can only ever say `ok` is a shape nobody should have to check.
 */

function describeInput(input: CheckInput, context: ProjectionContext | undefined): CheckInputView {
  const described: CheckInputView = { id: input.id, label: input.label, kind: input.kind };

  // Spread rather than a key set to undefined. `exactOptionalPropertyTypes` is
  // on, and a key that exists holding undefined is a different thing over IPC
  // from a key that is absent.
  const withOptions =
    input.options === undefined ? described : { ...described, options: [...input.options] };

  // What the application would put in the box, computed from the campaign as
  // it stands when asked. Absent when the module suggests nothing, and the
  // window must draw that fine: an empty box was the whole surface until now.
  const suggested = context === undefined ? undefined : input.suggest?.(context);
  return suggested === undefined ? withOptions : { ...withOptions, suggested };
}

function describeCheck(
  check: CheckDefinition,
  systemId: SystemId,
  context: ProjectionContext | undefined,
): CheckView {
  const described: CheckView = {
    id: check.id,
    systemId,
    name: check.name,
    inputs: check.inputs.map((input) => describeInput(input, context)),
  };

  // A check with no dice is a real thing rather than an oversight: taking stock
  // of where you are uses the same machinery and rolls nothing.
  const withDice =
    check.roll === null
      ? described
      : { ...described, dice: check.roll.dice.map((die) => ({ ...die })) };

  return check.docRef === undefined ? withDice : { ...withDice, docRef: check.docRef };
}

/**
 * Every check every loaded system declares.
 *
 * In load order, and within a system in the order that system declares them,
 * because a list that reorders itself between two reads is a list a person
 * cannot learn.
 *
 * Only systems somebody plays. The toy is loaded and is not one of them:
 * offering its coin flip beside a real check would be showing somebody a test
 * fixture. Running one is still possible, which is what the tests do.
 */
export function describeChecks(
  context?: ProjectionContext,
  systems: readonly LoadedSystem[] = playableSystems(),
): ChecksView {
  return {
    checks: systems.flatMap((system) =>
      system.checks.map((check) => describeCheck(check, system.systemId, context)),
    ),
  };
}
