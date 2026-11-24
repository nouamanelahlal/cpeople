import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The statuses a request moves through (HR-02 spec 2). */
export const LEAVE_STATUSES = [
  'pending_n1',
  'pending_n2',
  'pending_hr',
  'approved',
  'rejected',
  'withdrawn',
  'cancellation_pending',
  'cancelled',
] as const;

export type LeaveStatusDto = (typeof LEAVE_STATUSES)[number];

/** One day of a request and what it was worth, as stored on a calculation. */
export class LeaveDayDto {
  @ApiProperty({ example: '2026-12-09' })
  date!: string;

  @ApiProperty({ enum: ['full', 'morning', 'afternoon'] })
  part!: 'full' | 'morning' | 'afternoon';

  @ApiProperty({ example: 0.5 })
  days!: number;

  @ApiPropertyOptional({ enum: ['weekend', 'holiday'] })
  reason?: 'weekend' | 'holiday';
}

/**
 * What a request cost at one moment, with the rows that decided it
 * (HR-02 spec, point 1).
 */
export class LeaveCalculationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['submitted', 'approved', 'recalculated', 'accepted'] })
  kind!: 'submitted' | 'approved' | 'recalculated' | 'accepted';

  @ApiProperty({ example: 4.5 })
  dayCount!: number;

  @ApiProperty({ type: [LeaveDayDto] })
  days!: LeaveDayDto[];

  @ApiProperty({ enum: ['working', 'calendar'] })
  dayBasis!: 'working' | 'calendar';

  @ApiProperty({ example: [1, 2, 3, 4, 5], description: 'The working week that was applied' })
  workingDays!: number[];

  @ApiPropertyOptional({ format: 'uuid', description: 'The rule row in force at the time' })
  leaveRuleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  workWeekId?: string;

  @ApiProperty({ type: [String], description: 'The public holidays that took a day off the count' })
  holidayIds!: string[];

  @ApiProperty({ description: 'Whether every year it touches had its holidays finished' })
  holidaysComplete!: boolean;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty()
  at!: string;
}

/** Something somebody did to a request. */
export class LeaveDecisionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'approved_n1' })
  kind!: string;

  @ApiProperty({ example: 'Rachid Kettani' })
  byName!: string;

  @ApiProperty({ example: 'manager' })
  byRole!: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiProperty()
  at!: string;
}

/** A warning: something worth saying, which never refuses the request. */
export class LeaveWarningDto {
  @ApiProperty({
    enum: ['holidays', 'balance', 'teamOff', 'notice', 'backdate'],
    description: 'Which warning, so the screen can word it in the reader’s language',
  })
  kind!: 'holidays' | 'balance' | 'teamOff' | 'notice' | 'backdate';

  @ApiProperty({ description: 'The values the sentence needs, already formatted', type: Object })
  values!: Record<string, string>;
}

/** One request, as every screen reads it. */
export class LeaveRequestDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: LEAVE_STATUSES })
  status!: LeaveStatusDto;

  @ApiProperty({ example: { id: '…', name: 'Karim Alaoui', department: 'Kitchen' } })
  employee!: { id: string; name: string; department: string };

  @ApiProperty({ example: { id: '…', code: 'ANNUAL', name: 'Congé annuel' } })
  leaveType!: { id: string; code: string; name: string; requiresDocument: boolean };

  @ApiProperty({ example: '2026-12-07' })
  from!: string;

  @ApiProperty({ example: '2026-12-11' })
  to!: string;

  @ApiProperty({ enum: ['full', 'morning', 'afternoon'] })
  fromPart!: 'full' | 'morning' | 'afternoon';

  @ApiProperty({ enum: ['full', 'morning', 'afternoon'] })
  toPart!: 'full' | 'morning' | 'afternoon';

  @ApiProperty({ example: 4.5, description: 'What it costs, as last agreed' })
  dayCount!: number;

  @ApiPropertyOptional({ description: 'The requester’s own words. Never put in an e-mail.' })
  reason?: string;

  @ApiPropertyOptional({ description: 'Who it is waiting on' })
  waitingOn?: { id?: string; name: string };

  @ApiProperty()
  submittedAt!: string;

  @ApiPropertyOptional()
  decidedAt?: string;

  @ApiPropertyOptional({ description: 'Set when a settings change moved the count' })
  recalculatedAt?: string;

  @ApiPropertyOptional({ description: 'What it was before that change' })
  recalculatedFrom?: number;

  @ApiProperty({ description: 'Whether this reader is the one being waited on' })
  mine!: boolean;

  @ApiProperty({ description: 'Whether this reader may decide it now' })
  mayDecide!: boolean;

  @ApiProperty({ description: 'Whether deciding it would be an HR override' })
  wouldOverride!: boolean;

  @ApiProperty({ description: 'Whether this reader may take it back or ask to cancel it' })
  mayWithdraw!: boolean;

  @ApiProperty({ type: [LeaveWarningDto] })
  warnings!: LeaveWarningDto[];
}

