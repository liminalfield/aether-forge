import { describe, expect, it } from 'vitest';

import { IMPORTER_OUTPUT_VERSION, type ImportedPackageRef } from './index.js';

describe('@aether-forge/importer-datasworn', () => {
  it('versions its output format', () => {
    expect(IMPORTER_OUTPUT_VERSION).toBe(1);
  });

  it('carries license provenance on every emitted package', () => {
    const ref: ImportedPackageRef = {
      id: 'datasworn.starforged',
      version: '0.0.0',
      license: 'CC-BY-4.0',
    };
    expect(ref.license).toBe('CC-BY-4.0');
  });
});
