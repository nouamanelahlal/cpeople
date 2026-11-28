import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceImportService } from './attendance-import.service.js';
import { AttendanceExceptionService } from './attendance-exception.service.js';
import { AttendanceSourceService } from './attendance-source.service.js';
import { FileSpecService } from './file-spec.service.js';
import { SampleExportService } from './sample-export.service.js';
import { WorkDayBuilderService } from './workday-builder.service.js';

/**
 * Attendance (M10 / HR-04, build spec §5).
 *
 * Step 4 is the ground the rest stands on: the file format we read, a sample of
 * it generated from the seeded company, and the specification SMG sends to the
 * device provider. Nothing here pretends to talk to a device.
 */
@Module({
  imports: [AccessModule, AuditModule, PrismaModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceSourceService,
    SampleExportService,
    FileSpecService,
    WorkDayBuilderService,
    AttendanceImportService,
    AttendanceExceptionService,
  ],
  exports: [SampleExportService, AttendanceSourceService],
})
export class AttendanceModule {}
