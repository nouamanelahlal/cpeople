import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { demoToday } from '../../common/time/clock.js';
import { date } from './leave-calendar.service.js';

/**
 * Bringing in the balances people already had (M09 / HR-04).
 *
 * A company moving to CPeople in February arrives with a balance as at
 * 31 January, and everything after that is earned and taken here. Without the
 * date the number means nothing, which is why every row carries one.
 *
 * The shape is the one HR-01 set for employee data, and it is the shape because
 * of what a bad import costs: a template to fill in, a **trial run** that reads
 * the whole file and says what is wrong with it row by row without writing
 * anything, and only then a confirmation. Nobody finds out on row 300 that the
 * date format was wrong.
 *
 * Nothing is half-imported: the confirmation writes every row or none.
 */
export interface ImportRow {
  readonly line: number;
  readonly employeeNumber: string;
  readonly leaveTypeCode: string;
  readonly days: string;
  readonly balanceAt: string;
  readonly note?: string;
}

export interface ImportProblem {
  readonly line: number;
  /** A name the screen turns into a sentence, so the reason is translated. */
  readonly kind:
    | 'unknownEmployee'
    | 'unknownType'
    | 'notANumber'
    | 'notADate'
    | 'futureDate'
    | 'duplicate'
    | 'missing';
  readonly value: string;
}

export interface ImportReport {
  /** Rows that would be written. */
  readonly accepted: {
    line: number;
    employee: string;
    employeeNumber: string;
    leaveType: string;
    days: number;
    balanceAt: string;
  }[];
  readonly problems: ImportProblem[];
  readonly total: number;
  /** True only after a confirmation that actually wrote the rows. */
  readonly applied: boolean;
}

/** The columns the template has, in order. */
export const IMPORT_COLUMNS = ['employee_number', 'leave_type', 'days', 'balance_at', 'note'] as const;

@Injectable()
export class LeaveImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The file to fill in.
   *
   * With one example row, because a template whose format has to be guessed is
   * a template that produces a trial run full of problems.
   */
  async template(): Promise<string> {
    const user = await this.#mayImport();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const [employee, type] = await Promise.all([
        tx.employee.findFirst({
          where: { status: 'active' },
          select: { employeeNumber: true },
          orderBy: { employeeNumber: 'asc' },
        }),
        tx.leaveType.findFirst({ where: { tracksBalance: true }, orderBy: { sortOrder: 'asc' } }),
      ]);

      const example = [
        employee?.employeeNumber ?? 'SMG-0001',
        type?.code ?? 'ANNUAL',
        '12.5',
        lastDayOfPreviousYear(demoToday()),
        'Balance brought over from the previous system',
      ];

      return `${IMPORT_COLUMNS.join(',')}\n${example.map(csv).join(',')}\n`;
    });
  }

  /** Reads the file and says what is wrong with it. Writes nothing. */
  async trial(content: string): Promise<ImportReport> {
    const user = await this.#mayImport();

    return this.prisma.forTenant(user.tenantId, (tx) => this.#read(tx, content));
  }

  /**
   * Writes it, or writes none of it.
   *
   * A file with a single bad row is refused whole: a half-imported set of
   * opening balances is harder to find and put right than a file to fix.
   */
  async confirm(content: string): Promise<ImportReport> {
    const user = await this.#mayImport();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const report = await this.#read(tx, content);

      if (report.problems.length > 0) {
        throw new BadRequestException({
          kind: 'importHasProblems',
          values: { rows: String(report.problems.length) },
        });
      }

      if (report.accepted.length === 0) {
        throw new BadRequestException({ kind: 'importEmpty', values: {} });
      }

      const rows = await this.#rows(tx, content);

      for (const row of rows.valid) {
        // The same person, type and date is the same opening balance: importing
        // a corrected file replaces the figure rather than adding to it.
        await tx.leaveOpeningBalance.upsert({
          where: {
            tenantId_employeeId_leaveTypeId_balanceAt: {
              tenantId: user.tenantId,
              employeeId: row.employeeId,
              leaveTypeId: row.leaveTypeId,
              balanceAt: date(row.balanceAt),
            },
          },
          create: {
            tenantId: user.tenantId,
            employeeId: row.employeeId,
            leaveTypeId: row.leaveTypeId,
            days: row.days,
            balanceAt: date(row.balanceAt),
            ...(row.note ? { note: row.note } : {}),
            createdBy: user.name,
            createdRole: user.role,
          },
          update: {
            days: row.days,
            ...(row.note ? { note: row.note } : {}),
            createdBy: user.name,
            createdRole: user.role,
          },
        });
      }

      await this.audit.record(tx, user, {
        action: 'leave.openingBalancesImported',
        entity: 'leaveOpeningBalance',
        summary: `${rows.valid.length} opening balances`,
        diff: [{ field: 'rows', from: '', to: String(rows.valid.length) }],
      });

      return { ...report, applied: true };
    });
  }

  // --- the work --------------------------------------------------------

  async #read(tx: TenantClient, content: string): Promise<ImportReport> {
    const rows = await this.#rows(tx, content);

    return {
      accepted: rows.valid.map((row) => ({
        line: row.line,
        employee: row.employeeName,
        employeeNumber: row.employeeNumber,
        leaveType: row.leaveTypeCode,
        days: row.days,
        balanceAt: row.balanceAt,
      })),
      problems: rows.problems,
      total: rows.total,
      applied: false,
    };
  }

  /**
   * Every row of the file, checked against the company.
   *
   * Each row is checked on its own and all of them are checked, so that the
   * trial run can show every problem at once rather than the first one.
   */
  async #rows(
    tx: TenantClient,
    content: string,
  ): Promise<{
    valid: {
      line: number;
      employeeId: string;
      employeeName: string;
      employeeNumber: string;
      leaveTypeId: string;
      leaveTypeCode: string;
      days: number;
      balanceAt: string;
      note?: string;
    }[];
    problems: ImportProblem[];
    total: number;
  }> {
    const parsed = parseCsv(content);

    const [employees, types] = await Promise.all([
      tx.employee.findMany({
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      }),
      tx.leaveType.findMany({ select: { id: true, code: true, tracksBalance: true } }),
    ]);

    const byNumber = new Map(employees.map((row) => [row.employeeNumber.toUpperCase(), row]));
    const byCode = new Map(types.map((row) => [row.code.toUpperCase(), row]));

    const valid = [];
    const problems: ImportProblem[] = [];
    const seen = new Set<string>();
    const today = demoToday();

    for (const row of parsed) {
      const employee = byNumber.get(row.employeeNumber.trim().toUpperCase());
      const type = byCode.get(row.leaveTypeCode.trim().toUpperCase());

      if (row.employeeNumber.trim() === '' || row.leaveTypeCode.trim() === '') {
        problems.push({ line: row.line, kind: 'missing', value: '' });
        continue;
      }

      if (!employee) {
        problems.push({ line: row.line, kind: 'unknownEmployee', value: row.employeeNumber });
        continue;
      }

      if (!type || !type.tracksBalance) {
        problems.push({ line: row.line, kind: 'unknownType', value: row.leaveTypeCode });
        continue;
      }

      const days = Number.parseFloat(row.days.trim().replace(',', '.'));
      if (!Number.isFinite(days)) {
        problems.push({ line: row.line, kind: 'notANumber', value: row.days });
        continue;
      }

      const balanceAt = row.balanceAt.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(balanceAt) || Number.isNaN(Date.parse(balanceAt))) {
        problems.push({ line: row.line, kind: 'notADate', value: row.balanceAt });
        continue;
      }

      if (balanceAt > today) {
        // A balance "as at" a day that has not happened is a typo, every time.
        problems.push({ line: row.line, kind: 'futureDate', value: balanceAt });
        continue;
      }

      const key = `${employee.id}|${type.id}|${balanceAt}`;
      if (seen.has(key)) {
        problems.push({ line: row.line, kind: 'duplicate', value: row.employeeNumber });
        continue;
      }
      seen.add(key);

      valid.push({
        line: row.line,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employeeNumber: employee.employeeNumber,
        leaveTypeId: type.id,
        leaveTypeCode: type.code,
        days: Math.round(days * 2) / 2,
        balanceAt,
        ...(row.note?.trim() ? { note: row.note.trim().slice(0, 240) } : {}),
      });
    }

    return { valid, problems, total: parsed.length };
  }

  async #mayImport(): Promise<CurrentUser> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'leave.manage.all')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return user;
  }
}

