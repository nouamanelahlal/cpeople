import { Global, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { TenantSettingsService } from './tenant-settings.service.js';

/**
 * The company's own settings (HR-02 build spec §7.1).
 *
 * Global, because more than one module asks the same questions of it: the
 * employee file asks whether it may send a salary, the hire wizard asks what an
 * employee number should look like, and the leave calendar asks whether
 * colleagues may see which kind of leave somebody is on.
 */
@Global()
@Module({
  imports: [AuditModule],
  providers: [TenantSettingsService],
  exports: [TenantSettingsService],
})
export class SettingsModule {}
