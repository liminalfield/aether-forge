import { describe, expect, it } from 'vitest';

import { createMemoryEventLog } from './memory-log.js';
import { describeEventLogContract } from './testing/log-contract.js';

/**
 * Time and identity are supplied, so a test can make both predictable. The
 * shared checks assert only that they are present and unique; these assert the
 * exact values, which is only possible because they are injected.
 */
function testLog(): ReturnType<typeof createMemoryEventLog> {
  let tick = 0;
  return createMemoryEventLog({
    campaignId: 'campaign-under-test',
    now: () => {
      tick += 1;
      return `2026-08-03T09:00:0${tick}.000Z`;
    },
    nextEventId: () => `event-${tick + 1}`,
  });
}

describeEventLogContract('the in-memory log', { create: testLog });

describe('supplying time and identity rather than reaching for them', () => {
  it('uses the clock it was given', () => {
    const log = testLog();
    const appended = log.append({
      type: 'core.entry.created',
      schemaVersion: 1,
      payload: {},
    });

    expect(appended.ok && appended.value.at).toBe('2026-08-03T09:00:01.000Z');
  });

  it('makes a log fully predictable, which is what lets projections be tested', () => {
    const runOnce = (): unknown => {
      const log = testLog();
      log.append({ type: 'core.entry.created', schemaVersion: 1, payload: { text: 'a' } });
      log.append({
        type: 'sys.toy-coinflip.coin.flipped',
        schemaVersion: 1,
        systemId: 'toy-coinflip',
        payload: { result: 'tails' },
      });
      const read = log.read();
      return read.ok ? read.value : null;
    };

    expect(runOnce()).toEqual(runOnce());
  });
});
