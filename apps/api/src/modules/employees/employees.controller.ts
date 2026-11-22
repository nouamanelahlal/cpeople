import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeeListDto } from './dto/employee-list.dto.js';
import { EmployeeQueryDto, parseEmployeeQuery } from './dto/employee-query.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @ApiOperation({
    summary: 'The employee list, over the files this person may see (HR-01 / HR-02 section 6.2)',
  })
  @ApiOkResponse({ type: EmployeeListDto })
  list(@Query() query: EmployeeQueryDto): Promise<EmployeeListDto> {
    return this.employees.list(parseEmployeeQuery(query));
  }
}
