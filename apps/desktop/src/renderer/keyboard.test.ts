import { describe, expect, it } from 'vitest';

import { adjustKeyIntent, cardKeyIntent, isAdjustableDraft } from './keyboard';

/**
 * The case that motivated all of this: pressing Enter with the declining chip
 * focused used to accept the offer, which inverts the one promise the card
 * makes. Each table here pins the precedence rule, not the handler wiring;
 * the packaged e2e specs press the real keys.
 */

describe('cardKeyIntent', () => {
  it('accepts on Enter only when the card itself is focused', () => {
    expect(cardKeyIntent('Enter', false, 'card')).toBe('accept');
  });

  it('never answers Enter over a focused chip, whose click it would be', () => {
    expect(cardKeyIntent('Enter', false, 'chip')).toBe('none');
  });

  it('never answers Enter from the adjust field', () => {
    expect(cardKeyIntent('Enter', false, 'field')).toBe('none');
  });

  it('does not read a modified Enter as accept', () => {
    expect(cardKeyIntent('Enter', true, 'card')).toBe('none');
  });

  it('declines on Escape wherever it lands', () => {
    expect(cardKeyIntent('Escape', false, 'card')).toBe('decline');
    expect(cardKeyIntent('Escape', false, 'chip')).toBe('decline');
    expect(cardKeyIntent('Escape', false, 'field')).toBe('decline');
  });

  it('ignores every other key', () => {
    expect(cardKeyIntent('a', false, 'card')).toBe('none');
    expect(cardKeyIntent(' ', false, 'card')).toBe('none');
    expect(cardKeyIntent('Tab', false, 'card')).toBe('none');
  });
});

describe('adjustKeyIntent', () => {
  it('uses the draft on Enter when it reads as a number', () => {
    expect(adjustKeyIntent('Enter', '-2')).toBe('use');
    expect(adjustKeyIntent('Enter', '0')).toBe('use');
  });

  it('does nothing on Enter when the draft is not a number, rather than letting it fall through', () => {
    expect(adjustKeyIntent('Enter', '')).toBe('none');
    expect(adjustKeyIntent('Enter', 'three')).toBe('none');
    expect(adjustKeyIntent('Enter', ' ')).toBe('none');
  });

  it('clears a draft on Escape instead of declining over it', () => {
    expect(adjustKeyIntent('Escape', '4')).toBe('clear');
    expect(adjustKeyIntent('Escape', 'half-typed')).toBe('clear');
  });

  it('claims nothing on Escape when there is no draft to clear', () => {
    expect(adjustKeyIntent('Escape', '')).toBe('none');
  });
});

describe('isAdjustableDraft', () => {
  it('accepts what Number can read, including negatives', () => {
    expect(isAdjustableDraft('2')).toBe(true);
    expect(isAdjustableDraft('-1')).toBe(true);
  });

  it('refuses emptiness and words', () => {
    expect(isAdjustableDraft('')).toBe(false);
    expect(isAdjustableDraft('   ')).toBe(false);
    expect(isAdjustableDraft('two')).toBe(false);
  });
});
