import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A cost centre, and what hangs off it (HR-01 spec 6.5). */
export class CostCentreDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CC-KIT' })
  code!: string;

  @ApiProperty({ example: 'Kitchen' })
  name!: string;

  @ApiPropertyOptional({
    description: 'The code Finance uses in SAP. Empty until the two are mapped.',
  })
  sapCostCentre?: string;

  @ApiProperty({ example: 1 })
  departmentCount!: number;

  @ApiProperty({ example: 46 })
  employeeCount!: number;
}

export class SiteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CASA-KIT' })
  code!: string;

  @ApiProperty({ example: 'Central kitchen' })
  name!: string;

  @ApiPropertyOptional({ example: 'Casablanca' })
  city?: string;
}

/** A department, with what it costs against and who heads it. */
export class DepartmentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'KIT' })
  code!: string;

  @ApiProperty({ example: 'Kitchen' })
  name!: string;

  @ApiPropertyOptional({ type: SiteDto })
  site?: SiteDto;

  @ApiPropertyOptional({ type: CostCentreDto })
  costCentre?: CostCentreDto;

  @ApiPropertyOptional({ description: 'Who heads it, where somebody does' })
  head?: { id: string; name: string };

  @ApiProperty({ example: 46, description: 'People on the books in it' })
  headcount!: number;

  @ApiProperty({
    example: 2,
    description: 'People in it whose cost centre is not the department’s',
  })
  overrides!: number;
}

export class PositionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'KIT-STAFF' })
  code!: string;

  @ApiProperty({ example: 'Kitchen team member' })
  title!: string;

  @ApiProperty({ example: 'Kitchen' })
  department!: string;

  @ApiPropertyOptional({ example: 'Kitchen supervisor' })
  reportsTo?: string;

  @ApiPropertyOptional({ example: 40 })
  plannedHeadcount?: number;

  @ApiProperty({ example: 38, description: 'How many of them are filled' })
  filled!: number;
}

/**
 * The company's own shape (HR-01 spec 6.5).
 *
 * One answer for all three tables and the mapping view, because they are one
 * question — how this company is arranged — and a screen with three tabs should
 * not be three round trips.
 */
export class OrganisationDto {
  @ApiProperty({ type: [DepartmentDto] })
  departments!: DepartmentDto[];

  @ApiProperty({ type: [PositionDto] })
  positions!: PositionDto[];

  @ApiProperty({ type: [CostCentreDto] })
  costCentres!: CostCentreDto[];

  @ApiProperty({ type: [SiteDto] })
  sites!: SiteDto[];

  @ApiProperty({ description: 'Whether this reader may change any of it' })
  mayManage!: boolean;
}

/** A change to one department. Only what is sent is changed. */
export class DepartmentEditDto {
  @ApiPropertyOptional({ example: 'Kitchen' })
  name?: string;

  @ApiPropertyOptional({ example: 'CC-KIT', description: 'The cost centre it costs against' })
  costCentreCode?: string;

  @ApiPropertyOptional({ example: 'CASA-KIT' })
  siteCode?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Who heads it; empty clears it' })
  headEmployeeId?: string;

  @ApiPropertyOptional({
    description:
      'Whether the people in it follow the new cost centre. Only those without one of their own do.',
  })
  applyToEmployees?: boolean;
}

/** What changing a department did. */
export class DepartmentChangedDto {
  @ApiProperty({ type: DepartmentDto })
  department!: DepartmentDto;

  @ApiProperty({ example: 46, description: 'How many people followed the new cost centre' })
  employeesMoved!: number;
}
