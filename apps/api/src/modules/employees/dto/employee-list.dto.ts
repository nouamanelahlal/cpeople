import { ApiProperty } from '@nestjs/swagger';

/** A code and the name it is shown by, for a column or a filter. */
export class NamedCodeDto {
  @ApiProperty({ example: 'KIT' })
  code!: string;

  @ApiProperty({ example: 'Kitchen' })
  name!: string;
}

export class FilterChoiceDto extends NamedCodeDto {
  @ApiProperty({ example: 46, description: 'How many of the visible files are in it' })
  count!: number;
}

/**
 * One row of the employee list (HR-01 spec 6.2).
 *
 * Nothing sensitive is in it. The list shows who someone is and where they work;
 * their pay, their identifiers, their address and who depends on them are on
 * their file, for the roles allowed them. A field the reader may not see is not
 * in the row at all, so there is nothing to mask and nothing to leak — not in the
 * page, not in a search result, not in an export.
 */
export class EmployeeRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SMG-0042' })
  employeeNumber!: string;

  @ApiProperty({ example: 'Salma Benali' })
  name!: string;

  @ApiProperty({ example: 'SB' })
  initials!: string;

  @ApiProperty({ example: 'Chef de partie' })
  position!: string;

  @ApiProperty({ type: NamedCodeDto })
  department!: NamedCodeDto;

  @ApiProperty({ type: NamedCodeDto, required: false })
  site?: NamedCodeDto;

  @ApiProperty({ type: NamedCodeDto, required: false, description: 'The current contract, where there is one' })
  contractType?: NamedCodeDto;

  @ApiProperty({ required: false, example: '2026-11-30', description: 'When the contract runs out' })
  contractEnd?: string;

  @ApiProperty({ enum: ['onboarding', 'active', 'left'] })
  status!: 'onboarding' | 'active' | 'left';

  @ApiProperty({ example: '2024-03-01' })
  hireDate!: string;

  @ApiProperty({
    enum: ['ok', 'expiring', 'expired'],
    description: 'The state of the papers in this file: the soonest expiry decides',
  })
  documents!: 'ok' | 'expiring' | 'expired';
}

/** What can be filtered by, with how many files each choice holds. */
export class EmployeeFacetsDto {
  @ApiProperty({ type: [FilterChoiceDto] })
  departments!: FilterChoiceDto[];

  @ApiProperty({ type: [FilterChoiceDto] })
  sites!: FilterChoiceDto[];

  @ApiProperty({ type: [FilterChoiceDto] })
  contractTypes!: FilterChoiceDto[];
}

/**
 * The employee list, over the files the person asking may see (HR-01 spec 6.2).
 *
 * A manager's list is their own branch; HR's is the company. The total is the
 * total of what they may see, so the figure on the home screen and the length of
 * this list are the same answer to the same question.
 */
export class EmployeeListDto {
  @ApiProperty({ type: [EmployeeRowDto] })
  rows!: EmployeeRowDto[];

  @ApiProperty({ example: 148, description: 'Matching files, before paging' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;

  @ApiProperty({ example: 6 })
  pages!: number;

  @ApiProperty({ example: 148, description: 'Visible files before any filter, for an empty state' })
  visible!: number;

  @ApiProperty({ type: EmployeeFacetsDto })
  facets!: EmployeeFacetsDto;

  @ApiProperty({ example: '2026-11-23', description: 'The day the dates are judged against' })
  today!: string;

  @ApiProperty({ description: 'Whether this person may search by national identifier' })
  searchesIdentifiers!: boolean;

  @ApiProperty({ description: 'Whether this person may add a file' })
  mayCreate!: boolean;

  @ApiProperty({ description: 'Whether this person may download the list' })
  mayExport!: boolean;
}