/** A request with everything behind it, for its own page. */
export class LeaveRequestDetailDto extends LeaveRequestDto {
  @ApiProperty({ type: [LeaveCalculationDto] })
  calculations!: LeaveCalculationDto[];

  @ApiProperty({ type: [LeaveDecisionDto] })
  decisions!: LeaveDecisionDto[];

  @ApiProperty({ type: [Object], description: 'The holidays inside the span, for the reader' })
  holidays!: { id: string; date: string; name: string }[];
}

/** A request whose settings have moved under it (HR-02 spec, point 2). */
export class LeaveReviewItemDto {
  @ApiProperty({ type: LeaveRequestDto })
  request!: LeaveRequestDto;

  @ApiProperty({ example: 4.5, description: 'What was agreed' })
  agreed!: number;

  @ApiProperty({ example: 5, description: 'What the settings in force work out as today' })
  now!: number;

  @ApiProperty({
    enum: ['holidays', 'week', 'rule', 'unknown'],
    description: 'What changed, as far as the stored evidence can tell',
  })
  because!: 'holidays' | 'week' | 'rule' | 'unknown';

  @ApiProperty({ description: 'Pending requests are redone; approved ones wait for HR' })
  pending!: boolean;
}

/** Everything one tab of the leave screen draws. */
export class LeaveListDto {
  @ApiProperty({ type: [LeaveRequestDto] })
  requests!: LeaveRequestDto[];

  @ApiProperty({ type: [LeaveReviewItemDto] })
  review!: LeaveReviewItemDto[];

  @ApiProperty({ example: { mine: 2, approvals: 1, all: 14, review: 0 }, type: Object })
  counts!: Record<string, number>;

  @ApiProperty({ description: 'Which tabs this reader may open' })
  tabs!: string[];

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ description: 'Whether this reader has an employee file to ask for leave with' })
  mayRequest!: boolean;
}

/** The leave types somebody may ask for, and what each one needs. */
export class LeaveOptionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ANNUAL' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  allowsHalfDays!: boolean;

  @ApiProperty()
  requiresDocument!: boolean;

  @ApiProperty({ enum: ['working', 'calendar'] })
  dayBasis!: 'working' | 'calendar';

  @ApiProperty({ description: 'Whether the manager’s manager approves it as well' })
  requiresSecondApproval!: boolean;
}

/** What a request would cost, before anybody commits to it. */
export class LeavePreviewDto {
  @ApiProperty({ example: 4.5 })
  dayCount!: number;

  @ApiProperty({ type: [LeaveDayDto] })
  days!: LeaveDayDto[];

  @ApiProperty({ enum: ['working', 'calendar'] })
  dayBasis!: 'working' | 'calendar';

  @ApiPropertyOptional({ example: 'Central kitchen' })
  siteName?: string;

  @ApiProperty({ type: [LeaveWarningDto] })
  warnings!: LeaveWarningDto[];

  @ApiPropertyOptional({ description: 'Set when the request cannot be sent as it stands' })
  blocked?: { kind: string; values: Record<string, string> };
}

/** Asking for leave. */
export class LeaveRequestCreateDto {
  @ApiProperty({ format: 'uuid' })
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-12-07' })
  from!: string;

  @ApiProperty({ example: '2026-12-11' })
  to!: string;

  @ApiPropertyOptional({ enum: ['full', 'morning', 'afternoon'] })
  fromPart?: 'full' | 'morning' | 'afternoon';

  @ApiPropertyOptional({ enum: ['full', 'morning', 'afternoon'] })
  toPart?: 'full' | 'morning' | 'afternoon';

  @ApiPropertyOptional({ description: 'Private, and never put in an e-mail' })
  reason?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'HR asking on somebody else’s behalf. Anyone else may only ask for themselves.',
  })
  employeeId?: string;
}

/** Deciding one. */
export class LeaveDecideDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  decision!: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Required to refuse, and required of any HR override' })
  reason?: string;
}
