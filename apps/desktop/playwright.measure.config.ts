import { defineConfig } from '@playwright/test';

/**
 * The measurement harness, kept out of the test suite on purpose.
 *
 * It seeds campaigns of up to ten thousand entries and launches the packaged
 * application four times, which takes minutes rather than seconds. It answers a
 * question rather than guarding against a regression, so it is run when the
 * question is asked and not on every change.
 */
export default defineConfig({
  testDir: './measure',
  timeout: 600_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
});
