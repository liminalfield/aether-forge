import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Palette, paletteKeyIntent, PaletteRow } from './Palette.js';

describe('where a key moves the highlight', () => {
  it('moves down and up', () => {
    expect(paletteKeyIntent('ArrowDown', 0, 5)).toEqual({ move: 1 });
    expect(paletteKeyIntent('ArrowUp', 3, 5)).toEqual({ move: 2 });
  });

  it('stops at both ends rather than wrapping', () => {
    // A list that jumps from the last row to the first loses somebody who
    // was holding the key down.
    expect(paletteKeyIntent('ArrowDown', 4, 5)).toEqual({ move: 4 });
    expect(paletteKeyIntent('ArrowUp', 0, 5)).toEqual({ move: 0 });
  });

  it('copes with an empty list', () => {
    expect(paletteKeyIntent('ArrowDown', 0, 0)).toEqual({ move: 0 });
  });

  it('chooses and closes', () => {
    expect(paletteKeyIntent('Enter', 0, 5)).toBe('choose');
    expect(paletteKeyIntent('Escape', 0, 5)).toBe('close');
  });

  it('does nothing for a key that is somebody typing', () => {
    expect(paletteKeyIntent('a', 0, 5)).toBeUndefined();
    expect(paletteKeyIntent(' ', 0, 5)).toBeUndefined();
  });
});

describe('the palette frame', () => {
  const frame = (open: boolean) =>
    renderToStaticMarkup(
      <Palette
        open={open}
        title="Make a move"
        placeholder="Part of a name"
        query=""
        onQuery={() => undefined}
        count={0}
        at={0}
        onChoose={() => undefined}
        onAt={() => undefined}
        onClose={() => undefined}
      >
        <p>rows</p>
      </Palette>,
    );

  it('draws nothing at all when it is closed', () => {
    expect(frame(false)).toBe('');
  });

  it('says what it is for, to a person and to anything reading the screen aloud', () => {
    expect(frame(true)).toContain('Make a move');
    expect(frame(true)).toContain('aria-label="Make a move"');
  });

  it('names no colour of its own, so a theme reaches it', () => {
    expect(frame(true)).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

describe('a row in a palette', () => {
  it('says which one is highlighted, rather than showing it in colour alone', () => {
    const chosen = renderToStaticMarkup(
      <PaletteRow chosen onClick={() => undefined}>
        Face Danger
      </PaletteRow>,
    );

    expect(chosen).toContain('aria-current="true"');
  });

  it('says quietly where a thing sits, when there is somewhere to say', () => {
    const markup = renderToStaticMarkup(
      <PaletteRow chosen={false} aside="derelict" onClick={() => undefined}>
        Access
      </PaletteRow>,
    );

    expect(markup).toContain('derelict');
  });
});
