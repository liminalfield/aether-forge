import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { contentHashOf } from '@aether-forge/importer-datasworn';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listPackages, openRegistry } from './packages';

/** Obviously-dummy content. Nothing here comes from a published book. */
async function aSealedPackage(id: string) {
  const content = {
    tables: [
      {
        id: `${id}/things/noises`,
        name: 'Noises',
        dice: { sides: 10, count: 1 },
        rows: [{ from: 1, to: 10, text: 'A hum' }],
      },
    ],
    documents: [],
    entityTemplates: [],
  };
  return {
    manifest: {
      id,
      version: '1.0.0',
      title: `Dummy ${id}`,
      systems: ['test-system'],
      license: 'CC-BY-4.0',
      attribution: `Dummy ${id}, written for these tests.`,
      source: 'bundled' as const,
      contentHash: await contentHashOf(content),
    },
    ...content,
  };
}

let root: string;
let bundled: string;
let imported: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'aether-forge-registry-'));
  bundled = join(root, 'bundled');
  imported = join(root, 'imported');
  mkdirSync(bundled);
  mkdirSync(imported);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('opening the registry', () => {
  it('reads sealed packages from both directories, bundled first', async () => {
    writeFileSync(join(bundled, 'a.json'), JSON.stringify(await aSealedPackage('example.a')));
    writeFileSync(join(imported, 'b.json'), JSON.stringify(await aSealedPackage('example.b')));

    const registry = await openRegistry({ bundled, imported });

    expect(registry.packages.map((box) => box.manifest.id)).toEqual(['example.a', 'example.b']);
    expect(registry.problems).toEqual([]);
  });

  it('is empty, not broken, when the directories do not exist', async () => {
    const registry = await openRegistry({
      bundled: join(root, 'nowhere'),
      imported: join(root, 'also-nowhere'),
    });

    expect(registry.packages).toEqual([]);
    expect(registry.problems).toEqual([]);
  });

  it('names a file whose content does not match its label, and excludes it', async () => {
    const box = await aSealedPackage('example.tampered');
    const tampered = {
      ...box,
      tables: [{ ...box.tables[0], rows: [{ from: 1, to: 10, text: 'Something else' }] }],
    };
    writeFileSync(join(imported, 'tampered.json'), JSON.stringify(tampered));

    const registry = await openRegistry({ bundled, imported });

    expect(registry.packages).toEqual([]);
    expect(registry.problems).toEqual([
      { file: 'tampered.json', detail: 'the content does not match the hash on its label' },
    ]);
  });

  it('names a file that is not a package at all', async () => {
    writeFileSync(join(imported, 'junk.json'), JSON.stringify({ type: 'shopping-list' }));

    const registry = await openRegistry({ bundled, imported });

    expect(registry.problems).toEqual([{ file: 'junk.json', detail: 'not a content package' }]);
  });

  it('holds each id once, refusing a second copy by name', async () => {
    writeFileSync(join(bundled, 'a.json'), JSON.stringify(await aSealedPackage('example.a')));
    writeFileSync(join(imported, 'again.json'), JSON.stringify(await aSealedPackage('example.a')));

    const registry = await openRegistry({ bundled, imported });

    expect(registry.packages).toHaveLength(1);
    expect(registry.problems[0]?.file).toBe('again.json');
  });
});

describe('listing the packages', () => {
  it('describes each package with the credit its license requires', async () => {
    writeFileSync(join(bundled, 'a.json'), JSON.stringify(await aSealedPackage('example.a')));

    const listed = listPackages(await openRegistry({ bundled, imported }));

    if (!listed.ok) throw new Error('listing cannot fail');
    expect(listed.value.packages).toEqual([
      {
        id: 'example.a',
        version: '1.0.0',
        title: 'Dummy example.a',
        license: 'CC-BY-4.0',
        attribution: 'Dummy example.a, written for these tests.',
        source: 'bundled',
        tables: 1,
        documents: 0,
      },
    ]);
  });
});
