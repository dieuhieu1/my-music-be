import { Controller, Get, Query, Headers } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { GetRecommendationsDto } from './dto/recommendation-query.dto';
import { GetMoodRecommendationsDto } from './dto/mood-recommendation-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  // GET /recommendations
  // Auth: JWT (global guard — no @Public())
  // Headers: X-Device-Type, X-Local-Hour, X-Location-Context
  @Get()
  getRecommendations(
    @CurrentUser('id') userId: string,
    @Query() dto: GetRecommendationsDto,
    @Headers('x-device-type')      deviceType?: string,
    @Headers('x-local-hour')       localHourHeader?: string,
    @Headers('x-location-context') locationContext?: string,
  ) {
    return this.recommendationsService.getRecommendations(
      userId,
      dto,
      {
        deviceType,
        localHour:       this.parseLocalHour(localHourHeader),
        locationContext,
      },
    );
  }

  // GET /recommendations/mood
  // Auth: JWT
  // mood absent → infer from context headers
  @Get('mood')
  getMoodRecommendations(
    @CurrentUser('id') userId: string,
    @Query() dto: GetMoodRecommendationsDto,
    @Headers('x-device-type')      deviceType?: string,
    @Headers('x-local-hour')       localHourHeader?: string,
    @Headers('x-location-context') locationContext?: string,
  ) {
    return this.recommendationsService.getMoodRecommendations(
      userId,
      dto,
      {
        deviceType,
        localHour:       this.parseLocalHour(localHourHeader),
        locationContext,
      },
    );
  }

  private parseLocalHour(raw?: string): number | undefined {
    if (raw === undefined) return undefined;
    const n = parseInt(raw, 10);
    return !isNaN(n) && n >= 0 && n <= 23 ? n : undefined;
  }
}
