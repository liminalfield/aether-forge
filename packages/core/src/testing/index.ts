/**
 * Shared checks that any implementation must pass.
 *
 * Imported by tests in other packages, which is why it is a published entry
 * point rather than a test file. Requires vitest, which every package has.
 */

export { describeEventLogContract, type EventLogUnderTest } from './log-contract.js';
export { describeSchemaTranslations, type EventTypeSample } from './schema-contract.js';
