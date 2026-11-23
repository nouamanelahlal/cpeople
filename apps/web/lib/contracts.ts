/**
 * What the contracts API answers (HR-01 spec 6.6).
 *
 * Kept beside the fetch, like the rest: the web depends on the API's published
 * shape, not on its source.
 */
export interface ContractRow {
  readonly id: string;
  readonly employee: { readonly id: string; readonly name: string; readonly employeeNumber: string };
  readonly type: { readonly code: string; readonly name: string };
  readonly status: 'draft' | 'generated' | 'signed' | 'renewed' | 'ended';
  readonly startDate: string;
  readonly endDate?: string;
  readonly daysLeft?: number;
  readonly trialEndDate?: string;
  readonly endReason?: string;
  readonly generatedAt?: string;
  readonly signedAt?: string;
}

export interface ContractList {
  readonly rows: readonly ContractRow[];
  readonly types: readonly { readonly code: string; readonly name: string }[];
  readonly today: string;
  readonly mayManage: boolean;
}

export interface ContractClause {
  readonly key: string;
  readonly title: string;
  readonly mandatory: boolean;
  readonly chosen: boolean;
  readonly text: string;
}

export interface ContractPreview {
  readonly contract: ContractRow;
  readonly title: string;
  readonly fields: readonly { readonly field: string; readonly value: string }[];
  readonly missing: readonly string[];
  readonly clauses: readonly ContractClause[];
  readonly fileName: string;
  readonly mayManage: boolean;
}

/** The three views the list offers, as the spec names them. */
export const CONTRACT_VIEWS = ['running', 'ending', 'ended'] as const;
export type ContractView = (typeof CONTRACT_VIEWS)[number];

export function readContractView(raw: string | string[] | undefined): ContractView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (CONTRACT_VIEWS as readonly string[]).includes(value ?? '')
    ? (value as ContractView)
    : 'running';
}

/** The query the API wants for one of those views. */
export function contractQuery(view: ContractView, type: string): string {
  const query = new URLSearchParams();

  if (view === 'ending') query.set('view', 'ending');
  if (view === 'ended') query.set('status', 'ended');
  if (type !== '') query.set('type', type);

  const text = query.toString();
  return text === '' ? '' : `?${text}`;
}

/** This screen's own address, with one thing changed. */
export function contractsHref(view: ContractView, type: string): string {
  const query = new URLSearchParams();

  if (view !== 'running') query.set('view', view);
  if (type !== '') query.set('type', type);

  const text = query.toString();
  return text === '' ? '/contracts' : `/contracts?${text}`;
}
