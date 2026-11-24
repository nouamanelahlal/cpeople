import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NamedCodeDto } from './employee-list.dto.js';

/** Someone who depends on this person, for the family tab and later for payroll. */
export class DependentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['spouse', 'child'], example: 'child' })
  relation!: string;

  @ApiProperty({ example: 'Yasmine' })
  firstName!: string;

  @ApiProperty({ example: '2019-04-02' })
  birthDate!: string;
}

/**
 * The parts of a file that are nobody's business unless the role says so
 * (HR-01 spec 3.2 and 5).
 *
 * Present in one piece or not at all. A reader who may not see these never
 * receives them — not the value, not a rounded version, not a hint. What they get
 * instead is the list of names in `masked`, which is enough to draw the row and
 * say that something is there.
 */
export class SensitiveEmployeeDto {
  @ApiProperty({ example: '1991-06-14' })
  birthDate!: string;

  @ApiProperty({ example: 'AB123456', description: 'National identifier. Morocco: the CIN.' })
  nationalId!: string;

  @ApiPropertyOptional({ example: '12 rue des Orangers, Casablanca' })
  address?: string;

  @ApiPropertyOptional({
    example: 650_000,
    description:
      'Integer minor units (rule 4). Absent where the reader may not see pay: an ' +
      'employee reading their own file sees it only while the company has the ' +
      'setting on (HR-01 open point 2).',
  })
  baseSalaryMinor?: number;

  @ApiPropertyOptional({ example: 'MAD' })
  salaryCurrency?: string;

  @ApiPropertyOptional({ example: '123456789', description: 'Morocco: the CNSS number' })
  socialSecurityNumber?: string;

  @ApiPropertyOptional({ example: 'Attijariwafa Bank' })
  bankName?: string;

  @ApiPropertyOptional({ example: '007780000123456789012345', description: 'Morocco: the RIB' })
  bankAccount?: string;

  @ApiProperty({ type: [DependentDto] })
  dependents!: DependentDto[];
}

/** One contract in this person's history (HR-01 spec 6.3, tab 5). */
export class ContractSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: NamedCodeDto })
  type!: NamedCodeDto;

  @ApiProperty({ enum: ['draft', 'generated', 'signed', 'renewed', 'ended'] })
  status!: string;

  @ApiProperty({ example: '2026-06-01' })
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  endDate?: string;

  @ApiPropertyOptional({ example: '2026-07-16' })
  trialEndDate?: string;

  @ApiPropertyOptional({ description: 'Only for a reader who may see pay' })
  salaryMinor?: number;

  @ApiPropertyOptional({ example: 'MAD' })
  salaryCurrency?: string;
}

/** What this reader may do with this file. */
export class EmployeeFilePermissionsDto {
  @ApiProperty()
  edit!: boolean;

  @ApiProperty({ description: 'Their own phone, address and e-mail, and nothing else' })
  editOwnContact!: boolean;

  @ApiProperty()
  seeSensitive!: boolean;

  @ApiProperty()
  seeHistory!: boolean;
}

/**
 * One employee's file (HR-01 spec 6.3).
 *
 * Everything the tabs are drawn from, in one answer, because they are one file
 * and a tab is not a reason for a round trip. What is sensitive is in one place
 * and arrives only for a reader allowed it.
 */
