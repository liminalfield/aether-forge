#!/usr/bin/env node
/**
 * License allowlist gate.
 *
 * The app ships as GPL-3.0-or-later and the libraries as MIT (00-PROJECT-BRIEF.md).
 * Anything that ends up inside a release artifact must be GPL-compatible, and no
 * dependency may arrive without someone having looked at its license.
 *
 * Uses `pnpm licenses list`, which understands the workspace and the symlinked
 * store, rather than a third-party scanner that has to guess at both.
 *
 * Exit codes: 0 clean, 1 violations found, 2 the check itself failed.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const allowlist = JSON.parse(readFileSync(join(here, 'allowlist.json'), 'utf8'));
const PRODUCTION = new Set(allowlist.production);
const DEVELOPMENT = new Set([...allowlist.production, ...allowlist.development]);
const DENY_ALWAYS = new Set(allowlist.denyAlways);

/**
 * Evaluate an SPDX expression against a set of permitted identifiers.
 * "(MIT OR CC0-1.0)" passes if either side passes; "(MIT AND CC-BY-3.0)"
 * requires both. Anything unparseable is treated as not-allowed, which is the
 * safe direction.
 */
function isAllowed(expression, permitted) {
  const expr = expression.trim();
  if (permitted.has(expr)) return true;

  const stripped = expr.replace(/^\((.*)\)$/s, '$1').trim();
  if (permitted.has(stripped)) return true;

  if (/\sOR\s/i.test(stripped)) {
    return stripped.split(/\sOR\s/i).some((part) => isAllowed(part, permitted));
  }
  if (/\sAND\s/i.test(stripped)) {
    return stripped.split(/\sAND\s/i).every((part) => isAllowed(part, permitted));
  }
  // "MIT+" / "Apache-2.0 WITH LLVM-exception" and similar suffixed forms.
  const base = stripped
    .replace(/\+$/, '')
    .replace(/\sWITH\s.*$/i, '')
    .trim();
  return permitted.has(base);
}

function listLicenses(productionOnly) {
  const args = ['licenses', 'list', '--json'];
  if (productionOnly) args.push('--prod');
  try {
    const out = execFileSync('pnpm', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
  } catch (cause) {
    console.error('[check-licenses] could not run `pnpm licenses list`.');
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exit(2);
  }
}

function collect(report) {
  /** @type {Map<string, Set<string>>} license expression -> package names */
  const byLicense = new Map();
  for (const [license, packages] of Object.entries(report)) {
    const names = byLicense.get(license) ?? new Set();
    for (const pkg of packages) names.add(`${pkg.name}@${(pkg.versions ?? []).join(',')}`);
    byLicense.set(license, names);
  }
  return byLicense;
}

const productionLicenses = collect(listLicenses(true));
const allLicenses = collect(listLicenses(false));

const violations = [];

for (const [license, packages] of productionLicenses) {
  if (!isAllowed(license, PRODUCTION)) {
    violations.push({ scope: 'production', license, packages: [...packages] });
  }
}

for (const [license, packages] of allLicenses) {
  if (DENY_ALWAYS.has(license.replace(/^\((.*)\)$/s, '$1').trim())) {
    violations.push({ scope: 'denied outright', license, packages: [...packages] });
    continue;
  }
  // Skip anything already reported against the stricter production list.
  if (productionLicenses.has(license)) continue;
  if (!isAllowed(license, DEVELOPMENT)) {
    violations.push({ scope: 'development', license, packages: [...packages] });
  }
}

if (violations.length === 0) {
  const count = [...allLicenses.values()].reduce((n, s) => n + s.size, 0);
  console.log(
    `[check-licenses] ok: ${count} packages across ${allLicenses.size} license expressions, all allowlisted.`,
  );
  process.exit(0);
}

console.error('[check-licenses] disallowed licenses found:\n');
for (const { scope, license, packages } of violations) {
  console.error(`  ${license}  (${scope})`);
  for (const name of packages.slice(0, 12)) console.error(`      ${name}`);
  if (packages.length > 12) console.error(`      … and ${packages.length - 12} more`);
  console.error('');
}
console.error(
  'Either drop the dependency, or, if the license really is acceptable,\n' +
    'add the SPDX identifier to tools/check-licenses/allowlist.json and say why in the PR.\n' +
    'Production entries ship inside the GPL-3.0-or-later app and must be GPL-compatible.',
);
process.exit(1);
