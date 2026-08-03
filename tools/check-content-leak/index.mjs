#!/usr/bin/env node
/**
 * Content-leak guard.
 *
 * User-imported and licensed game content must never enter the repository
 * (00-PROJECT-BRIEF.md). Release artifacts have to stay freely redistributable,
 * and a leak is not something a later commit can undo -- git history keeps it.
 *
 * Checks files git actually knows about: staged files when run as a pre-commit
 * hook, otherwise everything tracked.
 *
 * Usage:
 *   node tools/check-content-leak/index.mjs            # all tracked files
 *   node tools/check-content-leak/index.mjs --staged   # staged files only
 *
 * Exit codes: 0 clean, 1 leak found, 2 the check itself failed.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const config = JSON.parse(readFileSync(join(here, 'patterns.json'), 'utf8'));

/** Convert a gitignore-ish glob to an anchored RegExp. */
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        // '**/' matches zero or more path segments; bare '**' matches anything.
        if (glob[i + 2] === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else {
      out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`);
}

const forbidden = config.forbiddenPaths.map((glob) => ({ glob, re: globToRegExp(glob) }));
const allowed = (config.allow ?? []).map(globToRegExp);
const forbiddenExtensions = config.forbiddenExtensions ?? [];

function gitFiles(stagedOnly) {
  const args = stagedOnly
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['ls-files'];
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (cause) {
    console.error('[check-content-leak] could not list files from git.');
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exit(2);
  }
}

const stagedOnly = process.argv.includes('--staged');
const files = gitFiles(stagedOnly);

const hits = [];
for (const file of files) {
  if (allowed.some((re) => re.test(file))) continue;

  const pattern = forbidden.find(({ re }) => re.test(file));
  if (pattern) {
    hits.push({ file, reason: `matches forbidden path pattern "${pattern.glob}"` });
    continue;
  }

  const extension = forbiddenExtensions.find((ext) => file.toLowerCase().endsWith(ext));
  if (extension) {
    hits.push({ file, reason: `has forbidden extension "${extension}"` });
  }
}

if (hits.length === 0) {
  console.log(
    `[check-content-leak] ok: ${files.length} ${stagedOnly ? 'staged' : 'tracked'} files, no imported content.`,
  );
  process.exit(0);
}

console.error('[check-content-leak] content that must not be committed:\n');
for (const { file, reason } of hits) console.error(`  ${file}\n      ${reason}`);
console.error(
  '\nImported and licensed content belongs in the app data directory, not in git.\n' +
    'Test fixtures must use obviously-dummy data. If this file really is safe,\n' +
    'add it to "allow" in tools/check-content-leak/patterns.json and say why in the PR.',
);
process.exit(1);
