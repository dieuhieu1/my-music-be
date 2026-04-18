import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FeedEvent } from './entities/feed-event.entity';
import { Follow } from '../follow/entities/follow.entity';
import { Song } from '../songs/entities/song.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeedEvent,
      Follow,
      Song,
      Playlist,
      User,
      ArtistProfile,
    ]),
    StorageModule,
  ],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
