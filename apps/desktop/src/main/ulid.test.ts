import { describe, expect, it } from 'vitest';

import { createUlidSource } from './ulid';

describe('sortable identifiers', () => {
  it('produces identifiers of the expected length', () => {
    expect(createUlidSource()()).toHaveLength(26);
  });

  it('never repeats', () => {
    const next = createUlidSource();
    const seen = new Set(Array.from({ length: 5_000 }, next));
    expect(seen.size).toBe(5_000);
  });

  it('sorts into the order the identifiers were created, even within one millisecond', () => {
    // A clock that never moves is the hard case: without care, identifiers made
    // in the same millisecond would sort arbitrarily against each other.
    const next = createUlidSource(() => 1_754_212_800_000);
    const made = Array.from({ length: 500 }, next);

    expect([...made].sort()).toEqual(made);
  });

  it('sorts later identifiers after earlier ones as the clock advances', () => {
    let milliseconds = 1_754_212_800_000;
    const next = createUlidSource(() => milliseconds);

    const earlier = next();
    milliseconds += 1_000;
    const later = next();

    expect(earlier < later).toBe(true);
  });

  it('uses an alphabet that cannot be misread', () => {
    const next = createUlidSource();
    const sample = Array.from({ length: 200 }, next).join('');
    expect(sample).not.toMatch(/[ILOU]/);
  });
});
