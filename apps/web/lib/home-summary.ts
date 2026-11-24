/**
 * The shape the API answers /home with (HR-01 spec 6.12).
 *
 * Kept beside the fetch rather than shared with the API: the web depends on the
 * API's published contract, not on its source, which is what lets the two move
 * at different speeds. It is checked against apps/api's HomeSummaryDto by the
 * end-to-end tests, which call the real thing.
 */
export interface HomeTask {
  readonly kind: 'contractEnding' | 'onboardingOverdue' | 'documentExpired';
  readonly employeeId: string;
  readonly employeeName: string;
  readonly date?: string;
  readonly detail?: string;
  readonly days?: number;
}

export interface HomeSummary {
  readonly today: string;
  readonly holiday?: string;
  readonly headcount: { readonly value: number };
  readonly fixedTerm: number;
  readonly joinedThisMonth: number;
  readonly leftThisMonth: number;
  /** How many documents are inside their own kind's notice period (6.7). */
  readonly documentsExpiring: { readonly value: number };
  readonly onboarding: number;
  readonly onboardingOverdue: number;
  readonly contractsEnding: number;
  readonly departments: readonly { readonly code: string; readonly name: string; readonly count: number }[];
  readonly waiting: readonly HomeTask[];
  /** Who is off this week, live from the leave requests (M09 / HR-04). */
  readonly away: AwayThisWeek;
  /** Leave requests waiting for this reader to act. */
  readonly leaveRequests: number;
  readonly leaveRequestsTab: 'approvals' | 'all';
}

export interface AwayDay {
  readonly date: string;
  readonly away: number;
  readonly holiday: boolean;
  readonly holidayName?: string;
}

export interface AwayPerson {
  readonly id: string;
  readonly name: string;
  readonly department: string;
  /** Absent unless the company lets colleagues see which kind of leave it is. */
  readonly leaveTypeCode?: string;
  readonly from: string;
  readonly to: string;
}

export interface AwayThisWeek {
  readonly days: readonly AwayDay[];
  readonly people: readonly AwayPerson[];
  readonly total: number;
  readonly workingToday: number;
}
