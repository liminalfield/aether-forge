import { Label, slot, tokens } from '@aether-forge/ui';

import type { PreferencesView } from '../shared/ipc';

/**
 * What a person can change about how the application behaves for them.
 *
 * A quiet row at the foot of the writing, not a settings screen. There are
 * two things to choose and neither of them is worth a page of its own; a
 * screen would also put them somewhere a person has to go looking, when the
 * whole point of both is that they change what is in front of you.
 *
 * Neither is stored with a campaign. How much movement somebody wants, and
 * which palette they read best in, belong to the person and their machine.
 */

const FIELD = {
  background: slot('ground', 'raised'),
  color: slot('ink', 'primary'),
  border: `${tokens.border.hair} solid ${slot('ink', 'hairline')}`,
  borderRadius: tokens.radius.sm,
  padding: `${tokens.space[4]} ${tokens.space[8]}`,
  fontFamily: 'var(--font-numeric)',
  fontSize: tokens.type.small,
} as const;

/** The three answers, in words rather than in the values they are stored as. */
const MOTION_SAID: readonly { readonly value: string; readonly said: string }[] = [
  { value: 'follow-the-system', said: 'As my system asks' },
  { value: 'on', said: 'Moving' },
  { value: 'off', said: 'Still' },
];

export interface PreferencesRowProps {
  readonly preferences: PreferencesView | null;
  readonly busy: boolean;
  readonly onChooseTheme: (theme: string) => void;
  readonly onChooseMotion: (motion: string) => void;
}

export function PreferencesRow({
  preferences,
  busy,
  onChooseTheme,
  onChooseMotion,
}: PreferencesRowProps): React.JSX.Element | null {
  if (preferences === null) return null;

  return (
    <section
      data-testid="preferences"
      aria-label="Preferences"
      style={{ display: 'flex', gap: tokens.space[16], alignItems: 'center', flexWrap: 'wrap' }}
    >
      <span style={{ display: 'flex', gap: tokens.space[8], alignItems: 'center' }}>
        <Label as="label" htmlFor="theme">
          Theme
        </Label>
        <select
          id="theme"
          data-testid="choose-theme"
          value={preferences.theme}
          disabled={busy}
          onChange={(event) => onChooseTheme(event.target.value)}
          style={FIELD}
        >
          {preferences.themes.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </span>

      <span style={{ display: 'flex', gap: tokens.space[8], alignItems: 'center' }}>
        <Label as="label" htmlFor="motion">
          Movement
        </Label>
        <select
          id="motion"
          data-testid="choose-motion"
          value={preferences.motion}
          disabled={busy}
          onChange={(event) => onChooseMotion(event.target.value)}
          style={FIELD}
        >
          {MOTION_SAID.map((option) => (
            <option key={option.value} value={option.value}>
              {option.said}
            </option>
          ))}
        </select>
      </span>
    </section>
  );
}
