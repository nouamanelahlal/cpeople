import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { test, type TestInfo } from '@playwright/test';

/**
 * Skips a pixel comparison when this platform has no baseline for it.
 *
 * Baselines belong to the platform that made them — Windows and Linux do not draw
 * text identically — so a machine without one says so rather than failing or, worse,
 * passing quietly. Everything that holds on every platform is asserted without
 * pictures, and that is what gates CI.
 *
 * Asking for the baselines to be written (`--update-snapshots`) is the one case
 * that goes ahead regardless: that is how a platform gets its first set.
 */
export function skipWithoutBaseline(testInfo: TestInfo, snapshot: string): void {
  const expected = testInfo.snapshotPath(snapshot);
  const updating = testInfo.config.updateSnapshots !== 'none';

  test.skip(
    !existsSync(expected) && !updating,
    `No baseline for ${process.platform} at ${path.basename(expected)}. ` +
      `Run \`pnpm exec playwright test ${path.basename(testInfo.file)} --update-snapshots\` here.`,
  );
}
