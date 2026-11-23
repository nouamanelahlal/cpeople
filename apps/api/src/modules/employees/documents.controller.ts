import { Readable } from 'node:stream';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentsService, MAX_BYTES, type UploadedFile as File } from './documents.service.js';
import {
  EmployeeDocumentDto,
  EmployeeDocumentsDto,
  UploadDocumentDto,
} from './dto/document.dto.js';

@ApiTags('documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('employees/:id/documents')
  @ApiOperation({ summary: 'The documents on one file, with their expiry (HR-01 section 6.7)' })
  @ApiOkResponse({ type: EmployeeDocumentsDto })
  list(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeDocumentsDto> {
    return this.documents.list(id);
  }

  @Post('employees/:id/documents')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Adds a document to a file (HR-01 section 6.7)' })
  @ApiOkResponse({ type: EmployeeDocumentDto })
  // Held in memory rather than written to a temporary file: ten megabytes is the
  // ceiling, and the bytes are on their way to object storage anyway.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UploadDocumentDto,
    @UploadedFile() file: File | undefined,
  ): Promise<EmployeeDocumentDto> {
    return this.documents.upload(id, body, file);
  }

  @Get('documents/:documentId/content')
  @ApiOperation({ summary: 'The bytes of one document, for a reader allowed them' })
  async content(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.documents.content(documentId);

    response.setHeader('content-type', file.contentType);
    // Shown rather than saved: the file page opens it beside the list. The name
    // is quoted and stripped of anything that could end the header early.
    response.setHeader(
      'content-disposition',
      `inline; filename="${file.fileName.replace(/["\r\n]/g, '')}"`,
    );
    if (file.byteSize !== undefined) {
      response.setHeader('content-length', String(file.byteSize));
    }

    Readable.from(file.body).pipe(response);
  }

  @Delete('documents/:documentId')
  @ApiOperation({ summary: 'Takes a document off a file (HR-01 section 6.7)' })
  remove(@Param('documentId', ParseUUIDPipe) documentId: string): Promise<void> {
    return this.documents.remove(documentId);
  }
}
