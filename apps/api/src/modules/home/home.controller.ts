import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HomeSummaryDto } from './dto/home.dto.js';
import { HomeService } from './home.service.js';

@ApiTags('home')
@ApiBearerAuth()
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  @ApiOperation({
    summary: 'The home screen, counted over the files this person may see (HR-01 / M03)',
  })
  @ApiOkResponse({ type: HomeSummaryDto })
  summary(): Promise<HomeSummaryDto> {
    return this.home.summary();
  }
}
