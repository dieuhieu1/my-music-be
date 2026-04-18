import { Controller, Post, Body } from '@nestjs/common';

import { PlaybackService } from './playback.service';
import { RecordPlayDto } from './dto/record-play.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('playback')
export class PlaybackController {
  constructor(private readonly playbackService: PlaybackService) {}

  // ── POST /playback/history (BL-30) ────────────────────────────────────────

  @Post('history')
  recordPlay(
    @CurrentUser('id') userId: string,
    @Body() dto: RecordPlayDto,
  ) {
    return this.playbackService.recordPlay(userId, dto);
  }
}
