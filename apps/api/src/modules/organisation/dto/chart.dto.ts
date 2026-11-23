import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One person on the chart, and everyone who reports to them (spec 6.9). */
export class ChartNodeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Rachid Kettani' })
  name!: string;

  @ApiProperty({ example: 'RK' })
  initials!: string;

  @ApiProperty({ example: 'Head of kitchen' })
  position!: string;

  @ApiProperty({ example: { code: 'KIT', name: 'Kitchen' } })
  department!: { code: string; name: string };

  @ApiProperty({ enum: ['onboarding', 'active', 'left'] })
  status!: string;

  @ApiProperty({ example: 3, description: 'How many report directly to them' })
  reports!: number;

  @ApiProperty({ type: [ChartNodeDto] })
  children!: ChartNodeDto[];
}

/** The chart, over the files this reader may see. */
export class ChartDto {
  @ApiProperty({ type: [ChartNodeDto], description: 'Everyone with no visible manager above them' })
  roots!: ChartNodeDto[];

  @ApiProperty({ example: 148 })
  total!: number;

  @ApiProperty({ example: [{ code: 'KIT', name: 'Kitchen' }] })
  departments!: { code: string; name: string }[];

  @ApiPropertyOptional({ example: 'KIT', description: 'The department being looked at' })
  department?: string;

  @ApiProperty({
    enum: ['all', 'team', 'own'],
    description: 'How much of the company this reader is being shown',
  })
  scope!: 'all' | 'team' | 'own';
}
