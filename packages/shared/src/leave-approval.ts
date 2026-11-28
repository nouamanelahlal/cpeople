import { addDays } from './documents.js';
import type { DayPart, LeaveSpan } from './leave-days.js';

/**
 * Who is asked, in what order, and what may not overlap what (M09 / HR-04).
 *
 * All of it is pure, and none of it touches the database, because these are the
 * decisions that have to be the same everywhere: the form that warns somebody
 * before they send a request, the API that accepts it, and the test that proves
 * a manager cannot approve their own leave all have to agree.
 */

export type LeaveStatus =
  | 'pending_n1'
  | 'pending_n2'
  | 'pending_hr'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'cancellation_pending'
  | 'cancelled';

/** Waiting on somebody. */
export const PENDING_STATUSES = ['pending_n1', 'pending_n2', 'pending_hr'] as const;

/**
 * Statuses that hold a place in the calendar.
 *
 * A request still being decided counts, because two requests for the same
 * morning cannot both be granted, and a request waiting to be cancelled counts
 * until the cancellation is agreed — the person is still booked off.
 */
export const BLOCKING_STATUSES = [
  'pending_n1',
  'pending_n2',
  'pending_hr',
  'approved',
  'cancellation_pending',
] as const;

/** Decided, one way or another, and no longer in anybody's way. */
export const CLOSED_STATUSES = ['rejected', 'withdrawn', 'cancelled'] as const;

export function isPending(status: LeaveStatus): boolean {
  return (PENDING_STATUSES as readonly string[]).includes(status);
}

export function isBlocking(status: LeaveStatus): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status);
}

export interface ApprovalChain {
  /** The line manager, where there is one to ask. */
  readonly n1Id?: string;
  /** The line manager's own manager, for the types that need a second yes. */
  readonly n2Id?: string;
  /** True when nobody in the line could be asked, so HR was. */
  readonly toHr: boolean;
  readonly status: 'pending_n1' | 'pending_hr';
}

/**
 * Who approves this person's leave, from the organisation as it stands now
 * (HR-02 spec, point 4).
 *
 * N+1 is their manager and N+2 is that manager's manager. Two cases send it
 * straight to HR instead: nobody is recorded as their manager, and the manager
 * is the requester — a department head asking for leave must not be handed
 * their own request to approve.
 *
 * The answer is stored on the request when it is sent, so that reorganising the
 * company next month does not rewrite who was asked last month.
 *
 * TODO(HR-02 open point 11): an approver who is away. Delegation is not built;
 * today HR overrides, which is recorded with a reason.
 */
export function approvalChain(input: {
  readonly requesterId: string;
  readonly managerId?: string | null;
  readonly managerManagerId?: string | null;
}): ApprovalChain {
  const { requesterId, managerId, managerManagerId } = input;

  if (!managerId || managerId === requesterId) {
    return { toHr: true, status: 'pending_hr' };
  }

  // The same guard one level up: a manager's manager who is the requester is no
  // more use as a second approver than they were as the first.
  const n2 = managerManagerId && managerManagerId !== requesterId ? managerManagerId : undefined;

  return {
    n1Id: managerId,
    ...(n2 ? { n2Id: n2 } : {}),
    toHr: false,
    status: 'pending_n1',
  };
}

/** Who gives the second yes (M09): a company setting, not a rule in code. */
export type SecondApprover = 'manager_of_manager' | 'hr';

/**
 * Where a request goes once the line manager has said yes.
 *
 * A type that needs no second yes is approved there and then. One that does goes
 * to the company's second approver: HR when the company chose HR (SMG, HR-02
 * decision 1), otherwise N+2 — and where there is no N+2, to HR, rather than
 * quietly skipping the second approval the client asked for.
 */
export function afterFirstApproval(input: {
  readonly requiresSecondApproval: boolean;
  readonly n2Id?: string | null;
  readonly secondApprover?: SecondApprover;
}): 'approved' | 'pending_n2' | 'pending_hr' {
  if (!input.requiresSecondApproval) {
    return 'approved';
  }

  if (input.secondApprover === 'hr') {
    return 'pending_hr';
  }

  return input.n2Id ? 'pending_n2' : 'pending_hr';
}

/**
 * Whether this person is the one being waited on.
 *
 * HR can act at any stage, but that is an override and is asked for separately;
 * this answers the narrower question of whose turn it is.
 */
export function awaiting(
  request: { readonly status: LeaveStatus; readonly n1Id?: string | null; readonly n2Id?: string | null },
  employeeId: string | undefined,
): boolean {
  if (employeeId === undefined) return false;

  switch (request.status) {
    case 'pending_n1':
    case 'cancellation_pending':
      return request.n1Id === employeeId;
    case 'pending_n2':
      return request.n2Id === employeeId;
    default:
      return false;
  }
}

/**
 * The half-days a request occupies, as "date:part" keys.
 *
 * Two requests clash when they want the same half of the same day. A morning off
 * on the 10th and an afternoon off on the 10th are two different requests and
 * neither is in the other's way, so comparing dates alone would refuse something
 * perfectly reasonable.
 */
export function occupiedHalves(span: LeaveSpan): string[] {
  if (span.to < span.from) return [];

  const halves: string[] = [];

  for (let date = span.from; date <= span.to; date = addDays(date, 1)) {
    const part: DayPart =
      date === span.from
        ? (span.firstDayPart ?? 'full')
        : date === span.to
          ? (span.lastDayPart ?? 'full')
          : 'full';

    if (part === 'full') {
      halves.push(`${date}:morning`, `${date}:afternoon`);
    } else {
      halves.push(`${date}:${part}`);
    }

    // A guard against a typo turning into a year of keys.
    if (halves.length > 1000) break;
  }

  return halves;
}

/** Do these two requests want the same half of the same day? */
export function spansClash(a: LeaveSpan, b: LeaveSpan): boolean {
  if (a.to < b.from || b.to < a.from) return false;

  const mine = new Set(occupiedHalves(a));
  return occupiedHalves(b).some((half) => mine.has(half));
}

/**
 * The years a request touches, which is what decides whether its public holidays
 * are known yet.
 */
export function yearsOf(span: { readonly from: string; readonly to: string }): number[] {
  const first = Number(span.from.slice(0, 4));
  const last = Number(span.to.slice(0, 4));

  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return [];

  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}
