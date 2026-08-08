/**
 * How long things take, and how to stop them taking any time at all.
 *
 * Three durations, and no more. Something arriving is quick. A value settling
 * into a new number is a little slower, because the eye has to follow it. One
 * ceremony is slower still, and there is only one thing in the application that
 * earns it.
 *
 * Motion is not a theme. A theme is a thing you export and hand to somebody
 * else, and how much movement a person can tolerate is theirs rather than
 * something that should arrive attached to a palette a friend sent them. So
 * this is a preference, stored with the application.
 *
 * See `design/themes-and-components.md`.
 */

/** The three durations, in the order of how much they are meant to be noticed. */
export const MOTION = {
  /** Something appearing: a chip, a stroke of a tally box. */
  enter: '90ms',
  /** A value counting to a new number, or a suggestion hardening into a fact. */
  settle: '140ms',
  /** The one moment that deserves marking rather than merely showing. */
  ceremony: '260ms',
} as const;

/** One curve throughout, so nothing in the application moves in a different way. */
export const EASING = 'cubic-bezier(.2,.8,.2,1)';

/**
 * What a person has asked for.
 *
 * `follow-the-system` is the default, and means whatever the operating system's
 * reduced-motion setting says. The other two are an explicit override in either
 * direction, because somebody who has turned reduced motion on system-wide may
 * still want this one application to move, and somebody whose system says
 * nothing may still want it still.
 */
export type MotionPreference = 'follow-the-system' | 'on' | 'off';

export const MOTION_PREFERENCES: readonly MotionPreference[] = ['follow-the-system', 'on', 'off'];

/** Whether a stored preference is one this build knows. */
export function isMotionPreference(value: unknown): value is MotionPreference {
  return MOTION_PREFERENCES.includes(value as MotionPreference);
}

/** Whether anything should move, given what a person asked for and what the system says. */
export function shouldAnimate(preference: MotionPreference, systemAsksForLess: boolean): boolean {
  if (preference === 'on') return true;
  if (preference === 'off') return false;
  return !systemAsksForLess;
}

/**
 * The durations, as the properties that carry them.
 *
 * Turning motion off zeroes the durations and removes nothing. Every property
 * is present either way, so a component asking for one always gets an answer
 * and nothing has to know whether animation is on.
 *
 * That is the shape of the promise as well as a convenience. Reduced motion
 * means less movement, not less information: a moment that deserves marking is
 * still marked, it simply arrives at once instead of sweeping.
 */
export function motionProperties(animate: boolean): Readonly<Record<string, string>> {
  const still = '0ms';

  return {
    '--duration-enter': animate ? MOTION.enter : still,
    '--duration-settle': animate ? MOTION.settle : still,
    '--duration-ceremony': animate ? MOTION.ceremony : still,
    '--easing': EASING,
    // Not a fourth duration, and deliberately not in MOTION. The three above
    // are how long a change takes; this is how slowly something already on
    // screen breathes. The ghost block is the only thing that uses it, and
    // when motion is off it does not run at all rather than running instantly,
    // because a pulse that arrives at once is a flash.
    '--pulse-ghost': animate ? 'ghost-pulse 3400ms ease-in-out infinite' : 'none',
  };
}

/** The property a duration lives in, so nothing writes the name by hand. */
export function duration(name: keyof typeof MOTION): string {
  return `var(--duration-${name})`;
}
