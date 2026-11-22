import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { HomeController } from './home.controller.js';
import { HomeService } from './home.service.js';

/**
 * The home screen's read model (HR-01 spec 6.12).
 *
 * A screen, not a domain: it asks the employee, contract, document and
 * onboarding tables for counts rather than owning anything itself.
 */
@Module({
  imports: [AccessModule, PrismaModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
