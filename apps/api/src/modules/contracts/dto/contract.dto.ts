import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** One contract, as a list row (HR-01 spec 6.6). */
export class ContractRowDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: { id: '…', name: 'Omar Chraibi', employeeNumber: 'SMG-0009' } })
  employee!: { id: string; name: string; employeeNumber: string };

  @ApiProperty({ example: { code: 'CDD', name: 'Contrat à durée déterminée' } })
  type!: { code: string; name: string };

  @ApiProperty({ enum: ['draft', 'generated', 'signed', 'renewed', 'ended'] })
  status!: string;

  @ApiProperty({ example: '2026-06-01' })
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-11-30' })
  endDate?: string;

  @ApiPropertyOptional({ example: 7, description: 'Days until it ends; negative once it has' })
  daysLeft?: number;

  @ApiPropertyOptional({ example: '2026-07-16' })
  trialEndDate?: string;

  @ApiPropertyOptional({ example: 'end-of-term' })
  endReason?: string;

  @ApiPropertyOptional()
  generatedAt?: string;

  @ApiPropertyOptional()
  signedAt?: string;
}

export class ContractListDto {
  @ApiProperty({ type: [ContractRowDto] })
  rows!: ContractRowDto[];

  @ApiProperty({ example: [{ code: 'CDD', name: 'Contrat à durée déterminée' }] })
  types!: { code: string; name: string }[];

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ description: 'Whether this reader may generate, sign, renew or end one' })
  mayManage!: boolean;
}

/** One clause of the template, and whether it is going into this document. */
export class ContractClauseDto {
  @ApiProperty({ example: 'non-compete' })
  key!: string;

  @ApiProperty({ example: 'Article 7 – Non-concurrence' })
  title!: string;

  @ApiProperty({ description: 'Mandatory clauses cannot be left out' })
  mandatory!: boolean;

  @ApiProperty()
  chosen!: boolean;

  @ApiProperty({ description: 'The text, with its merge fields still in it' })
  text!: string;
}

/** What the document would say, before it is printed (spec 6.6 step 1). */
export class ContractPreviewDto {
  @ApiProperty({ type: ContractRowDto })
  contract!: ContractRowDto;

  @ApiProperty({ example: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE' })
  title!: string;

  @ApiProperty({ example: [{ field: 'employee.fullName', value: 'Omar Chraibi' }] })
  fields!: { field: string; value: string }[];

  @ApiProperty({
    type: [String],
    description: 'Fields the template asks for that this file cannot answer',
  })
  missing!: string[];

  @ApiProperty({ type: [ContractClauseDto] })
  clauses!: ContractClauseDto[];

  @ApiProperty({ example: 'Contrat_CDD_SMG-0009_20261123.pdf' })
  fileName!: string;

  @ApiProperty({ description: 'Whether this reader may generate, sign, renew or end it' })
  mayManage!: boolean;
}

export class RenewContractDto {
  @ApiProperty({ example: '2027-05-31', description: 'When the new term ends' })
  endDate!: string;
}

export class EndContractDto {
  @ApiProperty({ example: '2026-11-30' })
  endDate!: string;

  @ApiPropertyOptional({
    enum: ['end-of-term', 'resignation', 'dismissal', 'other'],
    example: 'end-of-term',
  })
  reason?: string;
}
