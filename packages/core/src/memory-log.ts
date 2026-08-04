/**
 * A campaign log held in memory.
 *
 * Its purpose is testing everything built on top of a log without needing a
 * database. It behaves identically to the real one, and proves it by passing
 * the same shared checks.
 *
 * It is not a fallback and not a cache. Nothing written here survives the
 * process.
 */

import type { EventEnvelope } from './event.js';
import type { CampaignId } from './identifiers.js';
import { isModuleEventDraft, type EventDraft, type EventLog, type LogEnvironment } from './log.js';
import { failed, ok, type Result } from './result.js';
import type { LogFailure, ReadRange } from './log.js';

export interface MemoryEventLogOptions extends LogEnvironment {
  readonly campaignId: CampaignId;
}

export function createMemoryEventLog(options: MemoryEventLogOptions): EventLog {
  const { campaignId, now, nextEventId } = options;
  const events: EventEnvelope[] = [];

  function stamp<Payload>(draft: EventDraft<Payload>, seq: number): EventEnvelope<Payload> {
    const recorded = { id: nextEventId(), campaignId, seq, at: now() };

    // Written as two branches rather than one spread and a cast, so that the
    // core and module shapes stay distinguishable to the compiler.
    return isModuleEventDraft(draft) ? { ...draft, ...recorded } : { ...draft, ...recorded };
  }

  return {
    campaignId,

    append<Payload>(draft: EventDraft<Payload>): Result<EventEnvelope<Payload>, LogFailure> {
      const stored = stamp(draft, events.length + 1);
      events.push(stored);
      return ok(stored);
    },

    restore(event: EventEnvelope): Result<void, LogFailure> {
      const expected = events.length + 1;
      if (event.seq !== expected) {
        return failed({ kind: 'out-of-order', expected, given: event.seq });
      }
      events.push(event);
      return ok(undefined);
    },

    read(range?: ReadRange): Result<readonly EventEnvelope[], LogFailure> {
      const from = range?.from ?? 1;
      const to = range?.to ?? events.length;
      return ok(events.filter((event) => event.seq >= from && event.seq <= to));
    },

    count(): Result<number, LogFailure> {
      return ok(events.length);
    },
  };
}
