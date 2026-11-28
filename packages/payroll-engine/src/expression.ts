import { Rational } from './rational.js';

/**
 * The rules language of a country pack (spec §11, CP-PAY-002).
 *
 * A pack is data, so that a country can be imported as a file (M27): its
 * formulas are strings, parsed here and evaluated against exact numbers. The
 * language is deliberately small: arithmetic, comparisons, `and`/`or`, and a
 * fixed list of functions. No loops, no variables, no clock, no I/O, so a
 * formula can never do more than compute a number.
 *
 *   min(base('SOCIAL'), param('CNSS_CEILING')) * param('CNSS_EE_RATE')
 *   if(input('DAYS_PAID') > 0, input('MONTHLY_SALARY') / 26, 0)
 *
 * Functions that read the world:
 *   input('KEY')          a value the run supplies (salary, days, hours, dependents)
 *   param('KEY')          an effective-dated parameter of the pack (a rate, a ceiling)
 *   base('NAME')          the running total of a cumulation (GROSS, SOCIAL, TAXABLE…)
 *   wt('CODE')            the amount of a line already calculated in this run
 *   band('KEY', x)        the rate of the band that x falls in (seniority bands)
 *   bracket('KEY', x)     progressive tax: x × rate − amount to deduct, for x's bracket
 * Pure functions: min, max, abs, if(c, a, b), round(x, decimals), floor(x).
 * Booleans are 1 and 0.
 */

export type Expr =
  | { readonly kind: 'num'; readonly value: Rational; readonly text: string }
  | { readonly kind: 'str'; readonly value: string }
  | { readonly kind: 'neg'; readonly arg: Expr }
  | { readonly kind: 'not'; readonly arg: Expr }
  | { readonly kind: 'bin'; readonly op: BinaryOp; readonly left: Expr; readonly right: Expr }
  | { readonly kind: 'call'; readonly name: FunctionName; readonly args: readonly Expr[] };

export type BinaryOp = '+' | '-' | '*' | '/' | '<' | '<=' | '>' | '>=' | '==' | '!=' | 'and' | 'or';

export const READER_FUNCTIONS = ['input', 'param', 'base', 'wt', 'band', 'bracket'] as const;
export const PURE_FUNCTIONS = ['min', 'max', 'abs', 'if', 'round', 'floor'] as const;
export type FunctionName = (typeof READER_FUNCTIONS)[number] | (typeof PURE_FUNCTIONS)[number];

const ARITY: Record<FunctionName, readonly [number, number]> = {
  input: [1, 1],
  param: [1, 1],
  base: [1, 1],
  wt: [1, 1],
  band: [2, 2],
  bracket: [2, 2],
  min: [2, 8],
  max: [2, 8],
  abs: [1, 1],
  if: [3, 3],
  round: [2, 2],
  floor: [1, 1],
};

/** Which arguments must be a quoted name rather than a number. */
const STRING_ARG: Partial<Record<FunctionName, number>> = {
  input: 0,
  param: 0,
  base: 0,
  wt: 0,
  band: 0,
  bracket: 0,
};

export class ExpressionError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly position?: number,
  ) {
    super(position === undefined ? message : `${message} (at ${position} in "${source}")`);
    this.name = 'ExpressionError';
  }
}

// --- tokens ---------------------------------------------------------------

type Token =
  | { t: 'num'; v: string; p: number }
  | { t: 'str'; v: string; p: number }
  | { t: 'id'; v: string; p: number }
  | { t: 'op'; v: string; p: number }
  | { t: 'eof'; p: number };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/\d/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(source.slice(i))!;
      tokens.push({ t: 'num', v: m[0], p: i });
      i += m[0].length;
      continue;
    }
    if (c === "'") {
      const end = source.indexOf("'", i + 1);
      if (end < 0) throw new ExpressionError('Unclosed quote', source, i);
      const value = source.slice(i + 1, end);
      if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
        throw new ExpressionError(`A name may only hold letters, digits, "_", "." and "-": '${value}'`, source, i);
      }
      tokens.push({ t: 'str', v: value, p: i });
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      tokens.push({ t: 'id', v: m[0], p: i });
      i += m[0].length;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) {
      tokens.push({ t: 'op', v: two === '&&' ? 'and' : two === '||' ? 'or' : two, p: i });
      i += 2;
      continue;
    }
    if ('+-*/()<>,!'.includes(c)) {
      tokens.push({ t: 'op', v: c, p: i });
      i++;
      continue;
    }
    throw new ExpressionError(`Unexpected character "${c}"`, source, i);
  }
  tokens.push({ t: 'eof', p: source.length });
  return tokens;
}

