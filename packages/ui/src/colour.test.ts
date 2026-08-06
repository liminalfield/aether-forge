import { describe, expect, it } from 'vitest';

import {
  contrastBetween,
  hueOf,
  hueSeparation,
  over,
  parseColour,
  reportOn,
  type Colour,
} from './colour.js';
import { emberDark, glacialDark, type Theme } from './theme.js';

const WHITE: Colour = { red: 255, green: 255, blue: 255, alpha: 1 };
const BLACK: Colour = { red: 0, green: 0, blue: 0, alpha: 1 };

function read(value: string): Colour {
  const colour = parseColour(value);
  if (colour === undefined) throw new Error(`${value} did not parse`);
  return colour;
}

describe('reading a colour', () => {
  it.each([
    ['#fff', { red: 255, green: 255, blue: 255, alpha: 1 }],
    ['#000', { red: 0, green: 0, blue: 0, alpha: 1 }],
    ['#7FD4F5', { red: 127, green: 212, blue: 245, alpha: 1 }],
    ['#05080E', { red: 5, green: 8, blue: 14, alpha: 1 }],
    ['rgb(1, 2, 3)', { red: 1, green: 2, blue: 3, alpha: 1 }],
    ['rgba(150,180,215,.12)', { red: 150, green: 180, blue: 215, alpha: 0.12 }],
    ['rgba(150 180 215 / 0.5)', { red: 150, green: 180, blue: 215, alpha: 0.5 }],
    ['  #7FD4F5  ', { red: 127, green: 212, blue: 245, alpha: 1 }],
  ])('reads %s', (value, expected) => {
    expect(parseColour(value)).toEqual(expected);
  });

  it('reads the alpha off an eight-digit hex', () => {
    expect(parseColour('#00000080')?.alpha).toBeCloseTo(128 / 255, 5);
  });

  it.each([
    ['empty', ''],
    ['a word', 'cornflower'],
    ['a hex of the wrong length', '#12345'],
    ['not hex digits', '#gggggg'],
    ['too few parts', 'rgb(1, 2)'],
    ['too many parts', 'rgb(1, 2, 3, 4, 5)'],
    ['parts that are not numbers', 'rgb(a, b, c)'],
    ['a function nobody defined', 'lab(50% 40 59)'],
  ])('says no to %s', (_name, value) => {
    expect(parseColour(value)).toBeUndefined();
  });
});

describe('how far apart two colours are in brightness', () => {
  it('puts black against white at the maximum', () => {
    // The two anchors the accessibility guidelines fix by definition. If these
    // are right, the curve between them is the published one.
    expect(contrastBetween(BLACK, WHITE)).toBeCloseTo(21, 5);
    expect(contrastBetween(WHITE, BLACK)).toBeCloseTo(21, 5);
  });

  it('puts a colour against itself at the minimum', () => {
    expect(contrastBetween(WHITE, WHITE)).toBeCloseTo(1, 5);
    expect(contrastBetween(read('#7FD4F5'), read('#7FD4F5'))).toBeCloseTo(1, 5);
  });

  it('measures a transparent colour as it appears, not as it was written', () => {
    // Written white, but at twelve per cent over black it is nearly black, and
    // that is what a person sees.
    const faint: Colour = { red: 255, green: 255, blue: 255, alpha: 0.12 };

    expect(contrastBetween(faint, BLACK)).toBeLessThan(2);
    expect(contrastBetween({ ...faint, alpha: 1 }, BLACK)).toBeCloseTo(21, 5);
  });
});

describe('mixing a transparent colour into what is behind it', () => {
  it('leaves an opaque colour alone', () => {
    expect(over(WHITE, BLACK)).toEqual({ red: 255, green: 255, blue: 255, alpha: 1 });
  });

  it('lands halfway at half alpha', () => {
    const half: Colour = { red: 255, green: 255, blue: 255, alpha: 0.5 };
    expect(over(half, BLACK)).toEqual({ red: 127.5, green: 127.5, blue: 127.5, alpha: 1 });
  });

  it('disappears entirely at no alpha', () => {
    const invisible: Colour = { red: 255, green: 0, blue: 0, alpha: 0 };
    expect(over(invisible, BLACK)).toEqual({ red: 0, green: 0, blue: 0, alpha: 1 });
  });
});

