import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

/** The employee file (M03 / HR-01): the list first, the file itself next. */
@Module({
  imports: [AccessModule, PrismaModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
