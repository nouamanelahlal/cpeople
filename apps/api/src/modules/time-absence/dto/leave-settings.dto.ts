import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** What a leave type is worth from a date (HR-02 spec, M08). */
export class LeaveRuleDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-01-01' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  effectiveTo?: string;

  @ApiPropertyOptional({ example: 18, description: 'Days a full year gives' })
  entitlementDays?: number;

  @ApiPropertyOptional({ example: 1.5 })
  accrualPerMonth?: number;

  @ApiPropertyOptional({ example: 18 })
  carryOverMaxDays?: number;

  @ApiProperty({ example: 7, description: 'Days of notice expected. A warning, never a refusal.' })
  minNoticeDays!: number;

  @ApiProperty({ example: 30, description: 'How far back a request of this kind may be dated' })
  maxBackdateDays!: number;

  @ApiPropertyOptional({ example: 'Demo value, to be confirmed by the payroll expert.' })
  note?: string;

  @ApiProperty({ description: 'False until the client and the payroll expert have said yes' })
  confirmed!: boolean;
}

/** A kind of absence, with the rule in force today. */
export class LeaveTypeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ANNUAL' })
  code!: string;

  @ApiProperty({ example: 'Congé annuel', description: 'Shown when the screens do not know the code' })
  name!: string;

  @ApiProperty()
  paid!: boolean;

  @ApiProperty()
  requiresDocument!: boolean;

  @ApiProperty({ enum: ['working', 'calendar'] })
  dayBasis!: 'working' | 'calendar';

  @ApiProperty()
  allowsHalfDays!: boolean;

  @ApiProperty({ description: 'Whether the manager’s manager approves it as well' })
  requiresSecondApproval!: boolean;

  @ApiProperty({ description: 'Whether it draws on a balance at all' })
  tracksBalance!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional({ type: LeaveRuleDto, description: 'The rule in force today' })
  rule?: LeaveRuleDto;

  @ApiProperty({ type: [LeaveRuleDto], description: 'Every rule, newest first' })
  rules!: LeaveRuleDto[];
}

/** Which days a site works, from a date. */
export class WorkWeekDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: { code: 'OUTLET', name: 'Outlet' } })
  site!: { id: string; code: string; name: string };

  @ApiProperty({ example: [1, 2, 3, 4, 5, 6], description: '0 is Sunday, 6 is Saturday' })
  workingDays!: number[];

  @ApiProperty({ example: '2026-01-01' })
  effectiveFrom!: string;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty()
  confirmed!: boolean;
}

export class PublicHolidayDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-11-18' })
  date!: string;

  @ApiProperty({ example: 'Independence Day' })
  name!: string;

  @ApiProperty({ example: 'MA' })
  countryCode!: string;

  @ApiProperty()
  confirmed!: boolean;

  @ApiPropertyOptional()
  note?: string;
}

/** The decisions that belong to the company rather than to one leave type. */
export class LeavePolicyDto {
  @ApiProperty({ example: 33, description: 'Warn above this share of a department off at once' })
  teamOffWarningPercent!: number;

  @ApiProperty({ example: '01-01', description: 'The day the leave year starts, as MM-DD' })
  leaveYearStart!: string;

  @ApiPropertyOptional()
  note?: string;
}

/** Everything the leave set-up screen draws, in one answer. */
export class LeaveSettingsDto {
  @ApiProperty({ type: [LeaveTypeDto] })
  types!: LeaveTypeDto[];

  @ApiProperty({ type: [WorkWeekDto] })
  workWeeks!: WorkWeekDto[];

  @ApiProperty({ type: [PublicHolidayDto], description: 'The year asked for' })
  holidays!: PublicHolidayDto[];

  @ApiProperty({ example: [2026, 2027], description: 'Years that have holidays on file' })
  holidayYears!: number[];

  @ApiProperty({ example: 2026 })
  year!: number;

  @ApiProperty({ type: LeavePolicyDto })
  policy!: LeavePolicyDto;

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ description: 'Whether this reader may change any of it' })
  mayManage!: boolean;
}

/** Changing what a leave type *is*. Only the switches, never its code. */
export class LeaveTypeEditDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  paid?: boolean;

  @ApiPropertyOptional()
  requiresDocument?: boolean;

  @ApiPropertyOptional({ enum: ['working', 'calendar'] })
  dayBasis?: 'working' | 'calendar';

  @ApiPropertyOptional()
  allowsHalfDays?: boolean;

  @ApiPropertyOptional()
  requiresSecondApproval?: boolean;

  @ApiPropertyOptional()
  tracksBalance?: boolean;

  @ApiPropertyOptional()
  active?: boolean;
}

/**
 * A new rule for a leave type, from a date.
 *
 * Never an edit of an existing row: a parameter that changes keeps its history,
 * so a balance calculated last year can still be explained.
 */
export class LeaveRuleCreateDto {
  @ApiProperty({ example: '2027-01-01' })
  effectiveFrom!: string;

  @ApiPropertyOptional({ example: 21 })
  entitlementDays?: number | null;

  @ApiPropertyOptional({ example: 1.75 })
  accrualPerMonth?: number | null;

  @ApiPropertyOptional({ example: 10 })
  carryOverMaxDays?: number | null;

  @ApiPropertyOptional({ example: 7 })
  minNoticeDays?: number;

  @ApiPropertyOptional({ example: 0 })
  maxBackdateDays?: number;

  @ApiPropertyOptional({ example: 'Agreed with SMG at the HR-02 workshop.' })
  note?: string;

  @ApiPropertyOptional({ description: 'Set when the client and the payroll expert have said yes' })
  confirmed?: boolean;
}

export class WorkWeekCreateDto {
  @ApiProperty({ example: 'OUTLET' })
  siteCode!: string;

  @ApiProperty({ example: [1, 2, 3, 4, 5, 6] })
  workingDays!: number[];

  @ApiProperty({ example: '2027-01-01' })
  effectiveFrom!: string;

  @ApiPropertyOptional()
  note?: string;

  @ApiPropertyOptional()
  confirmed?: boolean;
}

export class HolidayCreateDto {
  @ApiProperty({ example: '2027-03-20' })
  date!: string;

  @ApiProperty({ example: 'Aid Al Fitr' })
  name!: string;

  @ApiPropertyOptional({ example: 'MA' })
  countryCode?: string;

  @ApiPropertyOptional()
  confirmed?: boolean;
}

export class LeavePolicyEditDto {
  @ApiPropertyOptional({ example: 40 })
  teamOffWarningPercent?: number;

  @ApiPropertyOptional({ example: '01-01' })
  leaveYearStart?: string;
}
