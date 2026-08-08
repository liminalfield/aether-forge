import { mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { importDatasworn } from '@aether-forge/importer-datasworn';

import type { ImportedPackagesView, IpcFailure, IpcResult } from '../shared/ipc';
import { listPackages, openRegistry, type PackageRegistry } from './packages';
import { loadSystems } from './systems';

/**
 * Importing a package file at runtime, through the same importer the build
 * uses, which is the only arrangement under which "it works bundled" and
 * "it works imported" are one claim.
 *
 * The install is atomic: the sealed package is written beside its
 * destination and renamed into place, so a half-copied package can never
 * look installed. Importing an id the machine already holds replaces it,
 * which is what updating a package is.
 *
 * The registry holder is re-read after an install rather than patched in
 * memory, so the listing always says what a restart would say, and the
 * modules are loaded again over it, so what a person can roll matches what
 * they just installed.
 */

export interface RegistryHolder {
  current: PackageRegistry;
}

export interface RegistryDirectories {
  readonly bundled?: string;
  readonly imported: string;
}

function asIpcFailure(kind: string, detail: string): IpcResult<never> {
  const failure: IpcFailure = { kind, detail };
  return { ok: false, failure };
}

export async function importPackageFromFile(
  holder: RegistryHolder,
  directories: RegistryDirectories,
  pickFile: () => Promise<string | undefined>,
): Promise<IpcResult<ImportedPackagesView>> {
  const listing = () => {
    const listed = listPackages(holder.current);
    return listed.ok ? listed.value : { packages: [], problems: [] };
  };

  const path = await pickFile();
  if (path === undefined) {
    // Not an error. Somebody opened the dialog and thought better of it.
    return { ok: true, value: { listing: listing(), notes: [] } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    return asIpcFailure('unreadable-file', `this file is not readable as JSON: ${String(cause)}`);
  }

  const imported = await importDatasworn(parsed, { source: 'imported' });
  if (!imported.ok) {
    return asIpcFailure(imported.failure.kind, imported.failure.detail);
  }

  const { manifest } = imported.value.package;

  mkdirSync(directories.imported, { recursive: true });
  const staged = join(directories.imported, `.installing-${manifest.id}.json`);
  writeFileSync(staged, JSON.stringify(imported.value.package) + '\n');
  renameSync(staged, join(directories.imported, `${manifest.id}.json`));

  holder.current = await openRegistry(directories);

  // The modules receive their content at load, so a package installed now is
  // a module that has to be loaded again. Without this its tables and its
  // credit would appear at once and its moves only on the next launch, which
  // is the kind of half-arrival nobody can explain to themselves.
  loadSystems(holder.current.packages);

  // What the conversion left out, and what the registry then refused. A file
  // whose id something already installed carries is written and then not
  // held, and an import that did nothing must not look like one that worked.
  const refused = holder.current.problems
    .filter((problem) => problem.file === `${manifest.id}.json`)
    .map((problem) => problem.detail);

  return {
    ok: true,
    value: {
      listing: listing(),
      installedId: manifest.id,
      notes: [
        ...imported.value.problems.map((problem) => `${problem.at}: ${problem.detail}`),
        ...refused.map((detail) => `${manifest.id}: ${detail}`),
      ],
    },
  };
}
