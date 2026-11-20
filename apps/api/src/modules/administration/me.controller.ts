import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantContextService } from '../../common/tenant/tenant-context.service.js';
import { MeDto } from './dto/me.dto.js';

@ApiTags('administration')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly tenantContext: TenantContextService) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in user and the tenant their token places them in (M02)' })
  @ApiOkResponse({ type: MeDto })
  me(): MeDto {
    const principal = this.tenantContext.requirePrincipal();

    return {
      name: principal.name,
      email: principal.email,
      roles: [...principal.roles],
      tenantId: principal.organization.tenantId,
      organization: principal.organization.alias,
      ...(principal.locale === undefined ? {} : { locale: principal.locale }),
    };
  }
}
