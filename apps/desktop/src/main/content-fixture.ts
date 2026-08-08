import type { ContentPackage } from '@aether-forge/core';

import { loadSystems } from './systems';

/**
 * A fixture content package, for the unit tests that need loaded systems.
 *
 * Face Danger's facts are the real ones, because the tuned proposals and the
 * suggestion flow are its behaviour; the rest is a move of each kind so the
 * joining is exercised. The real corpus is proven where it actually rides:
 * in the importer's golden tests and in the packaged e2e, which runs a move
 * this file does not carry.
 *
 * Imported only by tests. Production loads from the registry at startup.
 */
export const CONTENT_FIXTURE: ContentPackage = {
  manifest: {
    id: 'example.fixture-content',
    version: '1.0.0',
    title: 'Fixture Content',
    systems: ['ironsworn-starforged'],
    license: 'CC-BY-4.0',
    source: 'bundled',
    contentHash: 'sha256-irrelevant-here',
  },
  tables: [],
  documents: [],
  entityTemplates: [],
  raw: {
    formatVersion: 1,
    moves: [
      {
        id: 'starforged/adventure/face_danger',
        name: 'Face Danger',
        kind: 'action',
        stats: ['edge', 'heart', 'iron', 'shadow', 'wits'],
      },
      {
        id: 'starforged/quest/fulfill_your_vow',
        name: 'Fulfill Your Vow',
        kind: 'progress',
        stats: [],
      },
      { id: 'starforged/session/take_a_break', name: 'Take a Break', kind: 'none', stats: [] },
    ],
  },
};

/** Loads the systems over the fixture package. Call once per test file. */
export function loadFixtureSystems(): void {
  loadSystems([CONTENT_FIXTURE]);
}
