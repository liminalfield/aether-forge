/**
 * `@aether-forge/importer-datasworn`: Datasworn to neutral ContentPackage.
 *
 * Datasworn is an interchange format we consume, never our runtime model. This
 * package is the *only* place in the repository allowed to reference Datasworn
 * types. One implementation serves both build-time bundling and runtime user
 * imports, so both paths produce byte-identical output.
 *
 * The `@datasworn-community/*` packages are pinned to exact versions and
 * excluded from automated dependency bumps: a version change is a content-model
 * change and must arrive in its own PR with regenerated golden files.
 */

import type { PackageId, SemVer } from '@aether-forge/core';

/** Machine-readable provenance for anything this importer emits. */
export interface ImportedPackageRef {
  readonly id: PackageId;
  readonly version: SemVer;
  /** SPDX identifier. Bundled content must be CC-BY-4.0, MIT or ORC-compatible. */
  readonly license: string;
}

/** Format version of the importer's output, independent of Datasworn's. */
export const IMPORTER_OUTPUT_VERSION = 1;
