import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';

@Controller('artist/analytics')
@UseGuards(RolesGuard)
@Roles(Role.ARTIST, Role.ADMIN)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ── GET /artist/analytics/overview (BL-51) ───────────────────────────────────
  // ADMIN can pass ?artistId=<userId> to view any artist's overview
  @Get('overview')
  getOverview(
    @CurrentUser('id')    userId: string,
    @CurrentUser('roles') roles: Role[],
    @Query('artistId')    artistId?: string,
  ) {
    return this.analyticsService.getOverview(userId, roles, artistId);
  }

  // ── GET /artist/analytics/:songId (BL-51) ────────────────────────────────────
  @Get(':songId')
  getSongAnalytics(
    @CurrentUser('id')    userId: string,
    @CurrentUser('roles') roles: Role[],
    @Param('songId', ParseUUIDPipe) songId: string,
  ) {
    return this.analyticsService.getSongAnalytics(userId, roles, songId);
  }
}
