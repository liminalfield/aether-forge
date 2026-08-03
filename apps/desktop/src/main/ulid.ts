import { randomFillSync } from 'node:crypto';

/**
 * Identifiers that are unique and sort into the order they were created.
 *
 * A ULID is 48 bits of millisecond timestamp followed by 80 bits of
 * randomness, written in Crockford's base32. Sorting them as text puts them in
 * creation order, which makes a log readable in a database browser and keeps
 * events in order in an export even before positions are looked at.
 *
 * Written here rather than taken from a package. It is a short, fully specified
 * format, and adding a dependency is the maintainer's decision rather than an
 * implementation detail.
 */

/** Crockford's base32: no I, L, O or U, so it cannot be misread aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;
const ALPHABET_SIZE = 32;

function encodeTime(milliseconds: number): string {
  let remaining = milliseconds;
  let encoded = '';

  for (let position = 0; position < TIME_LENGTH; position += 1) {
    const digit = remaining % ALPHABET_SIZE;
    encoded = ALPHABET[digit] + encoded;
    remaining = (remaining - digit) / ALPHABET_SIZE;
  }

  return encoded;
}

function randomCharacters(): string {
  const bytes = randomFillSync(new Uint8Array(RANDOM_LENGTH));
  let encoded = '';

  for (const byte of bytes) {
    // Each byte becomes one character. Taking a byte modulo 32 is very slightly
    // biased towards the first eight characters, which does not matter for
    // uniqueness across one campaign's events.
    encoded += ALPHABET[byte % ALPHABET_SIZE];
  }

  return encoded;
}

/**
 * Increment a base32 string by one, carrying leftwards.
 *
 * Used when two identifiers are created in the same millisecond, so that the
 * second still sorts after the first. Returns null if every character is at the
 * top of the alphabet, which cannot be carried any further.
 */
function increment(random: string): string | null {
  const characters = [...random];

  for (let position = characters.length - 1; position >= 0; position -= 1) {
    const digit = ALPHABET.indexOf(characters[position] as string);

    if (digit < ALPHABET_SIZE - 1) {
      characters[position] = ALPHABET[digit + 1] as string;
      return characters.join('');
    }

    characters[position] = ALPHABET[0] as string;
  }

  return null;
}

/**
 * Make a source of identifiers that never repeats and never goes backwards.
 *
 * Two identifiers created in the same millisecond would otherwise sort
 * arbitrarily against each other. This makes the later one sort later, which
 * matters because events are frequently written in bursts.
 *
 * @param now Supplied rather than read, so tests can control it.
 */
export function createUlidSource(now: () => number = Date.now): () => string {
  let lastMilliseconds = -1;
  let lastRandom = '';

  return function nextUlid(): string {
    const milliseconds = now();

    if (milliseconds === lastMilliseconds) {
      const incremented = increment(lastRandom);
      // Exhausting 80 bits of randomness inside one millisecond is not
      // reachable in practice. Waiting for the next millisecond is the correct
      // answer if it ever is, and it keeps the guarantee honest.
      if (incremented === null) {
        while (now() === lastMilliseconds) {
          /* wait for the clock to move */
        }
        return nextUlid();
      }
      lastRandom = incremented;
    } else {
      lastMilliseconds = milliseconds;
      lastRandom = randomCharacters();
    }

    return encodeTime(milliseconds) + lastRandom;
  };
}
