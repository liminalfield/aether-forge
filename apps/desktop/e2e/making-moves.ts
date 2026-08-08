import { expect, type Page } from '@playwright/test';

/**
 * Making a move the way a person does, from the palette.
 *
 * There used to be a form panel at the foot of the writing, and every spec
 * that needed a card reached into it. The form is gone, so this is the one
 * place that knows how a move is made, and a spec that only wants a card on
 * screen says so in one line.
 */

/** Opens the moves palette with its key, from a place that is not a field. */
export async function openTheMovePalette(page: Page): Promise<void> {
  await page.getByTestId('version').click();
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('move-palette')).toBeVisible();
}

/** Narrows the palette to one move and highlights it. */
export async function chooseTheMove(page: Page, name: string): Promise<void> {
  await page.getByTestId('palette-search').fill(name);
  await expect(page.getByTestId('move-result').first()).toContainText(name, { ignoreCase: true });
  await page.getByTestId('move-result').first().click();
}

export interface HowToMove {
  /** Numbers to put in the move's own inputs, by input id. */
  readonly inputs?: Readonly<Record<string, string>>;
  /** Dice already thrown, as a person would type them. Absent means roll. */
  readonly thrown?: string;
}

/** Opens the palette, finds the move, fills it in, and does it. */
export async function makeAMove(page: Page, name: string, how: HowToMove = {}): Promise<void> {
  await openTheMovePalette(page);
  await chooseTheMove(page, name);

  for (const [id, value] of Object.entries(how.inputs ?? {})) {
    await page.getByTestId(`input-${id}`).fill(value);
  }
  if (how.thrown !== undefined) {
    await page.getByTestId('thrown').fill(how.thrown);
  }

  await page.getByTestId('roll-it').click();
  await expect(page.getByTestId('move-palette')).toHaveCount(0);
}
