import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Launching a packaged Electron app is slower than a browser page, and the
  // first launch on a cold CI runner is slower still.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // One Electron instance at a time. These tests own a real application
  // process and a real window; running them concurrently proves nothing and
  // makes failures hard to read.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],
});
