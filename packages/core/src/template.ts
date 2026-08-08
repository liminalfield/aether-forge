/**
 * Entity templates: a module describing the entities its system is about.
 *
 * A template describes, and describing is all it does. It powers creation (a
 * new one of these starts with this) and gives surfaces their words. An
 * entity may carry fields its template does not mention, may lack fields it
 * does, and may exist with no template at all; there is no channel here
 * through which a template could refuse an entity, and adding one would be
 * the same mistake as a check that refuses a stat.
 *
 * Templates are read from the module as it stands today, like glyphs and
 * tones. Nothing in them is recorded into the log.
 *
 * See `design/entities-and-tracks.md`.
 */

import type { FieldValue } from './entity.js';

/** One field entities of a type usually carry, described well enough to draw. */
export interface FieldSpec {
  readonly id: string;
  readonly label: string;
  readonly kind: 'text' | 'number' | 'marker';
  /** What a new entity starts with, when the module has an opinion. */
  readonly initial?: FieldValue;
}

/** One track entities of a type usually start with. */
export interface TrackSpec {
  readonly id: string;
  readonly label: string;
  readonly segments: number;
  /** How full a new one begins. A condition meter full, a progress track empty. */
  readonly startsFilled: number;
}

export interface EntityTemplate {
  /** Namespaced by the owning module: "sys.<system>.<type>". */
  readonly typeId: string;
  /** The module's word for the type: "Character", "Vow". */
  readonly name: string;
  readonly fields: readonly FieldSpec[];
  readonly tracks: readonly TrackSpec[];
}

/**
 * Whether a template describes something the events can actually record.
 *
 * For a module's own tests, the way `declaresStyleFor` and
 * `describesEveryField` are. A template that names two fields the same, or a
 * track with no segments, would fail quietly at creation time; a module
 * asserts this instead and fails loudly at build time.
 */
export function describesRecordableEntities(template: EntityTemplate): boolean {
  if (template.typeId === '' || template.name === '') return false;

  const fieldIds = template.fields.map((field) => field.id);
  if (new Set(fieldIds).size !== fieldIds.length) return false;
  if (template.fields.some((field) => field.id === '' || field.label === '')) return false;

  const trackIds = template.tracks.map((track) => track.id);
  if (new Set(trackIds).size !== trackIds.length) return false;

  return template.tracks.every(
    (track) =>
      track.id !== '' &&
      track.label !== '' &&
      Number.isInteger(track.segments) &&
      track.segments >= 1 &&
      Number.isInteger(track.startsFilled),
  );
}