/**
 * A small CSV reader, for files people make in a spreadsheet.
 *
 * Handles the two things such a file always has: a header row in whatever case
 * somebody typed it, and quoted fields with commas in them. It is deliberately
 * not a general CSV library — the template says what the columns are.
 */
export function parseCsv(content: string): ImportRow[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim() !== '');

  if (lines.length === 0) return [];

  const header = split(lines[0] as string).map((cell) => cell.trim().toLowerCase());
  const index = (name: string): number => header.indexOf(name);

  const at = {
    employeeNumber: index('employee_number'),
    leaveType: index('leave_type'),
    days: index('days'),
    balanceAt: index('balance_at'),
    note: index('note'),
  };

  // No recognisable header: treat the file as headerless, in column order.
  const positional = at.employeeNumber === -1;
  const start = positional ? 0 : 1;

  const rows: ImportRow[] = [];

  for (let line = start; line < lines.length; line += 1) {
    const cells = split(lines[line] as string);

    const pick = (name: keyof typeof at, fallback: number): string =>
      (positional ? cells[fallback] : cells[at[name === 'leaveType' ? 'leaveType' : name]]) ?? '';

    rows.push({
      // The line number a spreadsheet would show, so a person can find the row.
      line: line + 1,
      employeeNumber: pick('employeeNumber', 0),
      leaveTypeCode: pick('leaveType', 1),
      days: pick('days', 2),
      balanceAt: pick('balanceAt', 3),
      note: pick('note', 4),
    });
  }

  return rows;
}

function split(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;

  for (let at = 0; at < line.length; at += 1) {
    const character = line[at];

    if (quoted) {
      if (character === '"' && line[at + 1] === '"') {
        cell += '"';
        at += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ',' || character === ';') {
      cells.push(cell);
      cell = '';
    } else {
      cell += character;
    }
  }

  cells.push(cell);
  return cells;
}

function csv(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function lastDayOfPreviousYear(today: string): string {
  return `${Number(today.slice(0, 4)) - 1}-12-31`;
}
