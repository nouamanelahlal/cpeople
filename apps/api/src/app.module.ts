import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './common/config/config.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { TenantMiddleware } from './common/tenant/tenant.middleware.js';
import { TenantModule } from './common/tenant/tenant.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OrganisationController } from './modules/organisation/organisation.controller.js';
import { OrganisationModule } from './modules/organisation/organisation.module.js';

// One folder per module under src/modules (CLAUDE.md). The modules still to come:
// employees, time-absence, payroll, payslips, declarations, accounting, expenses,
// integrations, migration, administration.
@Module({
  imports: [ConfigModule, TenantModule, PrismaModule, HealthModule, OrganisationModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Every route that touches tenant data runs inside a tenant context. Health does
    // not, so it stays out. Add new controllers here as the modules land.
    consumer.apply(TenantMiddleware).forRoutes(OrganisationController);
  }
}
