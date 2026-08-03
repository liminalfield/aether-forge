#!/usr/bin/env node
/**
 * Vocabulary rule backstop.
 *
 * packages/core and packages/ui may only use words that appear in no rulebook
 * (00-PROJECT-BRIEF.md). If a name comes from a game system, the thing it names
 * belongs in a system module instead. Code review is the real enforcement; this
 * is the crude mechanical net that catches the obvious cases, exactly as
 * described in 02-MODULE-CONTRACT.md §10.2.
 *
 * "oracle" is deliberately NOT on the list: it is the domain-generic term the
 * project chose for tables. The list is for system-specific vocabulary.
 *
 * A line ending in `vocabulary-check-ignore` is exempt, for the occasional
 * comment that has to name the thing it is banning.
 *
 * Exit codes: 0 clean, 1 violations found, 2 the check itself failed.
 */

import { readFileSync } from 'node:fs';
import { glob } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const SCANNED = ['packages/core/src', 'packages/ui/src'];

/**
 * System-specific vocabulary. Kept curated rather than exhaustive: a word earns
 * its place here by being unambiguously rulebook vocabulary, so that a hit is
 * always a real finding and never noise someone learns to ignore.
 */
const DENYLIST = [
  // Ironsworn / Starforged
  'momentum',
  'vow',
  'ironsworn',
  'starforged',
  'datasworn',
  'sundered isles',
  'legacy track',
  'progress track',
  'asset card',
  'debility',
  'impact',
  'oracle rollable', // Datasworn's own term for a table
  // d20 systems
  'saving throw',
  'armor class',
  'hit die',
  'hit points',
  'proficiency bonus',
  'spell slot',
  'ability score',
  // Mythic and friends
  'chaos factor',
  'fate chart',
  'meaning table',
];

const IGNORE_MARKER = 'vocabulary-check-ignore';

const patterns = DENYLIST.map((term) => ({
  term,
  // Word-boundary match, case-insensitive, tolerant of the camelCase and
  // kebab/snake spellings the same term takes in code.
  re: new RegExp(`\\b${term.replace(/[\s-]+/g, '[\\s_-]*')}\\b`, 'i'),
}));

const violations = [];
let scanned = 0;

try {
  for (const directory of SCANNED) {
    for await (const entry of glob(`${directory}/**/*.{ts,tsx}`, { cwd: repoRoot })) {
      const absolute = join(repoRoot, entry);
      const lines = readFileSync(absolute, 'utf8').split('\n');
      scanned += 1;

      lines.forEach((line, index) => {
        if (line.includes(IGNORE_MARKER)) return;
        for (const { term, re } of patterns) {
          if (re.test(line)) {
            violations.push({
              file: relative(repoRoot, absolute),
              line: index + 1,
              term,
              text: line.trim(),
            });
          }
        }
      });
    }
  }
} catch (cause) {
  console.error('[check-vocabulary] scan failed.');
  console.error(cause instanceof Error ? cause.message : String(cause));
  process.exit(2);
}

if (violations.length === 0) {
  console.log(`[check-vocabulary] ok: ${scanned} files in core/ui, no rulebook vocabulary.`);
  process.exit(0);
}

console.error('[check-vocabulary] rulebook vocabulary found in system-neutral packages:\n');
for (const { file, line, term, text } of violations) {
  console.error(`  ${file}:${line}  "${term}"`);
  console.error(`      ${text}`);
}
console.error(
  '\ncore and ui may only use words that appear in no rulebook. If this concept is\n' +
    'real, it belongs in a system module (packages/system-*), or it needs a\n' +
    'system-neutral name here. See the vocabulary rule in CLAUDE.md.',
);
process.exit(1);
