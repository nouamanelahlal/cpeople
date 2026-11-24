import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuthModule } from './common/auth/auth.module.js';
import { ConfigModule } from './common/config/config.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { SettingsModule } from './common/settings/settings.module.js';
import { TenantMiddleware } from './common/tenant/tenant.middleware.js';
import { TenantModule } from './common/tenant/tenant.module.js';
import { AdministrationModule } from './modules/administration/administration.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ContractsModule } from './modules/contracts/contracts.module.js';
import { EmployeesModule } from './modules/employees/employees.module.js';
import { HomeModule } from './modules/home/home.module.js';
import { OrganisationModule } from './modules/organisation/organisation.module.js';
import { TimeAbsenceModule } from './modules/time-absence/time-absence.module.js';

// One folder per module under src/modules (CLAUDE.md). The modules still to come:
// employees, time-absence, payroll, payslips, declarations, accounting, expenses,
// integrations, migration.
@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TenantModule,
    PrismaModule,
    SettingsModule,
    HealthModule,
    AdministrationModule,
    AttendanceModule,
    ContractsModule,
    EmployeesModule,
    HomeModule,
    OrganisationModule,
    TimeAbsenceModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Everything runs inside a tenant context, and the exceptions are named here.
    //
    // It used to be a list of the controllers that needed one, which meant a new
    // controller ran with no tenant and no user until somebody remembered to add
    // it — exactly the kind of omission rule 1 exists to prevent. This way round,
    // forgetting is safe: the new route is covered.
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.ALL },
        { path: 'api/health', method: RequestMethod.ALL },
        { path: 'docs', method: RequestMethod.ALL },
        { path: 'api/docs', method: RequestMethod.ALL },
        { path: 'api/docs/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
