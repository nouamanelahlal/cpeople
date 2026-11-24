import { Body, Controller, ForbiddenException, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import {
  AttendanceSourceService,
  type SourceMapping,
  type SourceView,
} from './attendance-source.service.js';
import { FileSpecService } from './file-spec.service.js';
import { SampleExportService, type SampleSummary } from './sample-export.service.js';

/**
 * Attendance (M10 / HR-04, build spec §5).
 *
 * What exists today is the part SMG has to act on before anything else can be
 * built: the format we read, a sample of it, and the specification to send to
 * the device provider. The import itself is the next step.
 */
@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly users: CurrentUserService,
    private readonly sources: AttendanceSourceService,
    private readonly sample: SampleExportService,
    private readonly spec: FileSpecService,
  ) {}

  @Get('sources')
  @ApiOperation({ summary: 'Where punches come from, and how the file is read' })
  sourceList(): Promise<{ sources: SourceView[]; mayManage: boolean }> {
    return this.sources.list();
  }

  @Patch('sources/:id')
  @ApiOperation({ summary: 'Change the column mapping or the duplicate window' })
  update(
    @Param('id') id: string,
    @Body()
    body: { mapping?: Partial<SourceMapping>; timezone?: string; duplicateWindowSeconds?: number },
  ): Promise<SourceView> {
    return this.sources.update(id, body);
  }

  @Get('sample')
  @ApiOperation({ summary: 'What the sample export contains, for the screen that offers it' })
  @ApiOkResponse({ description: 'Counts of each anomaly the sample carries' })
  async sampleSummary(): Promise<SampleSummary> {
    const user = await this.#mayImport();
    const { summary } = await this.sample.build(user.tenantId);

    return summary;
  }

  /**
   * The sample export itself, as the file a device would have written.
   *
   * Base64 inside JSON rather than a body of text: every other route here
   * answers JSON, and the web application turns it into a download.
   */
  @Get('sample/file')
  @ApiOperation({ summary: 'The sample device export, generated from the seeded company' })
  async sampleFile(): Promise<{ filename: string; content: string }> {
    const user = await this.#mayImport();
    const { rows } = await this.sample.build(user.tenantId);

    return {
      filename: 'Sample_Attendance_Export_2026-11.csv',
      content: this.sample.toCsv(rows),
    };
  }

  @Get('file-specification')
  @ApiOperation({ summary: 'The specification to send to the device provider, as xlsx' })
  async fileSpecification(): Promise<{ filename: string; base64: string }> {
    const user = await this.#mayImport();
    const { rows } = await this.sample.build(user.tenantId);
    const book = await this.spec.build(rows);

    return {
      filename: 'CPeople_Attendance_File_Specification.xlsx',
      base64: book.toString('base64'),
    };
  }

  async #mayImport(): Promise<{ tenantId: string }> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'attendance.import')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return user;
  }
}
