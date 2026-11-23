import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { TenantContextService } from '../../common/tenant/tenant-context.service.js';
import { MeDto } from './dto/me.dto.js';

@ApiTags('administration')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly users: CurrentUserService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The signed-in user, the tenant their token places them in, and what they may do (M02 / HR-01)',
  })
  @ApiOkResponse({ type: MeDto })
  async me(): Promise<MeDto> {
    const principal = this.tenantContext.requirePrincipal();
    const user = await this.users.withEmployee();

    return {
      role: user.role,
      capabilities: [...user.capabilities],
      ...(user.employeeId === undefined ? {} : { employeeId: user.employeeId }),
      name: principal.name,
      email: principal.email,
      roles: [...principal.roles],
      tenantId: principal.organization.tenantId,
      organization: principal.organization.alias,
      ...(principal.locale === undefined ? {} : { locale: principal.locale }),
    };
  }
}
