import { ApiProperty } from '@nestjs/swagger';

/** The signed-in user, as the token describes them (M02). */
export class MeDto {
  @ApiProperty({ example: 'Pierre Paie' })
  name!: string;

  @ApiProperty({ example: 'payroll@smg-demo.test' })
  email!: string;

  @ApiProperty({ example: ['payroll-manager', 'mfa-required'], isArray: true, type: String })
  roles!: string[];

  @ApiProperty({ description: 'Tenant the token places this user in', format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ description: 'Keycloak organisation alias for that tenant', example: 'smg-demo' })
  organization!: string;

  @ApiProperty({ required: false, example: 'fr', description: 'Language chosen in Keycloak' })
  locale?: string;

  @ApiProperty({
    description: 'The CPeople role this person acts in, from their realm roles',
    example: 'hr',
    enum: ['admin', 'hr', 'manager', 'employee'],
  })
  role!: string;

  @ApiProperty({
    description: 'What that role may do. The API enforces it; this is so the UI can draw it',
    isArray: true,
    type: String,
    example: ['employee.list.all', 'employee.sensitive.read'],
  })
  capabilities!: string[];

  @ApiProperty({
    required: false,
    format: 'uuid',
    description: 'Their own employee file, when the e-mail in the token matches one',
  })
  employeeId?: string;
}
