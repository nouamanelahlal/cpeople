import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { MailModule } from '../../common/mail/mail.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { LeaveBalanceService } from './leave-balance.service.js';
import { LeaveCalendarService } from './leave-calendar.service.js';
import { LeaveMailService } from './leave-mail.service.js';
import { LeaveRequestController } from './leave-request.controller.js';
import { LeaveRequestService } from './leave-request.service.js';
import { LeaveReviewService } from './leave-review.service.js';
import { LeaveSettingsController } from './leave-settings.controller.js';
import { LeaveSettingsService } from './leave-settings.service.js';

/**
 * Time and absence (M08 / M09, HR-02).
 *
 * Step 1 was the set-up: what the leave types are, what each is worth from when,
 * which days each site works, which days are holidays. Step 2 is what people
 * actually do — ask, approve, refuse, cancel — and the arithmetic that has to
 * stay explicable afterwards.
 */
@Module({
  imports: [AccessModule, AuditModule, MailModule, PrismaModule],
  controllers: [LeaveSettingsController, LeaveRequestController],
  providers: [
    LeaveSettingsService,
    LeaveCalendarService,
    LeaveBalanceService,
    LeaveMailService,
    LeaveRequestService,
    LeaveReviewService,
  ],
})
export class TimeAbsenceModule {}
