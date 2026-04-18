import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Song } from '../songs/entities/song.entity';
import { Album } from '../albums/entities/album.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { SongsModule } from '../songs/songs.module';
import { AlbumsModule } from '../albums/albums.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, Album, ArtistProfile]),
    SongsModule,  // exports SongsService (buildSongResponse)
    AlbumsModule, // exports AlbumsService (buildAlbumSummary)
    // StorageModule is @Global() — StorageService is injected automatically
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
