/**
 * A whole number in French words (HR-01 spec 6.6).
 *
 * A contract says the salary twice — in figures and in words — because that is
 * how a contract is read and, if it ever comes to it, argued over. The rule is
 * French rather than Moroccan: the words are the same in Casablanca and in
 * Brussels, so this belongs here and not in the country pack.
 *
 * French spelling, as the Académie has it and as contracts are written:
 * "quatre-vingts" takes its s alone, "quatre-vingt-deux" does not; "cent" takes
 * its s when it is a round multiple; "mille" never does.
 */
const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
] as const;

const TENS = [
  '',
  '',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'soixante',
  'quatre-vingt',
  'quatre-vingt',
] as const;

export function frenchNumberWords(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }

  const whole = Math.floor(Math.abs(value));
  const words = below1000Million(whole);

  return value < 0 ? `moins ${words}` : words;
}

function below1000Million(value: number): string {
  if (value < 1000) {
    return below1000(value);
  }

  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1000);
    const rest = value % 1000;
    // "mille" is never counted as "un mille", and never takes an s.
    // "trois cent mille", not "trois cents mille": cent and vingt lose their s
    // when mille follows them.
    const head = thousands === 1 ? 'mille' : `${below1000(thousands, true)} mille`;

    return rest === 0 ? head : `${head} ${below1000(rest)}`;
  }

  const millions = Math.floor(value / 1_000_000);
  const rest = value % 1_000_000;
  const head = millions === 1 ? 'un million' : `${below1000(millions, true)} millions`;

  return rest === 0 ? head : `${head} ${below1000Million(rest)}`;
}

/** `followed` means a word comes after this one — mille, or millions. */
function below1000(value: number, followed = false): string {
  if (value < 100) {
    return below100(value, followed);
  }

  const hundreds = Math.floor(value / 100);
  const rest = value % 100;

  if (hundreds === 1) {
    return rest === 0 ? 'cent' : `cent ${below100(rest)}`;
  }

  // "deux cents" alone, "deux cent dix" or "deux cent mille" when something
  // follows.
  const head = `${UNITS[hundreds]} cent`;
  if (rest > 0) {
    return `${head} ${below100(rest)}`;
  }

  return followed ? head : `${head}s`;
}

function below100(value: number, followed = false): string {
  if (value < 20) {
    return UNITS[value]!;
  }

  const tens = Math.floor(value / 10);
  const unit = value % 10;
  const name = TENS[tens]!;

  // Seventy and ninety are counted from sixty and eighty: "soixante-dix",
  // "quatre-vingt-dix".
  if (tens === 7 || tens === 9) {
    const teen = UNITS[10 + unit]!;
    return unit === 1 && tens === 7 ? 'soixante et onze' : `${name}-${teen}`;
  }

  if (unit === 0) {
    // "quatre-vingts" takes its s only when nothing follows it at all.
    return tens === 8 && !followed ? `${name}s` : name;
  }

  // "vingt et un", but "quatre-vingt-un".
  return unit === 1 && tens !== 8 ? `${name} et un` : `${name}-${UNITS[unit]!}`;
}
