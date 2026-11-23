import { CURRENCY, frenchNumberWords } from '@cpeople/shared';

/**
 * The contract, as a page (HR-01 spec 6.6).
 *
 * Built from the template and its clauses, with the merge fields filled in from
 * the file. Three things make it a demonstration document rather than a legal
 * one, and all three are deliberate: the watermark on every page, the tag on
 * every clause, and the note in the footer. Nobody should be able to print this
 * and mistake it for an agreement.
 *
 * The French in it is the template's, and the template is sample text for SMG to
 * replace. What this file owns is the layout and the merge.
 */
export interface MergeSource {
  readonly company: { name: string; city: string };
  readonly employee: {
    fullName: string;
    nationalId: string;
    birthDate: string;
    address: string;
    socialSecurityNumber: string;
    employeeNumber: string;
  };
  readonly position: { title: string };
  readonly department: { name: string };
  readonly site: { name: string };
  readonly contract: {
    startDate: string;
    endDate: string;
    trialEndDate: string;
    salaryMinor: number;
  };
  readonly today: string;
}

export interface Clause {
  readonly key: string;
  readonly title: string;
  readonly text: string;
  readonly mandatory: boolean;
}

/** Every field a template may name, already written the way a contract writes it. */
export function mergeFields(source: MergeSource): Record<string, string> {
  const major = source.contract.salaryMinor / 100;

  return {
    'company.name': source.company.name,
    'company.city': source.company.city,
    'employee.fullName': source.employee.fullName,
    'employee.cin': source.employee.nationalId,
    'employee.matricule': source.employee.employeeNumber,
    'employee.birthDate': frenchDate(source.employee.birthDate),
    'employee.address': source.employee.address,
    'employee.cnssNumber': source.employee.socialSecurityNumber,
    'position.title': source.position.title,
    'department.name': source.department.name,
    'site.name': source.site.name,
    'contract.startDate': frenchDate(source.contract.startDate),
    'contract.endDate': frenchDate(source.contract.endDate),
    'contract.trialEndDate': frenchDate(source.contract.trialEndDate),
    // In figures and in words, which is how a contract says an amount.
    'contract.salaryMonthly': `${frenchMoney(major)} (${frenchNumberWords(Math.floor(major))} dirhams)`,
    today: frenchDate(source.today),
  };
}

/** Which fields a template asks for and the file cannot answer. */
export function missingFields(body: string, clauses: readonly Clause[], fields: Record<string, string>): string[] {
  const asked = new Set<string>();
  const find = /\{\{\s*([\w.]+)\s*\}\}/g;

  for (const text of [body, ...clauses.map((clause) => clause.text)]) {
    for (const match of text.matchAll(find)) {
      asked.add(match[1]!);
    }
  }

  return [...asked].filter((field) => (fields[field] ?? '').trim() === '').sort();
}

/** Fills a template's merge fields, leaving an obvious gap where one is empty. */
export function fill(text: string, fields: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, field: string) => {
    const value = fields[field];
    return value === undefined || value.trim() === '' ? '……………' : value;
  });
}

/**
 * The whole document, as HTML for Gotenberg.
 *
 * Deliberately plain: a contract is a legal document, not a screen, so it is set
 * in one serif face at a readable size with generous margins. The only brand on
 * it is the company block at the top — and the watermark, which is the point.
 */
export function contractHtml(options: {
  title: string;
  body: string;
  clauses: readonly Clause[];
  fields: Record<string, string>;
  watermark: string;
  signatures: { employer: string; employee: string };
}): string {
  const paragraphs = fill(options.body, options.fields)
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line === '' ? '' : `<p>${escapeHtml(line)}</p>`))
    .join('\n');

  const articles = options.clauses
    .map(
      (clause) => `
        <section class="clause">
          <h2>${escapeHtml(clause.title)}</h2>
          <p>${escapeHtml(fill(clause.text, options.fields))}</p>
        </section>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      @page { size: A4; }
      body {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 11.5pt;
        line-height: 1.6;
        color: #16181d;
        margin: 0;
      }
      /* The watermark is painted behind every page by repeating it down the
         document: Chromium has no per-page background of its own. */
      .watermark {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
        transform: rotate(-32deg);
        font-size: 34pt;
        font-weight: 700;
        letter-spacing: 0.12em;
        color: rgba(15, 25, 55, 0.08);
        z-index: 0;
      }
      main { position: relative; z-index: 1; }
      .company { font-size: 10pt; letter-spacing: 0.08em; text-transform: uppercase; }
      h1 {
        font-size: 15pt;
        text-align: center;
        letter-spacing: 0.04em;
        margin: 28pt 0 20pt;
      }
      .clause { break-inside: avoid; margin-top: 14pt; }
      .clause h2 { font-size: 11.5pt; margin: 0 0 4pt; }
      .clause p { margin: 0; }
      p { margin: 0 0 8pt; }
      .signatures {
        display: flex;
        justify-content: space-between;
        gap: 40pt;
        margin-top: 40pt;
        break-inside: avoid;
      }
      .signatures div { flex: 1; }
      .signatures span {
        display: block;
        border-top: 1px solid #16181d;
        margin-top: 56pt;
        padding-top: 4pt;
        font-size: 10pt;
      }
    </style>
  </head>
  <body>
    <div class="watermark">${escapeHtml(options.watermark)}</div>
    <main>
      <div class="company">${escapeHtml(options.fields['company.name'] ?? '')}</div>
      <h1>${escapeHtml(options.title)}</h1>
      ${paragraphs}
      ${articles}
      <div class="signatures">
        <div><span>${escapeHtml(options.signatures.employer)}</span></div>
        <div><span>${escapeHtml(options.signatures.employee)}</span></div>
      </div>
    </main>
  </body>
</html>`;
}

/** The footer Gotenberg prints on every page, numbers included. */
export function contractFooter(note: string): string {
  return `<!doctype html>
<html>
  <head>
    <style>
      body { font-family: Georgia, serif; font-size: 8pt; color: #4e566b; margin: 0; width: 100%; }
      .row { display: flex; justify-content: space-between; padding: 0 1.6cm; }
    </style>
  </head>
  <body>
    <div class="row">
      <span>${escapeHtml(note)}</span>
      <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>
  </body>
</html>`;
}

/** The file name the spec asks for: Contrat_<TYPE>_<matricule>_<YYYYMMDD>.pdf */
export function contractFileName(typeCode: string, employeeNumber: string, day: string): string {
  return `Contrat_${typeCode}_${employeeNumber}_${day.replace(/-/g, '')}.pdf`;
}

/** "6 500,00 MAD", as French writes money. */
function frenchMoney(major: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major)} ${CURRENCY}`;
}

/** "1 décembre 2026": a date as a contract writes it. */
function frenchDate(plain: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plain)) {
    return '';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${plain}T00:00:00Z`));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
