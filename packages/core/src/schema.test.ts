import { describe, expect, it } from 'vitest';

import { createEventSchemas, type Translation } from './schema.js';

const ENTRY = 'core.entry.created';

/** A translation that records it ran, so a chain can be checked in order. */
function step(fromVersion: number, change: (payload: Record<string, unknown>) => unknown) {
  return {
    type: ENTRY,
    fromVersion,
    translate: (payload: unknown) => change(payload as Record<string, unknown>),
  } satisfies Translation;
}

describe('declaring an event type', () => {
  it('accepts a type that has never changed', () => {
    const schemas = createEventSchemas();
    const declared = schemas.declare({ type: ENTRY, currentVersion: 1, translations: [] });

    expect(declared.ok).toBe(true);
    expect(schemas.knows(ENTRY)).toBe(true);
    expect(schemas.currentVersion(ENTRY)).toEqual({ ok: true, value: 1 });
  });

  it('accepts a complete chain of changes', () => {
    const schemas = createEventSchemas();
    const declared = schemas.declare({
      type: ENTRY,
      currentVersion: 3,
      translations: [step(1, (p) => p), step(2, (p) => p)],
    });

    expect(declared.ok).toBe(true);
  });

  it('refuses a chain with a step missing', () => {
    const schemas = createEventSchemas();
    // Goes 1 to 2 and 3 to 4, so an event written at version 2 could never be
    // brought up to date. Caught now rather than years from now.
    const declared = schemas.declare({
      type: ENTRY,
      currentVersion: 4,
      translations: [step(1, (p) => p), step(3, (p) => p)],
    });

    expect(declared.ok).toBe(false);
    expect(!declared.ok && declared.failure).toEqual({
      kind: 'incomplete-history',
      type: ENTRY,
      missingSteps: [2],
    });
  });

  it('refuses to redeclare a type', () => {
    const schemas = createEventSchemas();
    schemas.declare({ type: ENTRY, currentVersion: 1, translations: [] });
    const again = schemas.declare({
      type: ENTRY,
      currentVersion: 2,
      translations: [step(1, (p) => p)],
    });

    expect(!again.ok && again.failure.kind).toBe('already-declared');
  });

  it('refuses a translation belonging to a different type', () => {
    const schemas = createEventSchemas();
    const declared = schemas.declare({
      type: 'core.track.advanced',
      currentVersion: 2,
      translations: [step(1, (p) => p)],
    });

    expect(!declared.ok && declared.failure.kind).toBe('translation-for-another-type');
  });

  it('refuses a version below one', () => {
    const schemas = createEventSchemas();
    const declared = schemas.declare({ type: ENTRY, currentVersion: 0, translations: [] });

    expect(!declared.ok && declared.failure.kind).toBe('version-must-be-at-least-one');
  });
});

describe('asking what an old event needs', () => {
  function schemasWithThreeVersions() {
    const schemas = createEventSchemas();
    schemas.declare({
      type: ENTRY,
      currentVersion: 3,
      translations: [
        // Version 1 held the text under a different name.
        step(1, (payload) => ({ text: payload['body'] })),
        // Version 2 gained a field that older entries did not have.
        step(2, (payload) => ({ ...payload, pinned: false })),
      ],
    });
    return schemas;
  }

  it('needs nothing for an event already on the current shape', () => {
    const needed = schemasWithThreeVersions().translationsFrom(ENTRY, 3);
    expect(needed.ok && needed.value).toEqual([]);
  });

  it('returns the steps in the order they must run', () => {
    const needed = schemasWithThreeVersions().translationsFrom(ENTRY, 1);
    expect(needed.ok && needed.value.map((s) => s.fromVersion)).toEqual([1, 2]);
  });

  it('returns only the steps still outstanding', () => {
    const needed = schemasWithThreeVersions().translationsFrom(ENTRY, 2);
    expect(needed.ok && needed.value.map((s) => s.fromVersion)).toEqual([2]);
  });

  it('actually brings an old payload up to the current shape', () => {
    const needed = schemasWithThreeVersions().translationsFrom(ENTRY, 1);
    if (!needed.ok) throw new Error('expected translations');

    const asWrittenLongAgo = { body: 'The airlock did not open.' };
    const current = needed.value.reduce<unknown>(
      (payload, translation) => translation.translate(payload),
      asWrittenLongAgo,
    );

    expect(current).toEqual({ text: 'The airlock did not open.', pinned: false });
  });

  it('says so when an event was written by a newer build', () => {
    // Opening a campaign last touched by a version of the application that knew
    // a shape this one does not. There is no translating forwards into the
    // past, and pretending otherwise would quietly lose what the event said.
    const needed = schemasWithThreeVersions().translationsFrom(ENTRY, 7);

    expect(!needed.ok && needed.failure).toEqual({
      kind: 'written-by-a-newer-version',
      type: ENTRY,
      storedVersion: 7,
      knownVersion: 3,
    });
  });

  it('says so when the type was never declared', () => {
    const needed = createEventSchemas().translationsFrom('sys.toy-coinflip.coin.flipped', 1);
    expect(!needed.ok && needed.failure.kind).toBe('unknown-event-type');
  });
});
