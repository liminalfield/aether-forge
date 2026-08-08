/**
 * `@aether-forge/core`: the system-neutral kernel.
 *
 * Vocabulary rule: nothing in this package may use a word that appears in a
 * rulebook. Allowed vocabulary is journal, entry, event, roll, table, entity,
 * relation, track, clock, resource, module, package, flow. If a name comes from
 * a game system, it belongs in a `system-*` module instead.
 *
 * Core also touches no platform. No filesystem, no network, no Electron. It
 * describes what a log has to be able to do; the desktop application supplies
 * the implementation.
 *
 * This file is the whole public surface. Anything not named here cannot be
 * reached from another package, so adding a module means adding it here too.
 * `index.test.ts` checks that the pieces other packages depend on are present.
 */

/** Version of the module contract this package implements. */
export const CORE_CONTRACT_VERSION = 1;

// --- identifiers ------------------------------------------------------------

export type {
  CampaignId,
  EntityId,
  EventId,
  PackageId,
  SemVer,
  SystemId,
  Versioned,
} from './identifiers.js';

// --- what a recorded event is -----------------------------------------------

export type {
  CoreEvent,
  CoreEventType,
  EventEnvelope,
  EventType,
  ModuleEvent,
  ModuleEventType,
} from './event.js';

export { isCoreEvent, isCoreEventType, isModuleEvent, isModuleEventType } from './event.js';

// --- returning failures rather than throwing --------------------------------

export type { Result } from './result.js';
export { failed, ok } from './result.js';

// --- the log ----------------------------------------------------------------

export type {
  CoreEventDraft,
  EventDraft,
  EventLog,
  LogEnvironment,
  LogFailure,
  ModuleEventDraft,
  ReadRange,
} from './log.js';

export { isModuleEventDraft } from './log.js';

export type { MemoryEventLogOptions } from './memory-log.js';
export { createMemoryEventLog } from './memory-log.js';

// --- event shapes, and reading older ones -----------------------------------

export type {
  CorrectionStyle,
  EventSchemas,
  EventTypeDefinition,
  SchemaFailure,
  Translation,
} from './schema.js';
export { createEventSchemas } from './schema.js';

export type {
  TranslatingLog,
  TranslatingLogFailure,
  TranslationFailed,
  UnversionedCoreEventDraft,
  UnversionedEventDraft,
  UnversionedModuleEventDraft,
} from './translating-log.js';

export { createTranslatingLog } from './translating-log.js';

export type { CoreFailure } from './failures.js';
export { describeFailure } from './failures.js';

// --- working out current state ----------------------------------------------

export type { Projection } from './projection.js';
export { buildFromLog, replay } from './projection.js';

export type { CampaignBundle, HistoryComparison, ImportFailure, ImportOutcome } from './bundle.js';
export {
  BUNDLE_FORMAT,
  compareHistories,
  exportCampaign,
  fingerprintOf,
  importCampaign,
} from './bundle.js';

export type { EntryCreatedV1, EntryRevisedV1, Journal, JournalEntry } from './journal.js';
export { ENTRY_CREATED, ENTRY_REVISED, journal, journalEventTypes } from './journal.js';

export type {
  Entities,
  EntityChangedV1,
  EntityCreatedV1,
  EntityFields,
  EntityRecord,
  FieldValue,
  TrackContribution,
  TrackState,
} from './entity.js';
export {
  entities,
  ENTITY_CHANGED,
  ENTITY_CREATED,
  entityEventTypes,
  nameOf,
  readEntityChanged,
  readEntityCreated,
} from './entity.js';

export type {
  ContentPackage,
  OracleFailure,
  OracleOutcome,
  OracleProvider,
  OracleTable,
  PackageManifest,
  PackageSource,
  ReferenceDoc,
} from './content.js';
export {
  readContentPackage,
  readManifest,
  readOracleTable,
  readReferenceDoc,
  rowFor,
} from './content.js';

export type { EntityTemplate, FieldSpec, TrackSpec } from './template.js';
export { describesRecordableEntities } from './template.js';

export type { TrackAdvancedV1, TrackSetV1, TrackStartedV1 } from './track.js';
export {
  readTrackAdvanced,
  readTrackSet,
  readTrackStarted,
  TRACK_ADVANCED,
  TRACK_SET,
  TRACK_STARTED,
  trackEventTypes,
} from './track.js';

export type {
  DieSource,
  DieSpec,
  DieValue,
  RecordedRoll,
  RollContext,
  RollFailure,
  RollPerformedV1,
  RollReplacement,
  RollRequest,
  Rolls,
  RollSupersession,
} from './roll.js';
export { readRoll, ROLL_PERFORMED, rollEventTypes, rolls, validateRoll } from './roll.js';

export type {
  CheckDefinition,
  CheckInput,
  CheckOption,
  CheckOutcome,
  EffectSuggestion,
  InputSource,
  OutcomeStyle,
  OutcomeTone,
  ProposalField,
} from './check.js';
export { declaresStyleFor, describesEveryField, GLYPH_FOR_TONE } from './check.js';

export type {
  CheckRun,
  AnsweredSuggestion,
  OfferedInput,
  ProposalCannotBeWritten,
  SequencedDraft,
  SuggestionAnswer,
} from './running-a-check.js';
export { answerSuggestion, sequenceCheck } from './running-a-check.js';

export type {
  OfferedProposal,
  SuggestionAcceptedV1,
  SuggestionAdjustedV1,
  SuggestionDeclinedV1,
  SuggestionFate,
  SuggestionOfferedV1,
  SuggestionOfferedV2,
  SuggestionRecord,
  Suggestions,
} from './suggestion.js';
export {
  readAdjustment,
  readOffer,
  SUGGESTION_ACCEPTED,
  SUGGESTION_ADJUSTED,
  SUGGESTION_DECLINED,
  SUGGESTION_OFFERED,
  suggestionEventTypes,
  suggestions,
} from './suggestion.js';

export type { OracleConsultedV1, OracleRow, PackageStamp } from './oracle.js';
export { ORACLE_CONSULTED, oracleEventTypes, readOracleConsultation } from './oracle.js';

export type { ModuleProjection, ProjectionContext } from './module-projection.js';
export { isVisibleToModule } from './module-projection.js';

export type { CampaignFailure, CampaignViews, OpenCampaign, ProjectionFailed } from './campaign.js';

export { openCampaign } from './campaign.js';
