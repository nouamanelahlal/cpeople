import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuditEventDto,
  EmployeeEditDto,
  EmployeeFileDto,
} from './dto/employee-file.dto.js';
import { EmployeeListDto } from './dto/employee-list.dto.js';
import { EmployeeQueryDto, parseEmployeeQuery } from './dto/employee-query.dto.js';
import { EmployeeFileService } from './employee-file.service.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly files: EmployeeFileService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'The employee list, over the files this person may see (HR-01 / HR-02 section 6.2)',
  })
  @ApiOkResponse({ type: EmployeeListDto })
  list(@Query() query: EmployeeQueryDto): Promise<EmployeeListDto> {
    return this.employees.list(parseEmployeeQuery(query));
  }

  @Get(':id')
  @ApiOperation({ summary: 'One employee file, masked for the reader (HR-01 section 6.3)' })
  @ApiOkResponse({ type: EmployeeFileDto })
  file(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeFileDto> {
    return this.files.file(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Changes a file and records what changed (HR-01 section 6.3)' })
  @ApiOkResponse({ type: EmployeeFileDto })
  edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmployeeEditDto,
  ): Promise<EmployeeFileDto> {
    return this.files.edit(id, body);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'What has happened to this file, newest first (HR-01 section 6.11)' })
  @ApiOkResponse({ type: [AuditEventDto] })
  history(@Param('id', ParseUUIDPipe) id: string): Promise<AuditEventDto[]> {
    return this.files.history(id);
  }
}
