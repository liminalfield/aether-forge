import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { isMotionPreference, type MotionPreference } from '@aether-forge/ui';

/**
 * What a person has chosen about how the application behaves for them.
 *
 * Deliberately not in the campaign log. The log is what happened in a campaign,
 * and how much movement somebody wants on their own screen is not that: it
 * belongs to the person and their machine, not to the story, and it would
 * follow a campaign to another computer where it is nobody's business.
 *
 * Deliberately not in a theme either. A theme is a thing you export and hand to
 * somebody else, and a need for less movement should not arrive attached to a
 * palette a friend sent you.
 *
 * A small JSON file, read once and written whenever something changes. There is
 * no migration story yet and it does not need one: an unreadable or unknown
 * value falls back to the default rather than failing, because a preferences
 * file is not worth refusing to start over.
 */
export interface Preferences {
  readonly motion: MotionPreference;
}

export const DEFAULT_PREFERENCES: Preferences = { motion: 'follow-the-system' };

const FILE = 'preferences.json';

/**
 * Read what is stored, falling back rather than failing.
 *
 * Anything unreadable, absent, or written by a build that knew a value this one
 * does not, resolves to the default. Losing a preference is a small annoyance;
 * refusing to open the application over one is not a trade worth making.
 */
export function readPreferences(userDataDir: string): Preferences {
  let contents: string;
  try {
    contents = readFileSync(join(userDataDir, FILE), 'utf-8');
  } catch {
    // No file yet, or one that cannot be read. Either way there is nothing
    // stored, which is exactly what the default is for.
    return DEFAULT_PREFERENCES;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return DEFAULT_PREFERENCES;
  }

  if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFERENCES;

  const motion = (parsed as { motion?: unknown }).motion;
  return { motion: isMotionPreference(motion) ? motion : DEFAULT_PREFERENCES.motion };
}

/** Store a preference. Throws if it cannot, so the caller answers honestly. */
export function writePreferences(userDataDir: string, preferences: Preferences): void {
  writeFileSync(join(userDataDir, FILE), JSON.stringify(preferences, null, 2), 'utf-8');
}
