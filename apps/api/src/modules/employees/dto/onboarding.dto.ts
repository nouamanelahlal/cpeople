import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One thing that has to happen before somebody starts (spec 6.8). */
export class OnboardingTaskDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Collect the identity document' })
  title!: string;

  @ApiProperty({ enum: ['admin', 'hr', 'manager', 'employee'] })
  ownerRole!: string;

  @ApiProperty({ example: '2026-11-28' })
  dueDate!: string;

  @ApiProperty({ example: 5, description: 'Days until it is due; negative once it is late' })
  daysLeft!: number;

  @ApiProperty({ enum: ['todo', 'done'] })
  status!: string;

  @ApiProperty({ description: 'Whether the file cannot be made active without it' })
  mandatory!: boolean;

  @ApiPropertyOptional({ example: '2026-11-23T09:12:00.000Z' })
  doneAt?: string;

  @ApiPropertyOptional({ example: 'Salma Benali' })
  doneBy?: string;

  @ApiProperty({ description: 'Whether this task is this reader’s to tick' })
  mayTick!: boolean;
}

/** The onboarding of one person. */
export class OnboardingDto {
  @ApiProperty({ enum: ['onboarding', 'active', 'left'] })
  status!: string;

  @ApiProperty({ example: '2026-12-01' })
  hireDate!: string;

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ type: [OnboardingTaskDto] })
  tasks!: OnboardingTaskDto[];

  @ApiProperty({ example: 3 })
  done!: number;

  @ApiProperty({ example: 8 })
  total!: number;

  @ApiProperty({ description: 'Whether everything that must happen has, and this reader may say so' })
  mayActivate!: boolean;
}
