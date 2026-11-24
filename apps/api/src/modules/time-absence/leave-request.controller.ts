import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  LeaveDecideDto,
  LeaveListDto,
  LeaveOptionDto,
  LeavePreviewDto,
  LeaveRequestCreateDto,
  LeaveRequestDetailDto,
  LeaveReviewItemDto,
} from './dto/leave-request.dto.js';
import { LeaveRequestService } from './leave-request.service.js';
import { LeaveReviewService } from './leave-review.service.js';

/**
 * Leave requests (M09 / HR-04).
 *
 * Every route answers for the signed-in person: what they may see, what they may
 * decide, and whether deciding it would be HR stepping over a line manager. None
 * of that is passed in — the browser can ask for any tab it likes and will be
 * given the one its token entitles it to.
 */
@ApiTags('Time & absence')
@Controller('leave')
export class LeaveRequestController {
  constructor(
    private readonly requests: LeaveRequestService,
    private readonly review: LeaveReviewService,
  ) {}

  @Get('requests')
  @ApiOperation({ summary: 'One tab of the leave screen, scoped to the reader' })
  @ApiOkResponse({ type: LeaveListDto })
  list(@Query('view') view = 'mine'): Promise<LeaveListDto> {
    return this.requests.list(view);
  }

  @Get('types')
  @ApiOperation({ summary: 'The leave types somebody may ask for' })
  @ApiOkResponse({ type: [LeaveOptionDto] })
  options(): Promise<LeaveOptionDto[]> {
    return this.requests.options();
  }

  @Post('requests/preview')
  @ApiOperation({ summary: 'What a request would cost, and what is worth warning about' })
  @ApiOkResponse({ type: LeavePreviewDto })
  preview(@Body() body: LeaveRequestCreateDto): Promise<LeavePreviewDto> {
    return this.requests.preview(body);
  }

  @Post('requests')
  @ApiOperation({ summary: 'Ask for leave' })
  submit(@Body() body: LeaveRequestCreateDto): Promise<{ id: string }> {
    return this.requests.submit(body);
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'One request, with how it was counted and what has happened to it' })
  @ApiOkResponse({ type: LeaveRequestDetailDto })
  detail(@Param('id') id: string): Promise<LeaveRequestDetailDto> {
    return this.requests.detail(id);
  }

  @Post('requests/:id/decide')
  @ApiOperation({ summary: 'Approve or refuse. HR deciding out of turn must say why.' })
  async decide(@Param('id') id: string, @Body() body: LeaveDecideDto): Promise<{ ok: true }> {
    await this.requests.decide(id, body);
    return { ok: true };
  }

  @Post('requests/:id/withdraw')
  @ApiOperation({ summary: 'Take back a request nobody has decided yet' })
  async withdraw(@Param('id') id: string): Promise<{ ok: true }> {
    await this.requests.withdraw(id);
    return { ok: true };
  }

  @Post('requests/:id/cancel')
  @ApiOperation({ summary: 'Ask to cancel approved leave. It still needs a yes.' })
  async cancel(@Param('id') id: string): Promise<{ ok: true }> {
    await this.requests.requestCancellation(id);
    return { ok: true };
  }

  @Get('review')
  @ApiOperation({ summary: 'Requests whose count no longer matches the settings in force' })
  @ApiOkResponse({ type: [LeaveReviewItemDto] })
  toReview(): Promise<LeaveReviewItemDto[]> {
    return this.review.list();
  }

  @Post('review/:id/accept')
  @ApiOperation({ summary: 'HR accepting the new count, which corrects the balance' })
  async accept(@Param('id') id: string): Promise<{ ok: true }> {
    await this.review.accept(id);
    return { ok: true };
  }
}