describe('where a colour sits on the wheel', () => {
  it.each([
    ['red', '#FF0000', 0],
    ['yellow', '#FFFF00', 60],
    ['green', '#00FF00', 120],
    ['cyan', '#00FFFF', 180],
    ['blue', '#0000FF', 240],
    ['magenta', '#FF00FF', 300],
  ])('puts %s at %i degrees', (_name, value, expected) => {
    expect(hueOf(read(value))).toBeCloseTo(expected, 5);
  });

  it('says grey has no hue at all', () => {
    expect(hueOf(WHITE)).toBeUndefined();
    expect(hueOf(BLACK)).toBeUndefined();
    expect(hueOf(read('#808080'))).toBeUndefined();
  });

  it('always takes the shorter way round', () => {
    // Red and magenta are sixty degrees apart going one way and three hundred
    // going the other. The answer people mean is sixty.
    expect(hueSeparation(read('#FF0000'), read('#FF00FF'))).toBeCloseTo(60, 5);
    expect(hueSeparation(read('#FF00FF'), read('#FF0000'))).toBeCloseTo(60, 5);
    expect(hueSeparation(read('#FF0000'), read('#00FFFF'))).toBeCloseTo(180, 5);
  });

  it('cannot say how far a grey is from anything', () => {
    expect(hueSeparation(WHITE, read('#FF0000'))).toBeUndefined();
  });
});

describe('what the application says about a theme', () => {
  it('measures every ink slot against the surface text sits on', () => {
    const report = reportOn(glacialDark);

    expect(report.contrast.map((each) => each.ink)).toEqual([
      'primary',
      'secondary',
      'muted',
      'hairline',
    ]);
    expect(report.contrast[0]?.ratio).toBeCloseTo(15.8, 1);
    expect(report.contrast[2]?.ratio).toBeCloseTo(5.8, 1);
  });

  it('says how far apart the two colours that mean opposite things are', () => {
    expect(reportOn(glacialDark).hueSeparation).toBeCloseTo(160, 0);
    expect(reportOn(emberDark).hueSeparation).toBeCloseTo(177, 0);
  });

  it('finds nothing wrong with either theme that ships', () => {
    expect(reportOn(glacialDark).notColours).toEqual([]);
    expect(reportOn(emberDark).notColours).toEqual([]);
  });
});

describe('a theme nobody would choose', () => {
  const unreadable: Theme = {
    ...glacialDark,
    name: 'Unreadable',
    ground: { ...glacialDark.ground, base: '#0E1420' },
    ink: { primary: '#101823', secondary: '#101823', muted: '#101823', hairline: '#101823' },
    accent: { accent: '#7FD4F5', pressure: '#7FD4F5' },
  };

  it('reports it honestly and changes not one value', () => {
    // The whole point. It is measured, it is described, and it renders exactly
    // as written. Drawing something else would move the refusal somewhere the
    // person cannot see.
    const report = reportOn(unreadable);

    expect(report.contrast.every((each) => each.ratio < 1.5)).toBe(true);
    expect(report.hueSeparation).toBeCloseTo(0, 5);
    expect(report.notColours).toEqual([]);
  });

  it('leaves the theme itself untouched', () => {
    const before = JSON.stringify(unreadable);
    reportOn(unreadable);
    expect(JSON.stringify(unreadable)).toBe(before);
  });
});

describe('the one thing that is refused', () => {
  it('names any slot holding something that is not a colour', () => {
    const broken = {
      ...glacialDark,
      ground: { ...glacialDark.ground, base: 'not a colour' },
      outcome: { ...glacialDark.outcome, match: 'cornflower' },
    } as Theme;

    expect(reportOn(broken).notColours).toEqual(['--ground-base', '--outcome-match']);
  });

  it('reports every one of them rather than stopping at the first', () => {
    const allBroken = {
      name: 'Nothing is a colour',
      ground: { void: 'a', sunken: 'b', base: 'c', raised: 'd', overlay: 'e' },
      ink: { primary: 'f', secondary: 'g', muted: 'h', hairline: 'i' },
      accent: { accent: 'j', pressure: 'k' },
      outcome: { strong: 'l', weak: 'm', miss: 'n', match: 'o' },
    } as Theme;

    expect(reportOn(allBroken).notColours).toHaveLength(15);
  });

  it('still reports what it could read when one slot is unreadable', () => {
    const broken = {
      ...glacialDark,
      outcome: { ...glacialDark.outcome, match: 'cornflower' },
    } as Theme;

    const report = reportOn(broken);
    expect(report.notColours).toEqual(['--outcome-match']);
    expect(report.contrast).toHaveLength(4);
    expect(report.hueSeparation).toBeCloseTo(160, 0);
  });

  it('cannot measure contrast when the ground itself is unreadable', () => {
    const broken = {
      ...glacialDark,
      ground: { ...glacialDark.ground, base: 'cornflower' },
    } as Theme;

    const report = reportOn(broken);
    expect(report.contrast).toEqual([]);
    expect(report.notColours).toEqual(['--ground-base']);
  });
});
