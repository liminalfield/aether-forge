import { describe, expect, it } from 'vitest';

import {
  readContentPackage,
  readManifest,
  readOracleTable,
  readReferenceDoc,
  rowFor,
  type OracleTable,
} from './content.js';

const A_MANIFEST = {
  id: 'example.dummy-tables',
  version: '0.4.1',
  title: 'Dummy Tables for Tests',
  systems: ['test-system'],
  license: 'CC-BY-4.0',
  attribution: 'Dummy content, written for these tests.',
  source: 'bundled',
  contentHash: 'sha256-0000',
};

const A_TABLE: OracleTable = {
  id: 'example.dummy-tables/what-the-silence-holds',
  name: 'What the Silence Holds',
  dice: { sides: 100, count: 1 },
  rows: [
    { from: 1, to: 40, text: 'Nothing that was not already there.' },
    { from: 41, to: 60, text: 'Someone has been here more recently than the dust suggests.' },
    { from: 61, to: 100, text: 'A sound answering yours.' },
  ],
};

const A_DOC = {
  id: 'example.dummy-tables/about',
  title: 'About These Tables',
  text: 'Obviously-dummy content, for tests.',
};

const A_PACKAGE = {
  manifest: A_MANIFEST,
  tables: [A_TABLE],
  documents: [A_DOC],
  entityTemplates: [],
};

describe('the row a number lands on', () => {
  it('finds the row whose range holds the number, at both edges', () => {
    expect(rowFor(A_TABLE, 41)?.text).toContain('more recently');
    expect(rowFor(A_TABLE, 60)?.text).toContain('more recently');
    expect(rowFor(A_TABLE, 1)?.text).toContain('already there');
  });

  it('answers nothing for a number the table skips, which is honest', () => {
    const gappy: OracleTable = { ...A_TABLE, rows: [{ from: 1, to: 10, text: 'low' }] };
    expect(rowFor(gappy, 11)).toBeUndefined();
  });

  it('answers the first row where ranges overlap, because the publisher wrote both', () => {
    const overlapping: OracleTable = {
      ...A_TABLE,
      rows: [
        { from: 1, to: 50, text: 'first' },
        { from: 40, to: 100, text: 'second' },
      ],
    };
    expect(rowFor(overlapping, 45)?.text).toBe('first');
  });
});

describe('reading a manifest', () => {
  it('reads the label back, attribution and all', () => {
    expect(readManifest(A_MANIFEST)).toEqual(A_MANIFEST);
  });

  it('reads a manifest with no attribution, which some licenses do not require', () => {
    const { attribution: _dropped, ...rest } = A_MANIFEST;
    expect(readManifest(rest)).toEqual(rest);
  });

  it.each([
    ['no id', { ...A_MANIFEST, id: '' }],
    ['no license', { ...A_MANIFEST, license: '' }],
    ['a source nobody defined', { ...A_MANIFEST, source: 'downloaded' }],
    ['systems that are not names', { ...A_MANIFEST, systems: [1, 2] }],
    ['no content hash', { ...A_MANIFEST, contentHash: '' }],
  ])('says no to %s', (_name, value) => {
    expect(readManifest(value)).toBeUndefined();
  });
});

describe('reading a table', () => {
  it('reads the worked example back', () => {
    expect(readOracleTable(A_TABLE)).toEqual(A_TABLE);
  });

  it.each([
    ['a row with a backwards range', { ...A_TABLE, rows: [{ from: 10, to: 1, text: 'x' }] }],
    ['a row with no text at all', { ...A_TABLE, rows: [{ from: 1, to: 2 }] }],
    ['dice with no sides', { ...A_TABLE, dice: { sides: 0, count: 1 } }],
    ['rows that are not a list', { ...A_TABLE, rows: 'many' }],
  ])('says no to %s', (_name, value) => {
    expect(readOracleTable(value)).toBeUndefined();
  });

  it('accepts a row whose text is empty, because content is recorded as written', () => {
    expect(readOracleTable({ ...A_TABLE, rows: [{ from: 1, to: 100, text: '' }] })).toBeDefined();
  });
});

describe('reading a whole package', () => {
  it('reads the box back, with the compartment passed through unread', () => {
    const sealed = { ...A_PACKAGE, raw: { anything: ['the', 'module', 'likes'] } };
    expect(readContentPackage(sealed)).toEqual(sealed);
  });

  it('reads a package with no compartment at all', () => {
    expect(readContentPackage(A_PACKAGE)).toEqual(A_PACKAGE);
  });

  it.each([
    ['no manifest', { ...A_PACKAGE, manifest: undefined }],
    ['a broken table among good ones', { ...A_PACKAGE, tables: [A_TABLE, { id: 'x' }] }],
    ['documents that are not documents', { ...A_PACKAGE, documents: [{ id: 'd' }] }],
  ])('says no to %s', (_name, value) => {
    expect(readContentPackage(value)).toBeUndefined();
  });
});

describe('reading a document', () => {
  it('keeps the text exactly, structure and all', () => {
    const doc = { ...A_DOC, text: '## Heading\n\nParagraph.' };
    expect(readReferenceDoc(doc)?.text).toBe('## Heading\n\nParagraph.');
  });
});
