import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Playlist } from './entities/playlist.entity';
import { PlaylistSong } from './entities/playlist-song.entity';
import { SavedPlaylist } from './entities/saved-playlist.entity';
import { FeedEvent } from '../feed/entities/feed-event.entity';
import { Song } from '../songs/entities/song.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { PlaylistsService } from './playlists.service';
import { PlaylistsController } from './playlists.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Playlist,
      PlaylistSong,
      SavedPlaylist,
      FeedEvent,
      Song,
      User,
      ArtistProfile,
    ]),
    StorageModule,
  ],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
