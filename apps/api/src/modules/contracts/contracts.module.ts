import { Module } from '@nestjs/common';
import { AccessModule } from '../../common/access/access.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';
import { PdfModule } from '../../common/pdf/pdf.module.js';
import { PrismaModule } from '../../common/prisma/prisma.module.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { ContractsController } from './contracts.controller.js';
import { ContractsService } from './contracts.service.js';

/** Contracts: generated, signed, renewed and ended (M03 / HR-01 section 6.6). */
@Module({
  imports: [AccessModule, AuditModule, PdfModule, PrismaModule, StorageModule],
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
