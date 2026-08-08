/**
 * Bundles content packages into the application at build time.
 *
 * Runs the same importer implementation the runtime import flow uses, over
 * the pinned Datasworn packages, and writes sealed neutral packages into
 * resources/content for electron-builder to carry.
 *
 * The license gate lives here and fails the build: release artifacts stay
 * freely redistributable, so only the licenses below may be bundled. An
 * import flow at runtime may accept more; a build may not.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const BUNDLED_LICENSES = ['CC-BY-4.0', 'MIT', 'ORC'];

/** Resolve a dependency of the importer package, through pnpm's strict layout. */
function fromImporter(specifier) {
  const importerEntry = require.resolve('@aether-forge/importer-datasworn');
  return createRequire(importerEntry).resolve(specifier);
}

const { importDatasworn } = await import('@aether-forge/importer-datasworn');
const { readContentPackage } = await import('@aether-forge/core');

const sourceManifest = fromImporter('@datasworn-community/starforged/package.json');
const version = JSON.parse(readFileSync(sourceManifest, 'utf8')).version;
const ruleset = JSON.parse(
  readFileSync(join(dirname(sourceManifest), 'json', 'starforged.json'), 'utf8'),
);

const imported = await importDatasworn(ruleset, { version, source: 'bundled' });
if (!imported.ok) {
  console.error('[bundle-content] refused:', imported.failure.detail);
  process.exit(1);
}

const { manifest } = imported.value.package;
if (!BUNDLED_LICENSES.includes(manifest.license)) {
  console.error(
    `[bundle-content] ${manifest.id} carries ${manifest.license}, which may not be bundled. ` +
      `Release artifacts bundle only: ${BUNDLED_LICENSES.join(', ')}.`,
  );
  process.exit(1);
}

// The same reader the registry will trust an imported file with. A bundle
// that cannot pass it would fail at runtime, so it fails the build instead.
if (readContentPackage(imported.value.package) === undefined) {
  console.error("[bundle-content] the emitted package does not satisfy core's reader");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'resources', 'content');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${manifest.id}.json`), JSON.stringify(imported.value.package) + '\n');

console.log(
  `[bundle-content] ${manifest.id}@${manifest.version}: ` +
    `${imported.value.package.tables.length} tables, ` +
    `${imported.value.package.documents.length} documents, ${manifest.license}. ` +
    `${imported.value.problems.length} conversion notes.`,
);