// --- parser (precedence climbing) ------------------------------------------

const PRECEDENCE: Record<string, number> = {
  or: 1,
  and: 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
};

const cache = new Map<string, Expr>();

/** Parses once and remembers: a pack's formulas are evaluated for every employee. */
export function parseExpression(source: string): Expr {
  const hit = cache.get(source);
  if (hit) return hit;
  if (source.length > 2000) throw new ExpressionError('Formula too long (2,000 characters at most)', source.slice(0, 40));

  const tokens = tokenize(source);
  let pos = 0;
  const peek = (): Token => tokens[pos]!;
  const next = (): Token => tokens[pos++]!;
  const expectOp = (v: string): void => {
    const tok = next();
    if (tok.t !== 'op' || tok.v !== v) throw new ExpressionError(`Expected "${v}"`, source, tok.p);
  };

  const binaryOp = (tok: Token): string | undefined => {
    if (tok.t === 'op' && tok.v in PRECEDENCE) return tok.v;
    if (tok.t === 'id' && (tok.v === 'and' || tok.v === 'or')) return tok.v;
    return undefined;
  };

  const parseBinary = (minPrec: number): Expr => {
    let left = parseUnary();
    for (;;) {
      const op = binaryOp(peek());
      if (!op || PRECEDENCE[op]! < minPrec) return left;
      next();
      const right = parseBinary(PRECEDENCE[op]! + 1);
      left = { kind: 'bin', op: op as BinaryOp, left, right };
    }
  };

  const parseUnary = (): Expr => {
    const tok = peek();
    if (tok.t === 'op' && tok.v === '-') {
      next();
      return { kind: 'neg', arg: parseUnary() };
    }
    if ((tok.t === 'op' && tok.v === '!') || (tok.t === 'id' && tok.v === 'not')) {
      next();
      return { kind: 'not', arg: parseUnary() };
    }
    return parsePrimary();
  };

  const parsePrimary = (): Expr => {
    const tok = next();
    if (tok.t === 'num') return { kind: 'num', value: Rational.parse(tok.v), text: tok.v };
    if (tok.t === 'str') return { kind: 'str', value: tok.v };
    if (tok.t === 'op' && tok.v === '(') {
      const inner = parseBinary(1);
      expectOp(')');
      return inner;
    }
    if (tok.t === 'id') {
      if (tok.v === 'true') return { kind: 'num', value: Rational.ONE, text: '1' };
      if (tok.v === 'false') return { kind: 'num', value: Rational.ZERO, text: '0' };
      const name = tok.v as FunctionName;
      if (!(name in ARITY)) throw new ExpressionError(`Unknown function "${tok.v}"`, source, tok.p);
      expectOp('(');
      const args: Expr[] = [];
      if (!(peek().t === 'op' && (peek() as { v: string }).v === ')')) {
        args.push(parseBinary(1));
        while (peek().t === 'op' && (peek() as { v: string }).v === ',') {
          next();
          args.push(parseBinary(1));
        }
      }
      expectOp(')');
      const [lo, hi] = ARITY[name];
      if (args.length < lo || args.length > hi) {
        throw new ExpressionError(`${name}() takes ${lo === hi ? lo : `${lo} to ${hi}`} argument(s)`, source, tok.p);
      }
      const stringAt = STRING_ARG[name];
      args.forEach((arg, index) => {
        if (index === stringAt && arg.kind !== 'str') {
          throw new ExpressionError(`${name}() needs a quoted name as argument ${index + 1}`, source, tok.p);
        }
        if (index !== stringAt && arg.kind === 'str') {
          throw new ExpressionError(`${name}() argument ${index + 1} must be a number, not a name`, source, tok.p);
        }
      });
      return { kind: 'call', name, args };
    }
    throw new ExpressionError('Expected a number, a name or "("', source, tok.p);
  };

  const expr = parseBinary(1);
  if (peek().t !== 'eof') throw new ExpressionError('Unexpected text after the formula', source, peek().p);
  cache.set(source, expr);
  return expr;
}

// --- references (for validating a pack before it runs) ----------------------

