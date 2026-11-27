#!/usr/bin/env node
// Puts the end-to-end run's failures and retries in the job summary.
//
// Two things get lost otherwise. A failing test is in the HTML report, which is
// an artifact somebody has to download and open. And a **flaky** test — one that
// failed and then passed on a retry — leaves a green build with nothing said
// about it anywhere, which is how a test quietly rots until it fails for real
// on the morning of a workshop.
//
// So this reads Playwright's JSON and writes both into $GITHUB_STEP_SUMMARY.
// It never changes the build's result: the `pnpm e2e` step already failed or
// passed on Playwright's own exit status, and second-guessing that here is how
// a red suite turns green.

import { appendFileSync, readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'playwright-report/results.json';

/** Everything that ran, flattened out of Playwright's nested suites. */
function* tests(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      yield { title: spec.title, file: spec.file, line: spec.line, test };
    }
  }

  for (const child of suite.suites ?? []) yield* tests(child);
}

let report;

try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  // No report means the suite never got as far as writing one — the step that
  // runs it has already said so. Saying it twice helps nobody.
  console.log(`No end-to-end report at ${file} (${error.code ?? 'unreadable'}).`);
  process.exit(0);
}

const failed = [];
const flaky = [];

for (const suite of report.suites ?? []) {
  for (const { title, file: spec, line, test } of tests(suite)) {
    const where = `${spec}:${line} › ${title}`;
    const attempts = test.results ?? [];
    const tried = attempts.length;

    if (test.status === 'unexpected') failed.push({ where, tried });
    else if (test.status === 'flaky') {
      const first = attempts.find((run) => run.status === 'failed' || run.status === 'timedOut');
      flaky.push({ where, tried, why: firstLine(first) });
    }
  }
}

/** The first line of why an attempt failed, which is usually the whole story. */
function firstLine(run) {
  const message = run?.error?.message ?? run?.errors?.[0]?.message ?? '';

  // Playwright colours its messages; a job summary is read as plain text.
  // Built from a character code rather than written out, because an escape
  // byte typed into a source file is invisible to the next person to read it.
  const colour = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

  return message.replace(colour, '').split('\n')[0]?.trim() ?? '';
}

const lines = ['## End-to-end tests', ''];

if (failed.length === 0 && flaky.length === 0) {
  lines.push('Everything passed first time.');
} else {
  if (failed.length > 0) {
    lines.push(`### ${failed.length} failed`, '');
    for (const row of failed) lines.push(`- \`${row.where}\` — ${row.tried} attempts`);
    lines.push('');
  }

  if (flaky.length > 0) {
    lines.push(
      `### ${flaky.length} flaky`,
      '',
      'These passed, but only on a retry. A test that needs a second go is not',
      'yet a test you can trust — it is worth fixing before it fails for real.',
      '',
    );
    for (const row of flaky) {
      lines.push(`- \`${row.where}\` — passed on attempt ${row.tried}${row.why ? `: ${row.why}` : ''}`);
    }
    lines.push('');
  }
}

const summary = lines.join('\n');
console.log(summary);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}
