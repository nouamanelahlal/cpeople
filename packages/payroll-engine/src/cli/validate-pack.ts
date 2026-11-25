#!/usr/bin/env node
/**
 * Validates country-pack files before they are imported (M27).
 *
 *   pnpm pack:validate packages/country-packs/ma/pack.json
 *
 * Exit code 0 when every file is valid, 1 otherwise. Warnings do not fail.
 */
import { readFileSync } from 'node:fs';

import { importCountryPackText } from '../validate.js';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: cpeople-pack-validate <pack.json> [more.json …]');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const result = importCountryPackText(readFileSync(file, 'utf8'));
  for (const w of result.warnings) console.warn(`${file}: warning: ${w.path || '(root)'}: ${w.message}`);
  if (result.ok) {
    const m = result.pack.manifest;
    const rows = result.pack.payroll?.parameters ?? [];
    const unverified = rows.filter((r) => r.status !== 'verified').length;
    console.info(`${file}: valid — ${m.country} ${m.version} (${m.status}), ${rows.length} parameter rows, ${unverified} unverified.`);
  } else {
    failed = true;
    for (const e of result.errors) console.error(`${file}: error: ${e.path || '(root)'}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
