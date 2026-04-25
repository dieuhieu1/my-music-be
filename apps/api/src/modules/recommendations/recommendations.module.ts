import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Song } from '../songs/entities/song.entity';
import { PlayHistory } from '../playback/entities/play-history.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { PlaylistSong } from '../playlists/entities/playlist-song.entity';
import { Genre } from '../genres/entities/genre.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { UserGenrePreference } from '../users/entities/user-genre-preference.entity';
import { RecommendationCache } from './entities/recommendation-cache.entity';

import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationBatchWorker } from './workers/recommendation-batch.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Song,
      PlayHistory,
      Playlist,
      PlaylistSong,
      Genre,
      ArtistProfile,
      UserGenrePreference,
      RecommendationCache,
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationBatchWorker],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
