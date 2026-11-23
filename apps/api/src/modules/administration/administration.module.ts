import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { AuditController } from './audit.controller.js';
import { AuditReadService } from './audit.service.js';
import { MeController } from './me.controller.js';

/** Who is signed in, and what the company has done (M20 / HR-01 section 6.11). */
@Module({
  imports: [AccessModule, AuditModule, PrismaModule],
  controllers: [MeController, AuditController],
  providers: [AuditReadService],
})
export class AdministrationModule {}
