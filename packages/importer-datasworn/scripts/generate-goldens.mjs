/**
 * Regenerates the golden files from the pinned Datasworn packages.
 *
 * The goldens are the importer's specification: fixed input (the pinned npm
 * package), checked-in expected output. Run after `pnpm build`, and only in a
 * pull request that reviews the diff as a content-model change.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { importDatasworn } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const source = require.resolve('@datasworn-community/starforged/package.json');
const version = JSON.parse(readFileSync(source, 'utf8')).version;
const ruleset = JSON.parse(readFileSync(join(dirname(source), 'json', 'starforged.json'), 'utf8'));

const imported = await importDatasworn(ruleset, { version, source: 'bundled' });
if (!imported.ok) {
  console.error('golden generation refused:', imported.failure);
  process.exit(1);
}

const out = join(here, '..', 'goldens', 'starforged.json');
writeFileSync(out, JSON.stringify(imported.value, null, 2) + '\n');
console.log(
  `wrote ${out}: ${imported.value.package.tables.length} tables, ` +
    `${imported.value.problems.length} problems, source version ${version}`,
);
