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
  readonly documentsExpiring: { readonly value: number; readonly of?: number };
  readonly onboarding: number;
  readonly onboardingOverdue: number;
  readonly contractsEnding: number;
  readonly departments: readonly { readonly code: string; readonly name: string; readonly count: number }[];
  readonly waiting: readonly HomeTask[];
}
