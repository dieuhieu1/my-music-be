import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { Song } from './entities/song.entity';
import { SongEncryptionKey } from './entities/song-encryption-key.entity';
import { SongDailyStats } from './entities/song-daily-stats.entity';
import { User } from '../auth/entities/user.entity';
import { SongsService } from './songs.service';
import { SongsController } from './songs.controller';
import { AudioExtractionWorker } from '../queue/workers/audio-extraction.worker';
import { AlbumsModule } from '../albums/albums.module';
import { forwardRef } from '@nestjs/common';
import { PlaylistsModule } from '../playlists/playlists.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, SongEncryptionKey, SongDailyStats, User]),
    // HttpModule is used by AudioExtractionWorker to call the DSP sidecar
    HttpModule,
    // AlbumsModule is needed so SongsService can call AlbumsService.recomputeAlbumStats()
    AlbumsModule,
    // forwardRef to break the Songs ↔ Playlists circular dependency
    forwardRef(() => PlaylistsModule),
  ],
  controllers: [SongsController],
  providers: [SongsService, AudioExtractionWorker],
  exports: [SongsService],
})
export class SongsModule {}
