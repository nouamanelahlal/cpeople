import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service.js';

/** Turning pages into PDFs, for contracts now and payslips later (M09). */
@Module({ providers: [PdfService], exports: [PdfService] })
export class PdfModule {}
