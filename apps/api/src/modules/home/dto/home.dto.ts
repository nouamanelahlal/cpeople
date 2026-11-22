import { ApiProperty } from '@nestjs/swagger';

/** One figure on the home screen, with the sentence that explains it. */
export class HomeFigureDto {
  @ApiProperty({ example: 148 })
  value!: number;

  @ApiProperty({ required: false, example: 42, description: 'The second number, where there is one' })
  of?: number;
}

export class HomeDepartmentDto {
  @ApiProperty({ example: 'KIT' })
  code!: string;

  @ApiProperty({ example: 'Kitchen' })
  name!: string;

  @ApiProperty({ example: 46 })
  count!: number;
}

/** Something this person has to deal with, and where it is (HR-01 spec 6.12). */
export class HomeTaskDto {
  @ApiProperty({
    enum: ['contractEnding', 'onboardingOverdue', 'documentExpired'],
    description: 'What kind of thing is waiting',
  })
  kind!: 'contractEnding' | 'onboardingOverdue' | 'documentExpired';

  @ApiProperty({ format: 'uuid' })
  employeeId!: string;

  @ApiProperty({ example: 'Omar Chraibi' })
  employeeName!: string;

  @ApiProperty({ required: false, description: 'The date the item turns on, as a plain date' })
  date?: string;

  @ApiProperty({ required: false, example: 'Medical aptitude certificate' })
  detail?: string;

  @ApiProperty({ required: false, example: 7, description: 'Days until the date, negative when past' })
  days?: number;
}

/**
 * Everything the home screen draws, for the person asking (HR-01 / M03).
 *
 * Counts are over the files this person may see: HR sees the company, a manager
 * sees their own branch of it. No sensitive field is in here at all — the home
 * screen shows how many and who, never how much.
 */
export class HomeSummaryDto {
  @ApiProperty({ example: '2026-11-23', description: 'The day the figures are as at' })
  today!: string;

  @ApiProperty({ required: false, example: 'Independence Day' })
  holiday?: string;

  @ApiProperty({ type: HomeFigureDto })
  headcount!: HomeFigureDto;

  @ApiProperty({ example: 12, description: 'How many of them are on a fixed term' })
  fixedTerm!: number;

  @ApiProperty({ example: 3 })
  joinedThisMonth!: number;

  @ApiProperty({ example: 1 })
  leftThisMonth!: number;

  @ApiProperty({ type: HomeFigureDto, description: 'Documents expiring within the alert window' })
  documentsExpiring!: HomeFigureDto;

  @ApiProperty({ example: 2, description: 'People in onboarding' })
  onboarding!: number;

  @ApiProperty({ example: 5, description: 'Onboarding tasks already past their date' })
  onboardingOverdue!: number;

  @ApiProperty({ example: 1, description: 'Fixed terms ending within 30 days' })
  contractsEnding!: number;

  @ApiProperty({ type: [HomeDepartmentDto] })
  departments!: HomeDepartmentDto[];

  @ApiProperty({ type: [HomeTaskDto] })
  waiting!: HomeTaskDto[];
}
