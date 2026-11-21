import { CURRENCY, intlLocale, type Locale, type Messages } from '@cpeople/shared';
import type { Value, Values } from './home-data';

/** Fills {name}-style placeholders. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Money, dates and counts in the reader's language.
 *
 * Amounts arrive as integer minor units and are divided only here, at the last
 * moment before they are drawn (CLAUDE.md rule 4). Everything else is an ISO string
 * formatted by `Intl`, so English reads "18 November 2026" and French reads
 * "18 novembre 2026" without a date library.
 *
 * Dates and times are shown in the tenant's own timezone, not the reader's: a punch
 * at 07:15 in Rabat is 07:15 on every screen that looks at it, wherever the person
 * reading happens to be. The one exception is the greeting, which is about the
 * reader's own morning (see lib/clock.ts).
 */
export interface Formatter {
  readonly locale: Locale;
  readonly t: Messages;
  money(minor: number): string;
  moneyParts(minor: number): { unit: string; amount: string; unitFirst: boolean };
  moneyThousands(minor: number): string;
  compact(major: number): string;
  millions(major: number): string;
  count(value: number): string;
  percent(value: number): string;
  dateLong(iso: string): string;
  dateShort(iso: string): string;
  monthName(iso: string): string;
  dayMonth(iso: string): string;
  monthYear(iso: string): string;
  weekday(iso: string): string;
  dayOfMonth(iso: string): string;
  time(iso: string): string;
  dateTime(iso: string): string;
  value(value: Value): string;
  values(values: Values): Record<string, string>;
  text(template: string, values: Values): string;
  /** The same, for strings that are already formatted. */
  plain(template: string, values: Record<string, string>): string;
}

export function formatter(locale: Locale, t: Messages, timeZone: string): Formatter {
  const tag = intlLocale(locale);

  const dateTimeFormat = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag, { timeZone, ...options });

  const currency = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: CURRENCY,
    currencyDisplay: 'code',
  });
  const decimal = new Intl.NumberFormat(tag);
  const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(tag, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  });

  /** Where the currency goes: before the amount in English, after it in French. */
  const unitFirst =
    currency.formatToParts(1).findIndex((part) => part.type === 'currency') <
    currency.formatToParts(1).findIndex((part) => part.type === 'integer');

  const moneyParts = (minor: number) => {
    const parts = currency.formatToParts(minor / 100);
    const unit = parts.find((part) => part.type === 'currency')?.value ?? CURRENCY;
    const amount = parts
      .filter((part) => part.type !== 'currency')
      .map((part) => part.value)
      .join('')
      .trim();
    return { unit, amount, unitFirst };
  };

  const self: Formatter = {
    locale,
    t,

    money: (minor) => currency.format(minor / 100),
    moneyParts,
    moneyThousands(minor) {
      const thousands = decimal.format(Math.round(minor / 100 / 1000));
      // "MAD 1,285k" reads as one word in English; French keeps the space it puts
      // before every unit: "1 285 k MAD".
      return unitFirst ? `${CURRENCY} ${thousands}k` : `${thousands} k ${CURRENCY}`;
    },
    compact: (major) => compact.format(major),
    // The axis is read as a column, so every label is on the same scale: 1.5M,
    // 1.0M, 0.5M, 0. Intl's own compact notation would mix "500k" in with them.
    millions: (major) =>
      major === 0
        ? decimal.format(0)
        : `${new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(major / 1_000_000)}M`,
    count: (value) => decimal.format(value),
    percent: (value) => percent.format(value / 100),

    dateLong: (iso) =>
      dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
        at(iso),
      ),
    dateShort: (iso) => dateTimeFormat({ day: 'numeric', month: 'short' }).format(at(iso)),
    monthName: (iso) => dateTimeFormat({ month: 'long' }).format(at(iso)),
    dayMonth: (iso) => dateTimeFormat({ day: 'numeric', month: 'long' }).format(at(iso)),
    monthYear: (iso) => dateTimeFormat({ month: 'long', year: 'numeric' }).format(at(iso)),
    weekday: (iso) => dateTimeFormat({ weekday: 'short' }).format(at(iso)),
    dayOfMonth: (iso) => dateTimeFormat({ day: 'numeric' }).format(at(iso)),
    time: (iso) => dateTimeFormat({ hour: '2-digit', minute: '2-digit' }).format(at(iso)),
    dateTime: (iso) =>
      dateTimeFormat({ day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(
        at(iso),
      ),

    value(value) {
      switch (value.kind) {
        case 'count':
          return self.count(value.value);
        case 'money':
          return self.money(value.minor);
        case 'moneyThousands':
          return self.moneyThousands(value.minor);
        case 'percent':
          return self.percent(value.value);
        case 'date':
          return self.dateLong(value.iso);
        case 'dateShort':
          return self.dateShort(value.iso);
        case 'month':
          return self.monthName(value.iso);
        case 'monthYear':
          return self.monthYear(value.iso);
        case 'dayMonth':
          return self.dayMonth(value.iso);
        case 'dayOfMonth':
          return self.dayOfMonth(value.iso);
        case 'time':
          return self.time(value.iso);
        case 'dateTime':
          return self.dateTime(value.iso);
        case 'department':
          return t.home.departments.names[value.key];
        case 'text':
          return value.value;
      }
    },

    values(values) {
      return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, self.value(value)]),
      );
    },

    text: (template, values) => elide(locale, fill(template, self.values(values))),
    plain: (template, values) => elide(locale, fill(template, values)),
  };

  return self;
}

/**
 * French drops the vowel in "de" before another one: a template that reads "paie de
 * {month}" has to come out as "paie d'octobre". Only the filled-in sentence knows
 * which month landed in it, so the rule is applied here, at the end.
 *
 * Kept to "de", which always elides. The others ("le", "la", "que") would need to
 * know what follows them, and a real translation library can have that argument
 * when plurals arrive.
 */
function elide(locale: Locale, text: string): string {
  return locale === 'fr' ? text.replace(/\b([Dd])e (?=[aàâeéèêiîoôuùûy])/g, "$1'") : text;
}

/**
 * A plain date like "2026-11-18" is a day, not an instant: read as UTC midnight it
 * is still the 18th everywhere east of the Atlantic, and the tenant timezone the
 * formatter uses keeps it that way.
 */
function at(iso: string): Date {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
}
