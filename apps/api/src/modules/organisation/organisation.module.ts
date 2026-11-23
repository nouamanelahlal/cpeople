import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { ChartService } from './chart.service.js';
import { OrganisationController } from './organisation.controller.js';
import { OrganisationService } from './organisation.service.js';

/** The company's own shape: sites, departments, positions, cost centres (M01 / HR-01 6.5). */
@Module({
  imports: [AccessModule, AuditModule, PrismaModule],
  controllers: [OrganisationController],
  providers: [OrganisationService, ChartService],
})
export class OrganisationModule {}
