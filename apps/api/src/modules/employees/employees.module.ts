import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { EmployeeFileService } from './employee-file.service.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

/** The employee file (M03 / HR-01): the list first, the file itself next. */
@Module({
  imports: [AccessModule, AuditModule, PrismaModule],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeFileService],
})
export class EmployeesModule {}
