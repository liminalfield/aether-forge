import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_PREFERENCES, readPreferences, writePreferences } from './preferences';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'aether-forge-preferences-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('what a person has chosen', () => {
  it('follows the system until somebody says otherwise', () => {
    expect(readPreferences(dir)).toEqual({ motion: 'follow-the-system' });
    expect(DEFAULT_PREFERENCES.motion).toBe('follow-the-system');
  });

  it('survives being written and read back', () => {
    writePreferences(dir, { motion: 'off' });
    expect(readPreferences(dir)).toEqual({ motion: 'off' });
  });

  it('replaces what was there rather than accumulating', () => {
    writePreferences(dir, { motion: 'off' });
    writePreferences(dir, { motion: 'on' });
    expect(readPreferences(dir)).toEqual({ motion: 'on' });
  });
});

describe('a preferences file that cannot be trusted', () => {
  it.each([
    ['not JSON at all', 'this is not json'],
    ['JSON that is not an object', '"off"'],
    ['an object with nothing in it', '{}'],
    ['a value nobody declared', '{"motion":"sideways"}'],
    ['a value of the wrong type', '{"motion":42}'],
    ['null', 'null'],
  ])('falls back to the default for %s', (_name, contents) => {
    // A preferences file is not worth refusing to start over. Losing a setting
    // is a small annoyance; a window that will not open is not.
    writeFileSync(join(dir, 'preferences.json'), contents, 'utf-8');
    expect(readPreferences(dir)).toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back when the directory does not exist', () => {
    expect(readPreferences(join(dir, 'nowhere'))).toEqual(DEFAULT_PREFERENCES);
  });
});
