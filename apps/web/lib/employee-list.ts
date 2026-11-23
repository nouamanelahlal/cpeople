/**
 * What `GET /api/employees` answers (HR-01 spec 6.2).
 *
 * The same shape as the API's DTOs, kept here so a page can be typed without
 * importing the server. Nothing sensitive is in a row: the list says who someone
 * is and where they work, and their pay, identifiers, address and dependents stay
 * on their file, for the roles allowed them. There is nothing to mask here
 * because there is nothing to hide — a field the reader may not see never leaves
 * the API.
 */
export type PaperState = 'ok' | 'expiring' | 'expired';
export type EmployeeStatus = 'onboarding' | 'active' | 'left';

export interface NamedCode {
  readonly code: string;
  readonly name: string;
}

export interface FilterChoice extends NamedCode {
  readonly count: number;
}

export interface EmployeeRow {
  readonly id: string;
  readonly employeeNumber: string;
  readonly name: string;
  readonly initials: string;
  readonly position: string;
  readonly department: NamedCode;
  readonly site?: NamedCode;
  readonly contractType?: NamedCode;
  readonly contractEnd?: string;
  readonly status: EmployeeStatus;
  readonly hireDate: string;
  readonly documents: PaperState;
}

export interface EmployeeList {
  readonly rows: readonly EmployeeRow[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pages: number;
  readonly visible: number;
  readonly facets: {
    readonly departments: readonly FilterChoice[];
    readonly sites: readonly FilterChoice[];
    readonly contractTypes: readonly FilterChoice[];
  };
  readonly today: string;
  readonly searchesIdentifiers: boolean;
  readonly mayCreate: boolean;
  readonly mayExport: boolean;
}

/** The sorts the list offers, and the two lists the home screen opens. */
export const SORTS = ['name', 'hireDate', 'contractEnd'] as const;
export type Sort = (typeof SORTS)[number];

export const VIEWS = ['documents-expiring', 'contracts-ending'] as const;
export type View = (typeof VIEWS)[number];

/**
 * What the page was asked for, from the address bar.
 *
 * The URL is the state of this screen: a filtered list can be shared, kept,
 * reloaded and linked to from the home screen's cards, and the back button walks
 * back through it. Nothing is understood that is not on this list.
 */
export interface EmployeeSearch {
  readonly q: string;
  readonly department?: string;
  readonly site?: string;
  readonly contractType?: string;
  readonly status?: EmployeeStatus;
  readonly view?: View;
  readonly sort: Sort;
  readonly dir: 'asc' | 'desc';
  readonly page: number;
  readonly includeLeavers: boolean;
}

type RawSearch = Record<string, string | string[] | undefined>;

export function readSearch(raw: RawSearch): EmployeeSearch {
  const one = (key: string): string | undefined => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    const trimmed = first?.trim();
    return trimmed === undefined || trimmed === '' ? undefined : trimmed;
  };

  const oneOf = <T extends string>(options: readonly T[], value: string | undefined): T | undefined =>
    value !== undefined && (options as readonly string[]).includes(value) ? (value as T) : undefined;

  const page = Number.parseInt(one('page') ?? '', 10);

  return {
    q: one('q') ?? '',
    ...optional('department', one('department')),
    ...optional('site', one('site')),
    ...optional('contractType', one('contractType')),
    ...optional('status', oneOf(['onboarding', 'active', 'left'] as const, one('status'))),
    // The home screen's cards link here: "documents-expiring" is the card that
    // counts them, and the list it opens has to be the same question.
    ...optional('view', oneOf(VIEWS, one('filter') ?? one('view'))),
    sort: oneOf(SORTS, one('sort')) ?? 'name',
    dir: oneOf(['asc', 'desc'] as const, one('dir')) ?? 'asc',
    page: Number.isFinite(page) && page > 0 ? page : 1,
    includeLeavers: one('includeLeavers') === 'true',
  };
}

function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

/** The query string to ask the API with. */
export function apiQuery(search: EmployeeSearch, pageSize: number): string {
  const query = new URLSearchParams();

  if (search.q !== '') query.set('q', search.q);
  if (search.department) query.set('department', search.department);
  if (search.site) query.set('site', search.site);
  if (search.contractType) query.set('contractType', search.contractType);
  if (search.status) query.set('status', search.status);
  if (search.view) query.set('view', search.view);
  if (search.includeLeavers) query.set('includeLeavers', 'true');
  query.set('sort', search.sort);
  query.set('dir', search.dir);
  query.set('page', String(search.page));
  query.set('pageSize', String(pageSize));

  return query.toString();
}

/**
 * A link to this same screen with one thing changed.
 *
 * Changing a filter always goes back to the first page: page four of a list of
 * three hundred is not page four of the twelve that are left after filtering.
 */
export function href(search: EmployeeSearch, changes: Partial<EmployeeSearch>): string {
  const next = { ...search, ...changes };
  const query = new URLSearchParams();

  if (next.q !== '') query.set('q', next.q);
  if (next.department) query.set('department', next.department);
  if (next.site) query.set('site', next.site);
  if (next.contractType) query.set('contractType', next.contractType);
  if (next.status) query.set('status', next.status);
  if (next.view) query.set('view', next.view);
  if (next.includeLeavers) query.set('includeLeavers', 'true');
  if (next.sort !== 'name') query.set('sort', next.sort);
  if (next.dir !== 'asc') query.set('dir', next.dir);

  const page = changes.page ?? ('page' in changes ? next.page : 1);
  if (page > 1) query.set('page', String(page));

  const text = query.toString();
  return text === '' ? '/employees' : `/employees?${text}`;
}

/** Whether anything at all is narrowing the list. */
export function isFiltered(search: EmployeeSearch): boolean {
  return (
    search.q !== '' ||
    search.department !== undefined ||
    search.site !== undefined ||
    search.contractType !== undefined ||
    search.status !== undefined ||
    search.view !== undefined ||
    search.includeLeavers
  );
}
