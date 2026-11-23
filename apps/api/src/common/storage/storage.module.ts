import { Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';

/** The object store behind uploaded documents (HR-01 spec 6.7). */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
