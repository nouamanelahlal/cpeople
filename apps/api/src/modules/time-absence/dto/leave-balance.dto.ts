import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** What a balance is made of, line by line (M09 / HR-04). */
export class BalanceFiguresDto {
  @ApiProperty({ example: 4, description: 'Brought in from before CPeople' })
  opening!: number;

  @ApiProperty({ example: 2, description: 'Carried from last year, still in date' })
  carried!: number;

  @ApiProperty({ example: 0, description: 'Carried days that have since run out' })
  carriedExpired!: number;

  @ApiProperty({ example: 15, description: 'Earned so far this year' })
  accrued!: number;

  @ApiProperty({ example: 7 })
  taken!: number;

  @ApiProperty({ example: 2.5, description: 'On requests nobody has decided yet' })
  pending!: number;

  @ApiProperty({ example: 1, description: 'HR’s adjustments, signed' })
  adjusted!: number;

  @ApiProperty({ example: 12.5, description: 'What is left. May be negative.' })
  remaining!: number;

  @ApiProperty({ example: 10, description: 'Whole accrual periods earned' })
  periodsEarned!: number;
}

export class BalanceLineDto {
  @ApiProperty({ example: { id: '…', code: 'ANNUAL', name: 'Congé annuel' } })
  leaveType!: { id: string; code: string; name: string; tracksBalance: boolean };

  @ApiPropertyOptional({ example: 18 })
  entitlementDays?: number;

  @ApiPropertyOptional({ example: 1.5 })
  accrualPerMonth?: number;

  @ApiProperty({ type: BalanceFiguresDto })
  balance!: BalanceFiguresDto;

  @ApiProperty({ example: { from: '2026-01-01', to: '2026-12-31' } })
  year!: { from: string; to: string };

  @ApiPropertyOptional({ example: '2027-03-31' })
  carriedExpiresOn?: string;
}

export class BalanceStatementDto {
  @ApiProperty()
  employee!: { id: string; name: string; number: string; department: string };

  @ApiProperty({ type: [BalanceLineDto] })
  lines!: BalanceLineDto[];
}

/** One thing that moved a balance, for the history. */
export class BalanceHistoryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['opening', 'carried', 'adjustment', 'taken'] })
  kind!: 'opening' | 'carried' | 'adjustment' | 'taken';

  @ApiProperty()
  leaveType!: { code: string; name: string };

  @ApiProperty({ example: -4.5, description: 'Signed: days in or days out' })
  days!: number;

  @ApiProperty({ example: '2026-07-06' })
  on!: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  by?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  requestId?: string;
}

/** The balances screen: one row per person, with their lines. */
export class BalanceListDto {
  @ApiProperty({ type: [BalanceStatementDto] })
  employees!: BalanceStatementDto[];

  @ApiProperty({ example: ['ANNUAL'], description: 'The types with a balance, in order' })
  types!: { id: string; code: string; name: string }[];

  @ApiProperty({ example: 148 })
  total!: number;

  @ApiProperty({ description: 'Whether this reader may adjust, import or run year-end' })
  mayManage!: boolean;

  @ApiProperty({ example: '2026-11-23' })
  today!: string;
}

export class AdjustBalanceDto {
  @ApiProperty({ format: 'uuid' })
  employeeId!: string;

  @ApiProperty({ format: 'uuid' })
  leaveTypeId!: string;

  @ApiProperty({ example: -2.5, description: 'Signed. Zero is refused.' })
  days!: number;

  @ApiProperty({ example: 'Agreed with the employee after the August rota change.' })
  reason!: string;

  @ApiPropertyOptional({ example: '2026-11-23' })
  effectiveOn?: string;
}

/** A row a trial import would write. */
export class ImportAcceptedDto {
  @ApiProperty({ example: 7 })
  line!: number;

  @ApiProperty({ example: 'Karim Alaoui' })
  employee!: string;

  @ApiProperty({ example: 'SMG-0003' })
  employeeNumber!: string;

  @ApiProperty({ example: 'ANNUAL' })
  leaveType!: string;

  @ApiProperty({ example: 12.5 })
  days!: number;

  @ApiProperty({ example: '2025-12-31' })
  balanceAt!: string;
}

export class ImportProblemDto {
  @ApiProperty({ example: 9 })
  line!: number;

  @ApiProperty({
    enum: ['unknownEmployee', 'unknownType', 'notANumber', 'notADate', 'futureDate', 'duplicate', 'missing'],
  })
  kind!: string;

  @ApiProperty({ example: 'SMG-9999' })
  value!: string;
}

export class ImportReportDto {
  @ApiProperty({ type: [ImportAcceptedDto] })
  accepted!: ImportAcceptedDto[];

  @ApiProperty({ type: [ImportProblemDto] })
  problems!: ImportProblemDto[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ description: 'True only once the rows have actually been written' })
  applied!: boolean;
}

export class CarryOverLineDto {
  @ApiProperty()
  employee!: { id: string; name: string; number: string };

  @ApiProperty()
  leaveType!: { id: string; code: string; name: string };

  @ApiProperty({ example: 11.5, description: 'What was left when the year ended' })
  leftOver!: number;

  @ApiProperty({ example: 6, description: 'What survives the rule' })
  days!: number;

  @ApiProperty({ enum: ['all', 'limited', 'none'] })
  mode!: string;

  @ApiPropertyOptional({ example: '2027-03-31' })
  expiresOn?: string;
}

export class CarryOverResultDto {
  @ApiProperty({ format: 'uuid' })
  runId!: string;

  @ApiProperty({ example: 2026 })
  fromYear!: number;

  @ApiProperty({ example: 2027 })
  toYear!: number;

  @ApiProperty({ enum: ['preview', 'applied'] })
  status!: string;

  @ApiProperty({ example: 148 })
  employees!: number;

  @ApiProperty({ example: 612.5 })
  carried!: number;

  @ApiProperty({ example: 41, description: 'Days that do not survive the rule' })
  lost!: number;

  @ApiProperty({ type: [CarryOverLineDto] })
  lines!: CarryOverLineDto[];
}

/** What a payroll month is told about absence (M09 → M10). */
export class AbsenceLineDto {
  @ApiProperty()
  leaveType!: { id: string; code: string; name: string };

  @ApiProperty()
  paid!: boolean;

  @ApiProperty({ example: 4.5 })
  days!: number;

  @ApiProperty({ type: [String] })
  requestIds!: string[];
}

export class CorrectionLineDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  leaveType!: { id: string; code: string; name: string };

  @ApiProperty()
  paid!: boolean;

  @ApiProperty({ example: -1, description: 'Signed difference carried from a closed month' })
  days!: number;

  @ApiProperty({ example: '2026-10' })
  originalMonth!: string;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;

  @ApiProperty()
  reason!: string;
}

export class EmployeeAbsencesDto {
  @ApiProperty()
  employee!: { id: string; number: string; name: string };

  @ApiProperty({ type: [AbsenceLineDto] })
  lines!: AbsenceLineDto[];

  @ApiProperty({ type: [CorrectionLineDto] })
  corrections!: CorrectionLineDto[];

  @ApiProperty({ example: 4.5 })
  totalDays!: number;
}

export class PeriodAbsencesDto {
  @ApiProperty({ example: '2026-12' })
  period!: string;

  @ApiProperty({ enum: ['open', 'locked', 'unknown'] })
  status!: string;

  @ApiProperty({ type: [EmployeeAbsencesDto] })
  employees!: EmployeeAbsencesDto[];
}
