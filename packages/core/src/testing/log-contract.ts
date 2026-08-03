/**
 * The behaviour every campaign log must have, whatever it stores events in.
 *
 * Run against the in-memory log here, and against the SQLite log in the desktop
 * application. Two implementations that pass the same checks are
 * interchangeable, which is the whole point of core describing the interface
 * rather than owning the storage.
 *
 * This mirrors the toy module: a second implementation exists so that the first
 * one cannot quietly become the definition.
 *
 * Imported only by tests. Requires vitest, which every package already has.
 */

import { describe, expect, it } from 'vitest';

import type { EventLog } from '../log.js';

export interface EventLogUnderTest {
  /** A fresh, empty log for one campaign. */
  readonly create: () => EventLog;
  /** Release anything the log holds open. Optional. */
  readonly dispose?: (log: EventLog) => void;
}

/**
 * @param name How this implementation should appear in test output.
 */
export function describeEventLogContract(name: string, subject: EventLogUnderTest): void {
  describe(`${name} behaves like a campaign log`, () => {
    function withLog(assertions: (log: EventLog) => void): void {
      const log = subject.create();
      try {
        assertions(log);
      } finally {
        subject.dispose?.(log);
      }
    }

    const anEntry = {
      type: 'core.entry.created',
      schemaVersion: 1,
      payload: { text: 'The airlock did not open.' },
    } as const;

    const aCoinFlip = {
      type: 'sys.toy-coinflip.coin.flipped',
      schemaVersion: 1,
      systemId: 'toy-coinflip',
      payload: { result: 'heads' },
    } as const;

    it('starts empty', () => {
      withLog((log) => {
        const count = log.count();
        const read = log.read();
        expect(count).toEqual({ ok: true, value: 0 });
        expect(read.ok && read.value).toEqual([]);
      });
    });

    it('gives the first event position 1, and counts upwards from there', () => {
      withLog((log) => {
        const first = log.append(anEntry);
        const second = log.append(anEntry);

        expect(first.ok && first.value.seq).toBe(1);
        expect(second.ok && second.value.seq).toBe(2);
      });
    });

    it('stamps each event with an identifier, a time, and the campaign', () => {
      withLog((log) => {
        const appended = log.append(anEntry);
        if (!appended.ok) throw new Error('append failed');

        expect(appended.value.id).toBeTruthy();
        expect(appended.value.at).toBeTruthy();
        expect(appended.value.campaignId).toBe(log.campaignId);
      });
    });

    it('gives every event a different identifier', () => {
      withLog((log) => {
        const ids = [log.append(anEntry), log.append(anEntry), log.append(anEntry)]
          .map((result) => (result.ok ? result.value.id : ''))
          .filter(Boolean);

        expect(new Set(ids).size).toBe(3);
      });
    });

    it('keeps what the caller recorded, unchanged', () => {
      withLog((log) => {
        const appended = log.append(anEntry);
        if (!appended.ok) throw new Error('append failed');

        expect(appended.value.type).toBe('core.entry.created');
        expect(appended.value.schemaVersion).toBe(1);
        expect(appended.value.payload).toEqual({ text: 'The airlock did not open.' });
      });
    });

    it('keeps the owning module on a module event', () => {
      withLog((log) => {
        const appended = log.append(aCoinFlip);
        if (!appended.ok) throw new Error('append failed');

        expect(appended.value.systemId).toBe('toy-coinflip');
        expect(appended.value.type).toBe('sys.toy-coinflip.coin.flipped');
      });
    });

    it('records what caused an event and what it supersedes', () => {
      withLog((log) => {
        const cause = log.append(anEntry);
        if (!cause.ok) throw new Error('append failed');

        const effect = log.append({
          ...anEntry,
          causationId: cause.value.id,
          revises: cause.value.id,
        });
        if (!effect.ok) throw new Error('append failed');

        expect(effect.value.causationId).toBe(cause.value.id);
        expect(effect.value.revises).toBe(cause.value.id);
      });
    });

    it('leaves cause and correction off an event that has neither', () => {
      withLog((log) => {
        const appended = log.append(anEntry);
        if (!appended.ok) throw new Error('append failed');

        expect(appended.value.causationId).toBeUndefined();
        expect(appended.value.revises).toBeUndefined();
      });
    });

    it('reads events back in the order they happened', () => {
      withLog((log) => {
        log.append({ ...anEntry, payload: { text: 'first' } });
        log.append(aCoinFlip);
        log.append({ ...anEntry, payload: { text: 'third' } });

        const read = log.read();
        if (!read.ok) throw new Error('read failed');

        expect(read.value.map((event) => event.seq)).toEqual([1, 2, 3]);
        expect(read.value.map((event) => event.type)).toEqual([
          'core.entry.created',
          'sys.toy-coinflip.coin.flipped',
          'core.entry.created',
        ]);
      });
    });

    it('reads only the part of the log asked for', () => {
      withLog((log) => {
        for (let n = 0; n < 5; n += 1) log.append(anEntry);

        const tail = log.read({ from: 3 });
        const middle = log.read({ from: 2, to: 4 });

        expect(tail.ok && tail.value.map((event) => event.seq)).toEqual([3, 4, 5]);
        expect(middle.ok && middle.value.map((event) => event.seq)).toEqual([2, 3, 4]);
      });
    });

    it('treats a range beyond the end as nothing to read, not a failure', () => {
      withLog((log) => {
        log.append(anEntry);

        const read = log.read({ from: 50 });

        expect(read.ok).toBe(true);
        expect(read.ok && read.value).toEqual([]);
      });
    });

    it('counts what it holds', () => {
      withLog((log) => {
        log.append(anEntry);
        log.append(aCoinFlip);

        expect(log.count()).toEqual({ ok: true, value: 2 });
      });
    });

    it('carries on numbering after events have been read', () => {
      withLog((log) => {
        log.append(anEntry);
        log.read();
        const next = log.append(anEntry);

        expect(next.ok && next.value.seq).toBe(2);
      });
    });
  });
}
