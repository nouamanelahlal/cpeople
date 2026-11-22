import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TenantModule } from '../tenant/tenant.module.js';
import { CurrentUserService } from './current-user.service.js';

/** Who is asking and what they may do, available to every module (HR-01). */
@Module({
  imports: [PrismaModule, TenantModule],
  providers: [CurrentUserService],
  exports: [CurrentUserService],
})
export class AccessModule {}
