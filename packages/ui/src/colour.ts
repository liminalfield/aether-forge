/**
 * What a theme does, measured and reported, never altered.
 *
 * Two things are worth knowing about a palette. How readable text is against
 * the surface it sits on, and how far apart the two colours that mean opposite
 * things are: `accent` is the player's own progress and `pressure` is the world
 * closing in, so a theme where those read alike is hard to follow at a glance.
 *
 * Everything here computes. Nothing here decides. A theme that would be hard to
 * read renders exactly as it was written, because drawing something other than
 * what a person asked for moves the refusal somewhere they cannot see, which is
 * worse than refusing honestly. The only value refused anywhere is one that is
 * not a colour, because it cannot be drawn at all.
 *
 * See `design/themes-and-components.md`.
 */

import { SLOTS, type SlotName, type ThemeColours } from './theme.js';

/** A colour, with its alpha. Values are 0 to 255, alpha 0 to 1. */
export interface Colour {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNCTIONAL = /^rgba?\(([^)]*)\)$/i;

function fromHex(digits: string): Colour | undefined {
  const expand = (pair: string): number => Number.parseInt(pair, 16);

  if (digits.length === 3 || digits.length === 4) {
    const parts = [...digits].map((digit) => expand(digit + digit));
    const [red, green, blue, alpha] = parts;
    if (red === undefined || green === undefined || blue === undefined) return undefined;
    return { red, green, blue, alpha: alpha === undefined ? 1 : alpha / 255 };
  }

  if (digits.length === 6 || digits.length === 8) {
    const pairs = digits.match(/../g);
    if (!pairs) return undefined;
    const [red, green, blue, alpha] = pairs.map(expand);
    if (red === undefined || green === undefined || blue === undefined) return undefined;
    return { red, green, blue, alpha: alpha === undefined ? 1 : alpha / 255 };
  }

  return undefined;
}

function fromFunctional(inside: string): Colour | undefined {
  const parts = inside
    .split(/[,/\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (parts.length !== 3 && parts.length !== 4) return undefined;

  const numbers = parts.map((part) => Number(part));
  if (numbers.some((value) => !Number.isFinite(value))) return undefined;

  const [red, green, blue, alpha] = numbers;
  if (red === undefined || green === undefined || blue === undefined) return undefined;

  return { red, green, blue, alpha: alpha === undefined ? 1 : alpha };
}

/**
 * Read a colour, or say it is not one.
 *
 * Hex in three, four, six or eight digits, and `rgb`/`rgba` in the forms people
 * actually write. Anything else is not refused on taste; it is refused because
 * there is no way to draw it.
 */
export function parseColour(value: string): Colour | undefined {
  const trimmed = value.trim();

  const hex = HEX.exec(trimmed);
  if (hex?.[1] !== undefined) return fromHex(hex[1]);

  const functional = FUNCTIONAL.exec(trimmed);
  if (functional?.[1] !== undefined) return fromFunctional(functional[1]);

  return undefined;
}

/** A partly transparent colour, as it actually appears over what is behind it. */
export function over(colour: Colour, background: Colour): Colour {
  const mix = (front: number, back: number): number =>
    front * colour.alpha + back * (1 - colour.alpha);

  return {
    red: mix(colour.red, background.red),
    green: mix(colour.green, background.green),
    blue: mix(colour.blue, background.blue),
    alpha: 1,
  };
}

function channelLuminance(value: number): number {
  const proportion = value / 255;
  return proportion <= 0.03928 ? proportion / 12.92 : Math.pow((proportion + 0.055) / 1.055, 2.4);
}

/** How much light a colour gives back, the way the accessibility guidelines define it. */
export function luminanceOf(colour: Colour): number {
  return (
    0.2126 * channelLuminance(colour.red) +
    0.7152 * channelLuminance(colour.green) +
    0.0722 * channelLuminance(colour.blue)
  );
}

/**
 * How far apart two colours are in brightness, from 1 to 21.
 *
 * A transparent foreground is measured as it appears over the background, not
 * as it was written, because that is what a person sees.
 */
export function contrastBetween(foreground: Colour, background: Colour): number {
  const front = luminanceOf(foreground.alpha < 1 ? over(foreground, background) : foreground);
  const back = luminanceOf(background);

  const lighter = Math.max(front, back);
  const darker = Math.min(front, back);

  return (lighter + 0.05) / (darker + 0.05);
}

/** Where a colour sits on the wheel, in degrees. Grey has no hue and returns undefined. */
export function hueOf(colour: Colour): number | undefined {
  const red = colour.red / 255;
  const green = colour.green / 255;
  const blue = colour.blue / 255;

  const highest = Math.max(red, green, blue);
  const lowest = Math.min(red, green, blue);
  const spread = highest - lowest;

  if (spread === 0) return undefined;

  let hue: number;
  if (highest === red) hue = ((green - blue) / spread) % 6;
  else if (highest === green) hue = (blue - red) / spread + 2;
  else hue = (red - green) / spread + 4;

  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

/** The shorter way round the wheel between two hues, so never more than 180. */
export function hueSeparation(left: Colour, right: Colour): number | undefined {
  const first = hueOf(left);
  const second = hueOf(right);
  if (first === undefined || second === undefined) return undefined;

  const apart = Math.abs(first - second) % 360;
  return apart > 180 ? 360 - apart : apart;
}

export interface InkContrast {
  readonly ink: SlotName<'ink'>;
  /** Against the surface most text sits on. */
  readonly ratio: number;
}

export interface ThemeReport {
  readonly contrast: readonly InkContrast[];
  /**
   * Degrees between accent and pressure, or undefined when one of them is grey
   * and has no hue to be apart from anything.
   */
  readonly hueSeparation: number | undefined;
  /**
   * Slots holding something that is not a colour, named by their custom
   * property. The only thing anywhere that is genuinely wrong rather than
   * merely unusual.
   */
  readonly notColours: readonly string[];
}

/**
 * Everything the application can say about a theme.
 *
 * Numbers, and no verdict. Whether 3.1 is too low is a judgement, and this is
 * not the layer that makes judgements; something showing this to a person can
 * say what it likes about the figures, and the theme still draws as written
 * either way.
 */
export function reportOn(theme: ThemeColours): ThemeReport {
  const notColours: string[] = [];

  const read = (group: keyof ThemeColours, name: string): Colour | undefined => {
    const value = (theme[group] as Record<string, string>)[name];
    const colour = value === undefined ? undefined : parseColour(value);
    if (colour === undefined) notColours.push(`--${group}-${name}`);
    return colour;
  };

  // Read every slot, so that one unreadable value is reported alongside the
  // rest rather than stopping the report at the first problem.
  const colours = new Map<string, Colour>();
  for (const group of Object.keys(SLOTS) as (keyof typeof SLOTS)[]) {
    for (const name of SLOTS[group]) {
      const colour = read(group, name);
      if (colour !== undefined) colours.set(`${group}.${name}`, colour);
    }
  }

  const base = colours.get('ground.base');
  const contrast: InkContrast[] = [];

  if (base !== undefined) {
    for (const ink of SLOTS.ink) {
      const colour = colours.get(`ink.${ink}`);
      if (colour === undefined) continue;
      contrast.push({ ink, ratio: Math.round(contrastBetween(colour, base) * 10) / 10 });
    }
  }

  const accent = colours.get('accent.accent');
  const pressure = colours.get('accent.pressure');

  return {
    contrast,
    hueSeparation:
      accent === undefined || pressure === undefined ? undefined : hueSeparation(accent, pressure),
    notColours,
  };
}
