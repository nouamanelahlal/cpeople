import { readFileSync } from 'node:fs';

import { importCountryPackText, type CountryPack } from '@cpeople/payroll-engine';

/**
 * The Morocco pack (M12, M24). Everything Moroccan lives in `pack.json`, as
 * data in the country-pack format; this file only loads it through the same
 * validator any imported country goes through (M27), so Morocco gets no
 * special treatment and no shortcut.
 */
export function loadMoroccoPack(): CountryPack {
  const text = readFileSync(new URL('../pack.json', import.meta.url), 'utf8');
  const result = importCountryPackText(text);
  if (!result.ok) {
    const lines = result.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
    throw new Error(`The Morocco pack is invalid:\n${lines}`);
  }
  return result.pack;
}
