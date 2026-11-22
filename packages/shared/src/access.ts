/**
 * Who may do what, and who may see what (M02 / HR-08, HR-01 spec section 5).
 *
 * One table, used in one place on the server. The browser may ask the same
 * questions to decide what to draw, but that is a courtesy: the answer that
 * matters is the one the API gives, because a field the reader may not see is
 * never sent to them. Hiding it with CSS would still have put it in the page.
 *
 * The matrix itself is a question for the HR-01 workshop, not a decision we have
 * been given: the screen that shows it says so.
 */

/** What someone is, here. Keycloak's realm roles map onto these. */
export const ROLES = ['admin', 'hr', 'manager', 'employee'] as const;

export type Role = (typeof ROLES)[number];

/**
 * The realm roles behind each one, most senior first. Someone holding several
 * acts as the most senior of them.
 */
const ROLE_FROM_REALM: ReadonlyArray<readonly [Role, string]> = [
  ['admin', 'platform-admin'],
  ['hr', 'hr-admin'],
  ['hr', 'payroll-manager'],
  ['manager', 'manager'],
  ['employee', 'employee'],
];

/** The CPeople role this person acts in, from the roles their token carries. */
export function roleFromRealmRoles(realmRoles: readonly string[]): Role {
  const held = ROLE_FROM_REALM.find(([, realmRole]) => realmRoles.includes(realmRole));
  return held?.[0] ?? 'employee';
}

/** Everything a person can ask to do. */
export const CAPABILITIES = [
  'employee.list.all',
  'employee.list.team',
  'employee.read.own',
  'employee.create',
  'employee.edit',
  'employee.edit.own.contact',
  'employee.sensitive.read',
  'contract.manage',
  'document.upload',
  'onboarding.manage.all',
  'onboarding.manage.team',
  'organisation.manage',
  'organisation.view',
  'settings.templates.manage',
  'data.import',
  'data.export',
  'audit.read',
  'demo.manage',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * The matrix from the HR-01 spec, section 5.
 *
 * A manager sees their own team and none of its sensitive fields; an employee
 * sees their own file. Nobody but an administrator touches the demo controls.
 */
const GRANTS: Record<Role, readonly Capability[]> = {
  admin: [...CAPABILITIES],
  hr: [
    'employee.list.all',
    'employee.read.own',
    'employee.create',
    'employee.edit',
    'employee.sensitive.read',
    'contract.manage',
    'document.upload',
    'onboarding.manage.all',
    'organisation.view',
    'data.import',
    'data.export',
    'audit.read',
  ],
  manager: ['employee.list.team', 'employee.read.own', 'onboarding.manage.team', 'organisation.view'],
  employee: ['employee.read.own', 'employee.edit.own.contact'],
};

/** May this person do this? The only question the server asks. */
export function can(role: Role, capability: Capability): boolean {
  return GRANTS[role].includes(capability);
}

export function capabilitiesOf(role: Role): readonly Capability[] {
  return GRANTS[role];
}

/**
 * The fields that are nobody's business unless the role says otherwise: pay, the
 * identifiers a person is traced by, where they live and who depends on them.
 *
 * Masked values never leave the server — not in a list, a file, a search result,
 * an export or the before-and-after of a history entry.
 */
export const SENSITIVE_FIELDS = [
  'nationalId',
  'socialSecurityNumber',
  'baseSalaryMinor',
  'salary',
  'bankName',
  'bankAccount',
  'birthDate',
  'address',
  'dependents',
] as const;

export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export function isSensitive(field: string): field is SensitiveField {
  return (SENSITIVE_FIELDS as readonly string[]).includes(field);
}

/**
 * What someone may see of a given person's file.
 *
 * Sensitive fields are readable when the role is allowed them outright, or when
 * the file is the reader's own: everyone can see their own salary.
 */
export function canSeeSensitive(role: Role, options: { ownFile: boolean } = { ownFile: false }): boolean {
  return can(role, 'employee.sensitive.read') || options.ownFile;
}

/** The stand-in a masked value is shown as: the shape stays, the value goes. */
export const MASK = '••••';

/**
 * A masked value keeps just enough to be recognisable as the same field — the
 * last four characters of an account number, nothing of a salary.
 */
export function maskValue(value: unknown): string {
  if (typeof value === 'number') {
    return MASK;
  }

  if (typeof value !== 'string' || value.length === 0) {
    return MASK;
  }

  return value.length <= 4 ? MASK : `${MASK} ${value.slice(-4)}`;
}
