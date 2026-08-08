import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readContentPackage, type ContentPackage } from '@aether-forge/core';
import { contentHashOf } from '@aether-forge/importer-datasworn';

import type { InstalledPackageView, IpcResult, PackagesView } from '../shared/ipc';

/**
 * The package registry: what content this machine holds.
 *
 * Application state, deliberately not campaign state. Bundled packages ship
 * inside the install; imported ones live in the application data directory.
 * Both are ordinary JSON files read once at startup, verified twice: core's
 * reader says the shape is a package, and the recomputed content hash says
 * the box still holds what its label claims. A file failing either is
 * reported by name and excluded, because a registry that quietly drops a
 * package teaches nobody anything.
 *
 * See `design/content-packages.md`, and the argument there for why installs
 * are not events.
 */

export interface RegistryProblem {
  readonly file: string;
  readonly detail: string;
}

export interface PackageRegistry {
  readonly packages: readonly ContentPackage[];
  readonly problems: readonly RegistryProblem[];
}

async function readPackageFile(
  path: string,
): Promise<{ ok: true; box: ContentPackage } | { ok: false; detail: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (cause) {
    return { ok: false, detail: `not readable as JSON: ${String(cause)}` };
  }

  const box = readContentPackage(parsed);
  if (box === undefined) return { ok: false, detail: 'not a content package' };

  const expected = await contentHashOf(box);
  if (expected !== box.manifest.contentHash) {
    return { ok: false, detail: 'the content does not match the hash on its label' };
  }

  return { ok: true, box };
}

async function readDirectory(
  directory: string | undefined,
  into: ContentPackage[],
  problems: RegistryProblem[],
): Promise<void> {
  if (directory === undefined || !existsSync(directory)) return;

  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const path = join(directory, file);
    const read = await readPackageFile(path);
    if (!read.ok) {
      problems.push({ file, detail: read.detail });
      continue;
    }
    if (into.some((held) => held.manifest.id === read.box.manifest.id)) {
      problems.push({ file, detail: 'another installed package already carries this id' });
      continue;
    }
    into.push(read.box);
  }
}

/** Everything installed, bundled first, each id held once. */
export async function openRegistry(directories: {
  readonly bundled?: string;
  readonly imported?: string;
}): Promise<PackageRegistry> {
  const packages: ContentPackage[] = [];
  const problems: RegistryProblem[] = [];

  await readDirectory(directories.bundled, packages, problems);
  await readDirectory(directories.imported, packages, problems);

  return { packages, problems };
}

function toView(box: ContentPackage): InstalledPackageView {
  const { manifest } = box;
  const view: InstalledPackageView = {
    id: manifest.id,
    version: manifest.version,
    title: manifest.title,
    license: manifest.license,
    source: manifest.source,
    tables: box.tables.length,
    documents: box.documents.length,
  };
  return manifest.attribution === undefined ? view : { ...view, attribution: manifest.attribution };
}

export function listPackages(registry: PackageRegistry): IpcResult<PackagesView> {
  return {
    ok: true,
    value: {
      packages: registry.packages.map(toView),
      problems: registry.problems.map((problem) => `${problem.file}: ${problem.detail}`),
    },
  };
}
