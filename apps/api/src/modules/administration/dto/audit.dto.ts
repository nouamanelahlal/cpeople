import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditDiffDto } from '../../employees/dto/employee-file.dto.js';

/** One thing that happened, as the company's trail records it (spec 6.11). */
export class AuditEntryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-11-23T09:12:00.000Z' })
  at!: string;

  @ApiPropertyOptional({ example: 'Salma Benali' })
  actorName?: string;

  @ApiPropertyOptional({ enum: ['admin', 'hr', 'manager', 'employee'] })
  actorRole?: string;

  @ApiProperty({ example: 'employee.updated' })
  action!: string;

  @ApiProperty({ example: 'employee' })
  entity!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'What it happened to, where there is one' })
  entityId?: string;

  @ApiProperty({ example: 'Karim Alaoui' })
  summary!: string;

  @ApiProperty({ type: [AuditDiffDto] })
  diff!: AuditDiffDto[];
}

/** A page of the trail, newest first. */
export class AuditPageDto {
  @ApiProperty({ type: [AuditEntryDto] })
  entries!: AuditEntryDto[];

  @ApiProperty({ example: 312 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  pageSize!: number;

  @ApiProperty({ example: 7 })
  pages!: number;
}
