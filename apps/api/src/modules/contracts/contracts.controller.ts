import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_BYTES, type UploadedFile as File } from '../employees/documents.service.js';
import { ContractsService } from './contracts.service.js';
import {
  ContractListDto,
  ContractPreviewDto,
  EndContractDto,
  RenewContractDto,
} from './dto/contract.dto.js';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  @ApiOperation({ summary: 'Contracts, over the files this person may see (HR-01 section 6.6)' })
  @ApiOkResponse({ type: ContractListDto })
  list(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('view') view?: string,
  ): Promise<ContractListDto> {
    return this.contracts.list({
      ...(type?.trim() ? { type: type.trim() } : {}),
      ...(status?.trim() ? { status: status.trim() } : {}),
      ...(view?.trim() ? { view: view.trim() } : {}),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'What the document would say, before it is printed (6.6)' })
  @ApiOkResponse({ type: ContractPreviewDto })
  preview(@Param('id', ParseUUIDPipe) id: string): Promise<ContractPreviewDto> {
    return this.contracts.preview(id);
  }

  @Post(':id/generate')
  @ApiOperation({ summary: 'Produces the PDF and files it on the employee (6.6)' })
  @ApiOkResponse({ type: ContractPreviewDto })
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { clauses?: string[] },
  ): Promise<ContractPreviewDto> {
    return this.contracts.generate(id, body?.clauses);
  }

  @Post(':id/sign')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Files the signed scan and marks the contract signed (6.6)' })
  @ApiOkResponse({ type: ContractPreviewDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: File | undefined,
  ): Promise<ContractPreviewDto> {
    return this.contracts.sign(id, file);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renews a fixed term as a new draft (6.6)' })
  @ApiOkResponse({ type: ContractPreviewDto })
  renew(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenewContractDto,
  ): Promise<ContractPreviewDto> {
    return this.contracts.renew(id, body);
  }

  @Post(':id/end')
  @ApiOperation({
    summary: 'Ends a contract, and the employment with it where it was the last (6.6)',
  })
  @ApiOkResponse({ type: ContractPreviewDto })
  end(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EndContractDto,
  ): Promise<ContractPreviewDto> {
    return this.contracts.end(id, body);
  }
}
