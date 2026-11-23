import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TENANT_HEADER } from '../../common/tenant/tenant.middleware.js';
import { CompanyDto } from './dto/company.dto.js';
import {
  DepartmentChangedDto,
  DepartmentEditDto,
  OrganisationDto,
} from './dto/organisation.dto.js';
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

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Departments, positions and cost centres (HR-01 section 6.5)' })
  @ApiOkResponse({ type: OrganisationDto })
  read(): Promise<OrganisationDto> {
    return this.organisation.read();
  }

  @Patch('departments/:id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Changes a department, and optionally moves its people with it (6.5)',
  })
  @ApiOkResponse({ type: DepartmentChangedDto })
  editDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DepartmentEditDto,
  ): Promise<DepartmentChangedDto> {
    return this.organisation.editDepartment(id, body);
  }
}
