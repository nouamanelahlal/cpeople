import { Controller, Get } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TENANT_HEADER } from '../../common/tenant/tenant.middleware.js';
import { CompanyDto } from './dto/company.dto.js';
import { OrganisationService } from './organisation.service.js';

@ApiTags('organisation')
@ApiHeader({
  name: TENANT_HEADER,
  required: true,
  description: 'Tenant of the request. Temporary: replaced by the session token (M02).',
})
@Controller('organisation')
export class OrganisationController {
  constructor(private readonly organisation: OrganisationService) {}

  @Get('companies')
  @ApiOperation({ summary: 'Companies of the current tenant (M01)' })
  @ApiOkResponse({ type: CompanyDto, isArray: true })
  listCompanies(): Promise<CompanyDto[]> {
    return this.organisation.listCompanies();
  }
}
