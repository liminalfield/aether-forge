import type { ContentPackage } from '@aether-forge/core';
import { describe, expect, it } from 'vitest';

import { readDocument } from './documents';
import type { RegistryHolder } from './import-package';

/** Obviously-dummy content. Nothing here comes from a published book. */
const A_BOX: ContentPackage = {
  manifest: {
    id: 'example.dummy',
    version: '1.2.3',
    title: 'Dummy',
    systems: ['ironsworn-starforged'],
    license: 'CC-BY-4.0',
    source: 'bundled',
    contentHash: 'sha256-irrelevant-here',
  },
  tables: [],
  documents: [
    {
      id: 'example/doing/try_it',
      title: 'Try It',
      text: '__When you try it__, roll.\n\n**On a strong hit:** it works.',
    },
  ],
  entityTemplates: [],
};

const holder: RegistryHolder = { current: { packages: [A_BOX], problems: [] } };

describe('reading what a move says', () => {
  it('answers with the words, exactly as the package holds them', () => {
    // The whole point. These words existed all along and nothing sent them.
    const read = readDocument(holder, 'example/doing/try_it');

    if (!read.ok) throw new Error(read.failure.detail);
    expect(read.value.title).toBe('Try It');
    expect(read.value.text).toContain('__When you try it__');
    expect(read.value.text).toContain('**On a strong hit:** it works.');
  });

  it('says which package the words came from, so a reader knows which ruleset they are reading', () => {
    const read = readDocument(holder, 'example/doing/try_it');

    expect(read.ok && read.value.package).toEqual({ id: 'example.dummy', version: '1.2.3' });
  });

  it('answers with a failure for a move this machine does not hold', () => {
    // Real rather than defensive: a package can be removed, and a module can
    // declare a check whose content arrived from somewhere else.
    const read = readDocument(holder, 'example/doing/nothing_like_it');

    expect(!read.ok && read.failure.kind).toBe('unknown-document');
  });

  it('refuses a request with no id at all', () => {
    expect(readDocument(holder, '').ok).toBe(false);
    expect(readDocument(holder, undefined).ok).toBe(false);
  });
});