export interface References {
  readonly inputs: Set<string>;
  readonly params: Set<string>;
  readonly bases: Set<string>;
  readonly wageTypes: Set<string>;
  /** Parameters used as band or bracket tables. */
  readonly tables: Set<string>;
}

export function referencesOf(expr: Expr, into?: References): References {
  const refs: References = into ?? {
    inputs: new Set(),
    params: new Set(),
    bases: new Set(),
    wageTypes: new Set(),
    tables: new Set(),
  };
  const walk = (e: Expr): void => {
    switch (e.kind) {
      case 'neg':
      case 'not':
        walk(e.arg);
        return;
      case 'bin':
        walk(e.left);
        walk(e.right);
        return;
      case 'call': {
        const first = e.args[0];
        const name = first?.kind === 'str' ? first.value : undefined;
        if (name !== undefined) {
          if (e.name === 'input') refs.inputs.add(name);
          if (e.name === 'param') refs.params.add(name);
          if (e.name === 'base') refs.bases.add(name);
          if (e.name === 'wt') refs.wageTypes.add(name);
          if (e.name === 'band' || e.name === 'bracket') refs.tables.add(name);
        }
        e.args.forEach(walk);
        return;
      }
      default:
        return;
    }
  };
  walk(expr);
  return refs;
}

// --- evaluation ------------------------------------------------------------

/** What a formula may read. The engine supplies it, and records every read. */
export interface Environment {
  input(key: string): Rational;
  param(key: string): Rational;
  base(name: string): Rational;
  wt(code: string): Rational;
  band(key: string, x: Rational): Rational;
  bracket(key: string, x: Rational): Rational;
}

const bool = (b: boolean): Rational => (b ? Rational.ONE : Rational.ZERO);
const truthy = (r: Rational): boolean => !r.isZero();

export function evaluate(expr: Expr, env: Environment): Rational {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'str':
      throw new ExpressionError(`A name ('${expr.value}') is not a number`, expr.value);
    case 'neg':
      return evaluate(expr.arg, env).neg();
    case 'not':
      return bool(!truthy(evaluate(expr.arg, env)));
    case 'bin': {
      if (expr.op === 'and') return bool(truthy(evaluate(expr.left, env)) && truthy(evaluate(expr.right, env)));
      if (expr.op === 'or') return bool(truthy(evaluate(expr.left, env)) || truthy(evaluate(expr.right, env)));
      const a = evaluate(expr.left, env);
      const b = evaluate(expr.right, env);
      switch (expr.op) {
        case '+':
          return a.add(b);
        case '-':
          return a.sub(b);
        case '*':
          return a.mul(b);
        case '/':
          return a.div(b);
        case '<':
          return bool(a.cmp(b) < 0);
        case '<=':
          return bool(a.cmp(b) <= 0);
        case '>':
          return bool(a.cmp(b) > 0);
        case '>=':
          return bool(a.cmp(b) >= 0);
        case '==':
          return bool(a.cmp(b) === 0);
        case '!=':
          return bool(a.cmp(b) !== 0);
      }
      throw new ExpressionError(`Unknown operator ${String(expr.op)}`, '');
    }
    case 'call': {
      const name = (i: number): string => (expr.args[i] as { value: string }).value;
      const num = (i: number): Rational => evaluate(expr.args[i]!, env);
      switch (expr.name) {
        case 'input':
          return env.input(name(0));
        case 'param':
          return env.param(name(0));
        case 'base':
          return env.base(name(0));
        case 'wt':
          return env.wt(name(0));
        case 'band':
          return env.band(name(0), num(1));
        case 'bracket':
          return env.bracket(name(0), num(1));
        case 'min':
          return expr.args.map((_, i) => num(i)).reduce((a, b) => Rational.min(a, b));
        case 'max':
          return expr.args.map((_, i) => num(i)).reduce((a, b) => Rational.max(a, b));
        case 'abs': {
          const v = num(0);
          return v.isNegative() ? v.neg() : v;
        }
        case 'if':
          // Only the branch taken is evaluated, so a guarded division is safe.
          return truthy(num(0)) ? num(1) : num(2);
        case 'round': {
          const places = num(1);
          if (places.d !== 1n || places.n < 0n || places.n > 10n) {
            throw new ExpressionError('round() takes 0 to 10 decimals', '');
          }
          return num(0).round(Number(places.n));
        }
        case 'floor':
          return num(0).floor();
      }
    }
  }
}
