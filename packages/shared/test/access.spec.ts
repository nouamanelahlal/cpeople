import { describe, expect, it } from 'vitest';
import {
  can,
  canSeeSensitive,
  capabilitiesOf,
  isSensitive,
  maskValue,
  roleFromRealmRoles,
  ROLES,
  SENSITIVE_FIELDS,
} from '../src/access.js';

// The permission matrix from the HR-01 spec, section 5. These are the rules the
// API enforces, so this is where they are pinned down.

describe('HR-01 roles', () => {
  it('reads the CPeople role out of the realm roles a token carries', () => {
    expect(roleFromRealmRoles(['platform-admin', 'employee'])).toBe('admin');
    expect(roleFromRealmRoles(['hr-admin'])).toBe('hr');
    expect(roleFromRealmRoles(['payroll-manager'])).toBe('hr');
    expect(roleFromRealmRoles(['manager', 'employee'])).toBe('manager');
    expect(roleFromRealmRoles(['employee'])).toBe('employee');
  });

  it('falls back to the least a signed-in person can be', () => {
    // An unknown or missing realm role must not grant anything by accident.
    expect(roleFromRealmRoles([])).toBe('employee');
    expect(roleFromRealmRoles(['default-roles-cpeople', 'offline_access'])).toBe('employee');
  });

  it('gives each role what the workshop matrix says, and no more', () => {
    expect(can('hr', 'employee.list.all')).toBe(true);
    expect(can('hr', 'employee.sensitive.read')).toBe(true);
    expect(can('hr', 'demo.manage')).toBe(false);
    expect(can('hr', 'organisation.manage')).toBe(false);

    // A manager sees their own team, and none of its sensitive fields.
    expect(can('manager', 'employee.list.team')).toBe(true);
    expect(can('manager', 'employee.list.all')).toBe(false);
    expect(can('manager', 'employee.sensitive.read')).toBe(false);
    expect(can('manager', 'contract.manage')).toBe(false);
    expect(can('manager', 'audit.read')).toBe(false);

    // An employee sees their own file and can correct how to reach them.
    expect(can('employee', 'employee.read.own')).toBe(true);
    expect(can('employee', 'employee.edit.own.contact')).toBe(true);
    expect(can('employee', 'employee.list.team')).toBe(false);
    expect(can('employee', 'employee.sensitive.read')).toBe(false);

    expect(can('admin', 'demo.manage')).toBe(true);
  });

  it('never leaves a role with nothing to do', () => {
    for (const role of ROLES) {
      expect(capabilitiesOf(role).length, role).toBeGreaterThan(0);
    }
  });
});

describe('HR-01 sensitive fields', () => {
  it('counts pay, identifiers, address and dependents as sensitive', () => {
    for (const field of ['baseSalaryMinor', 'nationalId', 'bankAccount', 'address', 'dependents']) {
      expect(isSensitive(field), field).toBe(true);
    }

    for (const field of ['firstName', 'employeeNumber', 'departmentId', 'hireDate']) {
      expect(isSensitive(field), field).toBe(false);
    }

    expect(SENSITIVE_FIELDS.length).toBeGreaterThan(5);
  });

  it('lets a person see their own, whatever their role', () => {
    expect(canSeeSensitive('manager', { ownFile: false })).toBe(false);
    expect(canSeeSensitive('manager', { ownFile: true })).toBe(true);
    expect(canSeeSensitive('employee', { ownFile: true })).toBe(true);
    expect(canSeeSensitive('hr', { ownFile: false })).toBe(true);
  });

  it('masks a value down to something recognisable, and never the value itself', () => {
    // An account number keeps its last four, so two of them can be told apart.
    expect(maskValue('001234567890123456789012')).toBe('•••• 9012');
    // A salary keeps nothing: its size is the secret.
    expect(maskValue(650_000)).toBe('••••');
    expect(maskValue('AB12')).toBe('••••');
    expect(maskValue('')).toBe('••••');
    expect(maskValue(undefined)).toBe('••••');
    expect(maskValue(null)).toBe('••••');
  });

  it('never returns a masked value containing the whole original', () => {
    const secrets = ['A123456', '001234567890123456789012', 'Salma Benali, 12 rue des Demos'];

    for (const secret of secrets) {
      expect(maskValue(secret).includes(secret)).toBe(false);
    }
  });
});
