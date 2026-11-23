import { Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';

/** The trail every module writes to (HR-01 spec 6.11). */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
