import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { EmployeeFileService } from './employee-file.service.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

/** The employee file (M03 / HR-01): the list first, the file itself next. */
@Module({
  imports: [AccessModule, AuditModule, PrismaModule, StorageModule],
  controllers: [EmployeesController, DocumentsController],
  providers: [EmployeesService, EmployeeFileService, DocumentsService],
})
export class EmployeesModule {}
