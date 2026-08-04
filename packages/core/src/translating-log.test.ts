import { describe, expect, it } from 'vitest';

import { createMemoryEventLog } from './memory-log.js';
import { createEventSchemas, type EventSchemas } from './schema.js';
import { createTranslatingLog } from './translating-log.js';

const ENTRY = 'core.entry.created';

function aLog() {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => `2026-08-04T09:00:0${(tick += 1)}.000Z`,
    nextEventId: () => `event-${tick}`,
  });
}

/** As the shapes stood when only version 1 existed. */
function schemasAtVersionOne(): EventSchemas {
  const schemas = createEventSchemas();
  schemas.declare({ type: ENTRY, currentVersion: 1, translations: [] });
  return schemas;
}

/** The same type, two changes later. */
function schemasAtVersionThree(): EventSchemas {
  const schemas = createEventSchemas();
  schemas.declare({
    type: ENTRY,
    currentVersion: 3,
    translations: [
      // Version 1 held the text under a different name.
      {
        type: ENTRY,
        fromVersion: 1,
        translate: (payload) => ({ text: (payload as { body: string }).body }),
      },
      // Version 2 gained a field older entries never had.
      {
        type: ENTRY,
        fromVersion: 2,
        translate: (payload) => ({ ...(payload as object), pinned: false }),
      },
    ],
  });
  return schemas;
}

describe('writing', () => {
  it('stamps the current version, so no caller has to know it', () => {
    const log = aLog();
    const writing = createTranslatingLog(log, schemasAtVersionThree());

    const appended = writing.append({ type: ENTRY, payload: { text: 'a', pinned: false } });

    expect(appended.ok && appended.value.schemaVersion).toBe(3);
  });

  it('refuses to write an event type nobody declared', () => {
    const writing = createTranslatingLog(aLog(), createEventSchemas());
    const appended = writing.append({ type: ENTRY, payload: {} });

    expect(!appended.ok && appended.failure.kind).toBe('unknown-event-type');
  });
});

describe('reading an event written by an older build', () => {
  /** Write at version 1, then read with the shapes as they stand two changes later. */
  function writtenLongAgoThenRead() {
    const log = aLog();
    createTranslatingLog(log, schemasAtVersionOne()).append({
      type: ENTRY,
      payload: { body: 'The airlock did not open.' },
    });
    return { log, reading: createTranslatingLog(log, schemasAtVersionThree()) };
  }

  it('arrives in the current shape', () => {
    const { reading } = writtenLongAgoThenRead();
    const read = reading.read();

    expect(read.ok && read.value[0]?.payload).toEqual({
      text: 'The airlock did not open.',
      pinned: false,
    });
  });

  it('reports the version it now is, not the one it was written at', () => {
    const { reading } = writtenLongAgoThenRead();
    const read = reading.read();

    expect(read.ok && read.value[0]?.schemaVersion).toBe(3);
  });

  it('leaves what is stored exactly as it was written', () => {
    const { log, reading } = writtenLongAgoThenRead();
    reading.read();

    // The same underlying log, read without translation. Translating on the way
    // out must never be mistaken for migrating what is stored.
    const stored = log.read();
    expect(stored.ok && stored.value[0]?.payload).toEqual({
      body: 'The airlock did not open.',
    });
    expect(stored.ok && stored.value[0]?.schemaVersion).toBe(1);
  });

  it('leaves an already-current event untouched', () => {
    const log = aLog();
    const writing = createTranslatingLog(log, schemasAtVersionThree());
    writing.append({ type: ENTRY, payload: { text: 'a', pinned: true } });

    const read = writing.read();
    expect(read.ok && read.value[0]?.payload).toEqual({ text: 'a', pinned: true });
  });
});

describe('when translation cannot be done', () => {
  it('reports an event written by a newer build rather than guessing', () => {
    const log = aLog();
    createTranslatingLog(log, schemasAtVersionThree()).append({ type: ENTRY, payload: {} });

    // The same campaign opened by an older build, which knows only version 1.
    const read = createTranslatingLog(log, schemasAtVersionOne()).read();

    expect(!read.ok && read.failure.kind).toBe('written-by-a-newer-version');
  });

  it('reports a translation that throws, naming the step', () => {
    const log = aLog();
    createTranslatingLog(log, schemasAtVersionOne()).append({ type: ENTRY, payload: {} });

    const broken = createEventSchemas();
    broken.declare({
      type: ENTRY,
      currentVersion: 2,
      translations: [
        {
          type: ENTRY,
          fromVersion: 1,
          translate: () => {
            throw new Error('this translation has a bug');
          },
        },
      ],
    });

    const read = createTranslatingLog(log, broken).read();

    expect(!read.ok && read.failure).toMatchObject({
      kind: 'translation-failed',
      type: ENTRY,
      fromVersion: 1,
    });
  });
});