export class EmployeeFileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SMG-0001' })
  employeeNumber!: string;

  @ApiProperty({ enum: ['onboarding', 'active', 'left'] })
  status!: 'onboarding' | 'active' | 'left';

  @ApiProperty({ example: 'Salma' })
  firstName!: string;

  @ApiProperty({ example: 'Benali' })
  lastName!: string;

  @ApiProperty({ enum: ['female', 'male', 'unspecified'] })
  gender!: string;

  @ApiProperty({ example: 'MA', description: 'ISO 3166-1 alpha-2' })
  nationality!: string;

  @ApiProperty({ enum: ['single', 'married', 'divorced', 'widowed'] })
  maritalStatus!: string;

  @ApiPropertyOptional({ example: '+212 600 000 000' })
  phone?: string;

  @ApiPropertyOptional({ example: 'salma.benali@smg-demo.test' })
  email?: string;

  @ApiProperty({ type: NamedCodeDto, description: 'Their position: code and title' })
  position!: NamedCodeDto;

  @ApiProperty({ type: NamedCodeDto })
  department!: NamedCodeDto;

  @ApiPropertyOptional({ type: NamedCodeDto })
  site?: NamedCodeDto;

  @ApiPropertyOptional({ type: NamedCodeDto })
  costCentre?: NamedCodeDto;

  @ApiProperty({ description: 'True when the cost centre is not the department’s own' })
  costCentreOverride!: boolean;

  @ApiPropertyOptional({ description: 'Their manager, when they have one and the reader may see them' })
  manager?: { id: string; name: string };

  @ApiProperty({ example: '2021-08-06' })
  hireDate!: string;

  @ApiProperty({ example: '2021-08-06', description: 'What seniority is counted from' })
  seniorityDate!: string;

  @ApiProperty({ example: 63, description: 'Whole months of seniority, as at today' })
  seniorityMonths!: number;

  @ApiPropertyOptional({ example: '2026-10-31' })
  leftOn?: string;

  @ApiProperty({ description: 'Whether the complementary pension scheme applies. Morocco: CIMR.' })
  pensionMember!: boolean;

  @ApiPropertyOptional({ type: SensitiveEmployeeDto })
  sensitive?: SensitiveEmployeeDto;

  @ApiProperty({
    type: [String],
    description: 'The fields withheld from this reader, so the file can say they exist',
  })
  masked!: string[];

  @ApiProperty({ type: [ContractSummaryDto] })
  contracts!: ContractSummaryDto[];

  @ApiProperty({ example: 2, description: 'How many documents are on file' })
  documentCount!: number;

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ type: EmployeeFilePermissionsDto })
  can!: EmployeeFilePermissionsDto;
}

/**
 * A change to one field, as the trail records it (HR-01 spec 6.11).
 *
 * `from` and `to` are text, because that is what a history entry is read as; the
 * values are masked for a reader who may not see the field, so the entry still
 * says *that* a salary changed without saying what it changed to.
 */
export class AuditDiffDto {
  @ApiProperty({ example: 'baseSalaryMinor' })
  field!: string;

  @ApiProperty({ example: '650000' })
  from!: string;

  @ApiProperty({ example: '700000' })
  to!: string;

  @ApiProperty({ description: 'Whether these two values are the mask and not the values' })
  masked!: boolean;
}

export class AuditEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-11-23T09:12:00.000Z' })
  at!: string;

  @ApiPropertyOptional({ example: 'Salma Benali' })
  actorName?: string;

  @ApiPropertyOptional({ enum: ['admin', 'hr', 'manager', 'employee'] })
  actorRole?: string;

  @ApiProperty({ example: 'employee.updated' })
  action!: string;

  @ApiProperty({ example: 'Salma Benali' })
  summary!: string;

  @ApiProperty({ type: [AuditDiffDto] })
  diff!: AuditDiffDto[];
}

/**
 * What may be changed on a file, and by whom (HR-01 spec 6.3).
 *
 * Only these names are read off the body: anything else sent is ignored rather
 * than refused, so a field that is not editable cannot be edited by naming it.
 */
export class EmployeeEditDto {
  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional({ enum: ['single', 'married', 'divorced', 'widowed'] })
  maritalStatus?: string;

  @ApiPropertyOptional({ description: 'National identifier. Morocco: the CIN.' })
  nationalId?: string;

  @ApiPropertyOptional({ description: 'Integer minor units (rule 4)' })
  baseSalaryMinor?: number;

  @ApiPropertyOptional()
  socialSecurityNumber?: string;

  @ApiPropertyOptional()
  pensionMember?: boolean;

  @ApiPropertyOptional()
  bankName?: string;

  @ApiPropertyOptional()
  bankAccount?: string;
}
