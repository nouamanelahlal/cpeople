import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** A kind of document the company keeps, and how soon it warns (spec 3.3). */
export class DocumentTypeDto {
  @ApiProperty({ example: 'MEDICAL' })
  code!: string;

  @ApiProperty({ example: 'Medical aptitude certificate' })
  name!: string;

  @ApiProperty({ description: 'Whether an expiry date has to be given' })
  requiresExpiry!: boolean;

  @ApiProperty({ example: 30, description: 'How many days ahead it is flagged' })
  alertDaysBefore!: number;

  @ApiProperty({ description: 'Whether only the roles that may see private fields may open it' })
  sensitive!: boolean;
}

/** One document on a file (HR-01 spec 6.7). */
export class EmployeeDocumentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: DocumentTypeDto })
  type!: DocumentTypeDto;

  @ApiProperty({ example: 'medical-certificate.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 184_320 })
  byteSize!: number;

  @ApiPropertyOptional({ example: '2026-02-01' })
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-12-03' })
  expiryDate?: string;

  @ApiProperty({ enum: ['valid', 'expiring', 'expired'] })
  state!: 'valid' | 'expiring' | 'expired';

  @ApiPropertyOptional({ example: 7, description: 'Days until it runs out; negative once it has' })
  daysLeft?: number;

  @ApiPropertyOptional({ example: 'Salma Benali' })
  uploadedBy?: string;

  @ApiProperty({ example: '2026-11-23T09:12:00.000Z' })
  uploadedAt!: string;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty({ description: 'Whether the bytes can be opened by this reader' })
  mayOpen!: boolean;

  @ApiProperty({ description: 'Whether this reader may take it off the file' })
  mayDelete!: boolean;
}

/** The documents on one file, with the kinds that may be added to it. */
export class EmployeeDocumentsDto {
  @ApiProperty({ type: [EmployeeDocumentDto] })
  documents!: EmployeeDocumentDto[];

  @ApiProperty({ type: [DocumentTypeDto] })
  types!: DocumentTypeDto[];

  @ApiProperty({ example: '2026-11-23' })
  today!: string;

  @ApiProperty({ description: 'Whether this reader may add one' })
  mayUpload!: boolean;
}

/** What an upload carries besides the file itself. */
export class UploadDocumentDto {
  @ApiProperty({ example: 'MEDICAL', description: 'The code of the kind of document' })
  type!: string;

  @ApiPropertyOptional({ example: '2026-02-01' })
  issueDate?: string;

  @ApiPropertyOptional({ example: '2026-12-03' })
  expiryDate?: string;

  @ApiPropertyOptional()
  note?: string;
}
