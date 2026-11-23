import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Someone who will depend on this person, collected while hiring them. */
export class NewDependentDto {
  @ApiProperty({ enum: ['spouse', 'child'] })
  relation!: string;

  @ApiProperty({ example: 'Yasmine' })
  firstName!: string;

  @ApiProperty({ example: '2019-04-02' })
  birthDate!: string;
}

/**
 * A new employee, as the hire wizard sends them (HR-01 spec 6.4).
 *
 * One request at the end rather than one per step: until the last screen nothing
 * has been decided, and a half-created person in the database is worse than a
 * draft in a browser.
 */
export class HireDto {
  @ApiProperty({ example: 'Youssef' })
  firstName!: string;

  @ApiProperty({ example: 'Idrissi' })
  lastName!: string;

  @ApiPropertyOptional({ enum: ['female', 'male', 'unspecified'] })
  gender?: string;

  @ApiProperty({ example: '1998-03-14' })
  birthDate!: string;

  @ApiPropertyOptional({ example: 'MA' })
  nationality?: string;

  @ApiProperty({ example: 'AB123456', description: 'National identifier. Morocco: the CIN.' })
  nationalId!: string;

  @ApiPropertyOptional({ enum: ['single', 'married', 'divorced', 'widowed'] })
  maritalStatus?: string;

  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiProperty({ example: 'KIT-STAFF', description: 'The position, by its code' })
  positionCode!: string;

  @ApiPropertyOptional({ example: 'CASA-KIT' })
  siteCode?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Who they report to' })
  managerId?: string;

  @ApiProperty({ example: '2026-12-01' })
  hireDate!: string;

  @ApiProperty({ example: 650_000, description: 'Integer minor units (rule 4)' })
  baseSalaryMinor!: number;

  @ApiPropertyOptional({ description: 'Morocco: the CNSS number. Empty while affiliation is pending.' })
  socialSecurityNumber?: string;

  @ApiPropertyOptional()
  pensionMember?: boolean;

  @ApiPropertyOptional()
  bankName?: string;

  @ApiPropertyOptional()
  bankAccount?: string;

  @ApiPropertyOptional({ type: [NewDependentDto] })
  dependents?: NewDependentDto[];

  @ApiProperty({ example: 'CDD', description: 'The kind of contract, by its code' })
  contractTypeCode!: string;

  @ApiPropertyOptional({ example: '2027-05-31', description: 'Required when the kind demands one' })
  contractEndDate?: string;

  @ApiPropertyOptional({ example: '2027-01-15' })
  trialEndDate?: string;
}

/** What the wizard needs to offer, and what it must not let through. */
export class HireOptionsDto {
  @ApiProperty({ example: [{ code: 'KIT-STAFF', title: 'Kitchen team member', department: 'Kitchen', departmentCode: 'KIT' }] })
  positions!: {
    code: string;
    title: string;
    department: string;
    departmentCode: string;
    siteCode?: string;
  }[];

  @ApiProperty({ example: [{ code: 'CASA-KIT', name: 'Central kitchen' }] })
  sites!: { code: string; name: string }[];

  @ApiProperty({
    example: [{ code: 'CDD', name: 'Fixed-term contract', requiresEndDate: true, defaultTrialDays: 45 }],
  })
  contractTypes!: {
    code: string;
    name: string;
    requiresEndDate: boolean;
    defaultTrialDays?: number;
  }[];

  @ApiProperty({ example: [{ id: '…', name: 'Rachid Kettani', departmentCode: 'KIT' }] })
  managers!: { id: string; name: string; departmentCode: string }[];

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ example: 'SMG-0150', description: 'The number this person would be given' })
  nextEmployeeNumber!: string;
}

/** The person just created, and what was set up with them. */
export class HiredDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SMG-0150' })
  employeeNumber!: string;

  @ApiProperty({ example: 'Youssef Idrissi' })
  name!: string;

  @ApiProperty({ example: 8, description: 'Onboarding tasks created from the checklist' })
  tasks!: number;

  @ApiProperty({ format: 'uuid', description: 'The draft contract waiting to be generated' })
  contractId!: string;
}
