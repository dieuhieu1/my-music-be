import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QueueItem } from './entities/queue-item.entity';
import { PlayHistory } from './entities/play-history.entity';
import { Song } from '../songs/entities/song.entity';
import { PlaybackService } from './playback.service';
import { PlaybackController } from './playback.controller';
import { QueueController } from './queue.controller';
import { SongsModule } from '../songs/songs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QueueItem, PlayHistory, Song]),
    // SongsModule exports SongsService (for buildSongResponse)
    SongsModule,
  ],
  controllers: [PlaybackController, QueueController],
  providers: [PlaybackService],
  exports: [PlaybackService],
})
export class PlaybackModule {}
