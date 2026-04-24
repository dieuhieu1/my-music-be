import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ── POST /reports (BL-38) — authenticated users can report content ───────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') reporterId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reportsService.create(reporterId, dto);
  }
}
