import { ApiPropertyOptional } from '@nestjs/swagger';

export const EMPLOYEE_SORTS = ['name', 'hireDate', 'contractEnd'] as const;
export type EmployeeSort = (typeof EMPLOYEE_SORTS)[number];

export const EMPLOYEE_VIEWS = ['documents-expiring', 'contracts-ending'] as const;
export type EmployeeView = (typeof EMPLOYEE_VIEWS)[number];

export const EMPLOYEE_STATUSES = ['onboarding', 'active', 'left'] as const;
export type EmployeeStatusFilter = (typeof EMPLOYEE_STATUSES)[number];

/** The largest page the list hands out, however large a page is asked for. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

/**
 * What the employee list was asked for (HR-01 spec 6.2), as it arrives.
 *
 * Declared for the OpenAPI document; `parseEmployeeQuery` is what the service
 * trusts. A query string is written by whoever is holding the keyboard, so every
 * value is either understood or dropped: an unknown sort sorts by name, a page
 * size of a million is a page, and a code that means nothing in this tenant
 * matches nothing rather than everything.
 */
export class EmployeeQueryDto {
  @ApiPropertyOptional({
    description: 'Name, employee number, or national identifier for the roles allowed it',
  })
  q?: string;

  @ApiPropertyOptional({ example: 'KIT' })
  department?: string;

  @ApiPropertyOptional({ example: 'CASA-HQ' })
  site?: string;

  @ApiPropertyOptional({ example: 'CDD' })
  contractType?: string;

  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES })
  status?: EmployeeStatusFilter;

  @ApiPropertyOptional({
    enum: EMPLOYEE_VIEWS,
    description: 'The two lists the home screen opens: papers running out, contracts running out',
  })
  view?: EmployeeView;

  @ApiPropertyOptional({ enum: EMPLOYEE_SORTS, default: 'name' })
  sort?: EmployeeSort;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  dir?: 'asc' | 'desc';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  page?: string;

  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: MAX_PAGE_SIZE })
  pageSize?: string;

  @ApiPropertyOptional({ description: 'Include the people who have left' })
  includeLeavers?: string;
}

/** The same question, understood: every field settled, nothing to re-check. */
export interface EmployeeQuery {
  readonly q: string;
  readonly department?: string;
  readonly site?: string;
  readonly contractType?: string;
  readonly status?: EmployeeStatusFilter;
  readonly view?: EmployeeView;
  readonly sort: EmployeeSort;
  readonly dir: 'asc' | 'desc';
  readonly page: number;
  readonly pageSize: number;
  readonly includeLeavers: boolean;
}

export function parseEmployeeQuery(raw: EmployeeQueryDto): EmployeeQuery {
  const code = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed === undefined || trimmed === '' ? undefined : trimmed.slice(0, 40);
  };

  const oneOf = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
    typeof value === 'string' && (options as readonly string[]).includes(value)
      ? (value as T)
      : undefined;

  const whole = (value: string | undefined, fallback: number, max: number): number => {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
  };

  return {
    q: (raw.q ?? '').trim().slice(0, 80),
    ...(code(raw.department) ? { department: code(raw.department) } : {}),
    ...(code(raw.site) ? { site: code(raw.site) } : {}),
    ...(code(raw.contractType) ? { contractType: code(raw.contractType) } : {}),
    ...(oneOf(EMPLOYEE_STATUSES, raw.status) ? { status: oneOf(EMPLOYEE_STATUSES, raw.status) } : {}),
    ...(oneOf(EMPLOYEE_VIEWS, raw.view) ? { view: oneOf(EMPLOYEE_VIEWS, raw.view) } : {}),
    sort: oneOf(EMPLOYEE_SORTS, raw.sort) ?? 'name',
    dir: oneOf(['asc', 'desc'] as const, raw.dir) ?? 'asc',
    page: whole(raw.page, 1, 10_000),
    pageSize: whole(raw.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    includeLeavers: raw.includeLeavers === 'true',
  };
}
