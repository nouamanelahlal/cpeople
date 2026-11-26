import { describe, expect, it } from 'vitest';
import {
  afterFirstApproval,
  approvalChain,
  awaiting,
  isBlocking,
  occupiedHalves,
  spansClash,
  yearsOf,
} from '../src/leave-approval.js';

/**
 * The rules about who is asked and what may overlap what (M09 / HR-04).
 *
 * These are the cases a workshop asks about: what happens to the department
 * head's own leave, what happens when nobody has a manager recorded, and whether
 * somebody can take a morning off that somebody else already has.
 */

const KARIM = 'employee-karim';
const RACHID = 'manager-rachid';
const SALMA = 'director-salma';

describe('who approves', () => {
  it('asks the manager, then the manager’s manager', () => {
    expect(approvalChain({ requesterId: KARIM, managerId: RACHID, managerManagerId: SALMA })).toEqual({
      n1Id: RACHID,
      n2Id: SALMA,
      toHr: false,
      status: 'pending_n1',
    });
  });

  it('sends it to HR when nobody is recorded as the manager', () => {
    expect(approvalChain({ requesterId: KARIM })).toEqual({ toHr: true, status: 'pending_hr' });
    expect(approvalChain({ requesterId: KARIM, managerId: null })).toEqual({
      toHr: true,
      status: 'pending_hr',
    });
  });

  it('sends it to HR rather than to the requester themselves', () => {
    // The department head, whose manager field points at nobody above them — or,
    // in a badly kept organisation, at themselves.
    expect(approvalChain({ requesterId: RACHID, managerId: RACHID })).toEqual({
      toHr: true,
      status: 'pending_hr',
    });
  });

  it('skips a second approver who is the requester', () => {
    // Rachid reports to Salma; Salma's own request would otherwise come back to
    // Salma as N+2.
    const chain = approvalChain({ requesterId: SALMA, managerId: RACHID, managerManagerId: SALMA });

    expect(chain.n1Id).toBe(RACHID);
    expect(chain.n2Id).toBeUndefined();
  });
});

describe('after the first yes', () => {
  it('approves a type that needs only one', () => {
    expect(afterFirstApproval({ requiresSecondApproval: false, n2Id: SALMA })).toBe('approved');
  });

  it('goes up the line for a type that needs two', () => {
    expect(afterFirstApproval({ requiresSecondApproval: true, n2Id: SALMA })).toBe('pending_n2');
  });

  it('goes to HR rather than skipping the second yes', () => {
    expect(afterFirstApproval({ requiresSecondApproval: true, n2Id: null })).toBe('pending_hr');
  });

  it('M09 goes to HR after the manager when the company chose HR (HR-02 decision 1)', () => {
    expect(afterFirstApproval({ requiresSecondApproval: true, n2Id: SALMA, secondApprover: 'hr' })).toBe('pending_hr');
    expect(afterFirstApproval({ requiresSecondApproval: true, n2Id: SALMA, secondApprover: 'manager_of_manager' })).toBe('pending_n2');
  });

  it('still approves at once a type that needs no second yes, whoever the second approver is', () => {
    expect(afterFirstApproval({ requiresSecondApproval: false, n2Id: SALMA, secondApprover: 'hr' })).toBe('approved');
  });
});

describe('whose turn it is', () => {
  const request = { status: 'pending_n1' as const, n1Id: RACHID, n2Id: SALMA };

  it('is the manager’s while it waits for them', () => {
    expect(awaiting(request, RACHID)).toBe(true);
    expect(awaiting(request, SALMA)).toBe(false);
  });

  it('moves to the second approver', () => {
    expect(awaiting({ ...request, status: 'pending_n2' }, SALMA)).toBe(true);
    expect(awaiting({ ...request, status: 'pending_n2' }, RACHID)).toBe(false);
  });

  it('is nobody’s once it is decided', () => {
    expect(awaiting({ ...request, status: 'approved' }, RACHID)).toBe(false);
    expect(awaiting(request, undefined)).toBe(false);
  });

  it('is the manager’s again when a cancellation is asked for', () => {
    expect(awaiting({ ...request, status: 'cancellation_pending' }, RACHID)).toBe(true);
  });
});

describe('what holds a place in the calendar', () => {
  it('counts anything still open, and anything granted', () => {
    expect(isBlocking('pending_n1')).toBe(true);
    expect(isBlocking('approved')).toBe(true);
    // Still booked off until somebody agrees to the cancellation.
    expect(isBlocking('cancellation_pending')).toBe(true);
  });

  it('does not count what was refused or taken back', () => {
    expect(isBlocking('rejected')).toBe(false);
    expect(isBlocking('withdrawn')).toBe(false);
    expect(isBlocking('cancelled')).toBe(false);
  });
});

describe('clashes', () => {
  it('finds an overlap of whole days', () => {
    expect(
      spansClash({ from: '2026-12-07', to: '2026-12-11' }, { from: '2026-12-10', to: '2026-12-14' }),
    ).toBe(true);
  });

  it('leaves neighbouring requests alone', () => {
    expect(
      spansClash({ from: '2026-12-07', to: '2026-12-09' }, { from: '2026-12-10', to: '2026-12-14' }),
    ).toBe(false);
  });

  it('lets a morning and an afternoon of the same day stand side by side', () => {
    expect(
      spansClash(
        { from: '2026-12-07', to: '2026-12-07', firstDayPart: 'morning' },
        { from: '2026-12-07', to: '2026-12-07', firstDayPart: 'afternoon' },
      ),
    ).toBe(false);
  });

  it('refuses the same half twice', () => {
    expect(
      spansClash(
        { from: '2026-12-07', to: '2026-12-07', firstDayPart: 'morning' },
        { from: '2026-12-07', to: '2026-12-07', firstDayPart: 'morning' },
      ),
    ).toBe(true);
  });

  it('refuses a half-day inside a whole-day request', () => {
    expect(
      spansClash(
        { from: '2026-12-07', to: '2026-12-11' },
        { from: '2026-12-09', to: '2026-12-09', firstDayPart: 'afternoon' },
      ),
    ).toBe(true);
  });

  it('lets a request start the afternoon another one ends the morning of', () => {
    expect(
      spansClash(
        { from: '2026-12-01', to: '2026-12-07', lastDayPart: 'morning' },
        { from: '2026-12-07', to: '2026-12-11', firstDayPart: 'afternoon' },
      ),
    ).toBe(false);
  });
});

describe('the halves a request occupies', () => {
  it('counts a single morning as one half', () => {
    expect(occupiedHalves({ from: '2026-12-07', to: '2026-12-07', firstDayPart: 'morning' })).toEqual([
      '2026-12-07:morning',
    ]);
  });

  it('counts a whole day as both', () => {
    expect(occupiedHalves({ from: '2026-12-07', to: '2026-12-07' })).toEqual([
      '2026-12-07:morning',
      '2026-12-07:afternoon',
    ]);
  });

  it('answers nothing for a span that runs backwards', () => {
    expect(occupiedHalves({ from: '2026-12-11', to: '2026-12-07' })).toEqual([]);
  });
});

describe('the years a request touches', () => {
  it('is one for a request inside a year', () => {
    expect(yearsOf({ from: '2026-12-07', to: '2026-12-11' })).toEqual([2026]);
  });

  it('is both when it crosses the new year', () => {
    expect(yearsOf({ from: '2026-12-28', to: '2027-01-04' })).toEqual([2026, 2027]);
  });
});
