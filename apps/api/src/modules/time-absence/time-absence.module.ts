import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { LeaveSettingsController } from './leave-settings.controller.js';
import { LeaveSettingsService } from './leave-settings.service.js';

/**
 * Time and absence (M08 / M09, HR-02).
 *
 * Step 1 is the set-up: what the leave types are, what each is worth from when,
 * which days each site works, and which days are holidays. Requests and
 * approvals build on it.
 */
@Module({
  imports: [AccessModule, AuditModule, PrismaModule],
  controllers: [LeaveSettingsController],
  providers: [LeaveSettingsService],
})
export class TimeAbsenceModule {}
