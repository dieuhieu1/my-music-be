import { Controller, Get, Query } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  // ── GET /feed (BL-33) ────────────────────────────────────────────────────

  @Get()
  getFeed(
    @CurrentUser('id') userId: string,
    @Query() dto: FeedQueryDto,
  ) {
    return this.feedService.getFeed(userId, dto);
  }
}
