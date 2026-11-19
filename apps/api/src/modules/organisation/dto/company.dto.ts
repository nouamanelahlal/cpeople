import { ApiProperty } from '@nestjs/swagger';

/** A legal entity inside the tenant (M01 / IMP-01). */
export class CompanyDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'SMG Demo Morocco' })
  name!: string;

  @ApiProperty({ example: 'SMG Demo Morocco SARL' })
  legalName!: string;

  @ApiProperty({
    description: 'ISO 4217 currency of the amounts this company owns',
    example: 'MAD',
  })
  defaultCurrency!: string;
}
