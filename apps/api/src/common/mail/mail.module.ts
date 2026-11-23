import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

/** Notices out (M09 / HR-04). Locally they all land in Mailpit. */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
