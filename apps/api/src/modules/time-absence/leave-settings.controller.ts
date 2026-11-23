import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  HolidayCreateDto,
  LeavePolicyEditDto,
  LeaveRuleCreateDto,
  LeaveSettingsDto,
  LeaveTypeEditDto,
  WorkWeekCreateDto,
} from './dto/leave-settings.dto.js';
import { LeaveSettingsService } from './leave-settings.service.js';

@ApiTags('leave')
@ApiBearerAuth()
@Controller('leave/settings')
export class LeaveSettingsController {
  constructor(private readonly settings: LeaveSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Leave types, rules, working weeks and holidays (HR-02 / M08)' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiOkResponse({ type: LeaveSettingsDto })
  read(@Query('year') year?: string): Promise<LeaveSettingsDto> {
    const asked = Number.parseInt(year ?? '', 10);
    return this.settings.read(Number.isFinite(asked) ? asked : undefined);
  }

  @Patch('types/:id')
  @ApiOperation({ summary: 'Changes what a leave type is' })
  @ApiOkResponse({ type: LeaveSettingsDto })
  editType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LeaveTypeEditDto,
  ): Promise<LeaveSettingsDto> {
    return this.settings.editType(id, body);
  }

  @Post('types/:id/rules')
  @ApiOperation({
    summary: 'Writes a new rule for a leave type, from a date (CLAUDE.md rule 3)',
  })
  @ApiOkResponse({ type: LeaveSettingsDto })
  addRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LeaveRuleCreateDto,
  ): Promise<LeaveSettingsDto> {
    return this.settings.addRule(id, body);
  }

  @Post('work-weeks')
  @ApiOperation({ summary: 'Sets a site’s working week from a date' })
  @ApiOkResponse({ type: LeaveSettingsDto })
  setWorkWeek(@Body() body: WorkWeekCreateDto): Promise<LeaveSettingsDto> {
    return this.settings.setWorkWeek(body);
  }

  @Post('holidays')
  @ApiOperation({ summary: 'Adds a public holiday. Entered, never calculated.' })
  @ApiOkResponse({ type: LeaveSettingsDto })
  addHoliday(@Body() body: HolidayCreateDto): Promise<LeaveSettingsDto> {
    return this.settings.addHoliday(body);
  }

  @Delete('holidays/:id')
  @ApiOperation({ summary: 'Removes a public holiday' })
  @ApiOkResponse({ type: LeaveSettingsDto })
  removeHoliday(@Param('id', ParseUUIDPipe) id: string): Promise<LeaveSettingsDto> {
    return this.settings.removeHoliday(id);
  }

  @Post('holidays/confirm/:year')
  @ApiOperation({ summary: 'Marks a year’s holidays as checked by the client' })
  @ApiOkResponse({ type: LeaveSettingsDto })
  confirmYear(@Param('year') year: string): Promise<LeaveSettingsDto> {
    return this.settings.confirmYear(Number.parseInt(year, 10));
  }

  @Patch('policy')
  @ApiOperation({ summary: 'The company-wide leave decisions' })
  @ApiOkResponse({ type: LeaveSettingsDto })
  setPolicy(@Body() body: LeavePolicyEditDto): Promise<LeaveSettingsDto> {
    return this.settings.setPolicy(body);
  }
}
