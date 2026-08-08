import { describe, expect, it } from 'vitest';

import { describesRecordableEntities, type EntityTemplate } from './template.js';

const SOUND: EntityTemplate = {
  typeId: 'sys.test-system.example',
  name: 'Example',
  fields: [
    { id: 'name', label: 'Name', kind: 'text' },
    { id: 'weight', label: 'Weight', kind: 'number', initial: 1 },
    { id: 'marked', label: 'Marked', kind: 'marker', initial: false },
  ],
  tracks: [{ id: 'progress', label: 'Progress', segments: 10, startsFilled: 0 }],
};

describe('whether a template describes recordable entities', () => {
  it('accepts a template whose parts the events can record', () => {
    expect(describesRecordableEntities(SOUND)).toBe(true);
  });

  it('accepts a template with no fields and no tracks, which describes a name and nothing else', () => {
    expect(describesRecordableEntities({ ...SOUND, fields: [], tracks: [] })).toBe(true);
  });

  it.each([
    ['an empty type id', { ...SOUND, typeId: '' }],
    ['an empty name', { ...SOUND, name: '' }],
    [
      'two fields sharing an id',
      {
        ...SOUND,
        fields: [...SOUND.fields, { id: 'name', label: 'Again', kind: 'text' as const }],
      },
    ],
    [
      'a field with no label',
      { ...SOUND, fields: [{ id: 'x', label: '', kind: 'text' as const }] },
    ],
    [
      'a track with no segments, which is not a track',
      { ...SOUND, tracks: [{ id: 't', label: 'T', segments: 0, startsFilled: 0 }] },
    ],
    [
      'a track starting at a fractional fill',
      { ...SOUND, tracks: [{ id: 't', label: 'T', segments: 4, startsFilled: 0.5 }] },
    ],
    [
      'two tracks sharing an id',
      {
        ...SOUND,
        tracks: [
          { id: 't', label: 'T', segments: 4, startsFilled: 0 },
          { id: 't', label: 'Again', segments: 6, startsFilled: 0 },
        ],
      },
    ],
  ])('refuses %s', (_name, template) => {
    expect(describesRecordableEntities(template)).toBe(false);
  });

  it('has no opinion about what a template is for', () => {
    // Describing is all a template does. Nothing here checks a field kind
    // against a value, because nothing anywhere does: an entity may disagree
    // with its template and both are recorded as they are.
    expect(
      describesRecordableEntities({
        ...SOUND,
        fields: [{ id: 'anything', label: 'Anything', kind: 'text', initial: 42 }],
      }),
    ).toBe(true);
  });
});
