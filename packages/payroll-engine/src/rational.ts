/**
 * Exact numbers for payroll (CLAUDE.md rule 4).
 *
 * Every intermediate value is a fraction of two bigints, so 6,000 × 4.48 % or
 * 35,000 ÷ 12 is carried exactly and nothing drifts by a cent. Rounding happens
 * in one place only: when a payslip line is written, to the currency's minor
 * units, half away from zero.
 *
 * Never build one from a JavaScript float. Rates and amounts arrive as decimal
 * strings ("0.0448", "6000.00") and are parsed here.
 */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    if (d === 0n) throw new RangeError('Division by zero.');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = g > 1n ? n / g : n;
    this.d = g > 1n ? d / g : d;
  }

  static readonly ZERO = new Rational(0n, 1n);
  static readonly ONE = new Rational(1n, 1n);

  static of(n: bigint | number, d: bigint | number = 1n): Rational {
    if (typeof n === 'number' && !Number.isInteger(n)) {
      throw new TypeError(`Rational.of needs integers; use Rational.parse("${n}") for decimals.`);
    }
    if (typeof d === 'number' && !Number.isInteger(d)) {
      throw new TypeError('Rational.of needs an integer denominator.');
    }
    return new Rational(BigInt(n), BigInt(d));
  }

  /** "12", "-0.0448", "6000.00", "1e3" is refused: decimals only. */
  static parse(text: string): Rational {
    const value = text.trim();
    const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(value);
    if (!match) throw new SyntaxError(`Not a decimal number: "${text}".`);
    const [, sign, whole, fraction = ''] = match;
    const scale = 10n ** BigInt(fraction.length);
    const n = BigInt(whole + fraction) * (sign === '-' ? -1n : 1n);
    return new Rational(n, scale);
  }

  /** Minor units (centimes) back to a value: 12345n with 2 → 123.45. */
  static fromMinor(minor: bigint, minorUnits: number): Rational {
    return new Rational(minor, 10n ** BigInt(minorUnits));
  }

  add(o: Rational): Rational {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    if (o.n === 0n) throw new RangeError('Division by zero.');
    return new Rational(this.n * o.d, this.d * o.n);
  }
  neg(): Rational {
    return new Rational(-this.n, this.d);
  }
  cmp(o: Rational): -1 | 0 | 1 {
    const left = this.n * o.d;
    const right = o.n * this.d;
    return left < right ? -1 : left > right ? 1 : 0;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isNegative(): boolean {
    return this.n < 0n;
  }

  static min(a: Rational, b: Rational): Rational {
    return a.cmp(b) <= 0 ? a : b;
  }
  static max(a: Rational, b: Rational): Rational {
    return a.cmp(b) >= 0 ? a : b;
  }

  /**
   * Rounded to `scale` decimals, half away from zero (2.345 → 2.35,
   * -2.345 → -2.35). Returns the scaled integer: 2.35 at scale 2 is 235n.
   */
  toScaled(scale: number): bigint {
    const factor = 10n ** BigInt(scale);
    const negative = this.n < 0n;
    const abs = negative ? -this.n : this.n;
    const numerator = abs * factor;
    let q = numerator / this.d;
    const r = numerator % this.d;
    if (r * 2n >= this.d) q += 1n;
    return negative ? -q : q;
  }

  /** The same value rounded to `scale` decimals, still as a Rational. */
  round(scale: number): Rational {
    return new Rational(this.toScaled(scale), 10n ** BigInt(scale));
  }

  /** Largest integer not above the value. */
  floor(): Rational {
    let q = this.n / this.d;
    if (this.n < 0n && this.n % this.d !== 0n) q -= 1n;
    return new Rational(q, 1n);
  }

  /** "1234.50" at scale 2. For display and stable hashing, never for arithmetic. */
  toFixed(scale: number): string {
    const scaled = this.toScaled(scale);
    const negative = scaled < 0n;
    const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, '0');
    const whole = scale === 0 ? digits : digits.slice(0, -scale);
    const fraction = scale === 0 ? '' : `.${digits.slice(-scale)}`;
    return `${negative ? '-' : ''}${whole}${fraction}`;
  }

  /** An exact, lossless text form for traces: "7/3" or "12". */
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a === 0n ? 1n : a;
}
