import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditReadService } from './audit.service.js';
import { AuditPageDto } from './dto/audit.dto.js';

@ApiTags('administration')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditReadService) {}

  @Get()
  @ApiOperation({ summary: 'What has happened across the company (HR-01 section 6.11)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiOkResponse({ type: AuditPageDto })
  page(@Query('page') page?: string): Promise<AuditPageDto> {
    const asked = Number.parseInt(page ?? '', 10);
    return this.audit.page(Number.isFinite(asked) ? { page: asked } : {});
  }
}
