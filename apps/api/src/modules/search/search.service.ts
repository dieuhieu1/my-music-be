import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Song } from '../songs/entities/song.entity';
import { Album } from '../albums/entities/album.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { SongsService } from '../songs/songs.service';
import { AlbumsService } from '../albums/albums.service';
import { StorageService } from '../storage/storage.service';
import { SearchDto } from './dto/search.dto';
import { SongStatus } from '../../common/enums';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Song)          private readonly songs:          Repository<Song>,
    @InjectRepository(Album)         private readonly albums:         Repository<Album>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly songsService:   SongsService,
    private readonly albumsService:  AlbumsService,
    private readonly storage:        StorageService,
  ) {}

  // ── GET /search?q=&page&limit (BL-23) ─────────────────────────────────────
  // Returns songs + albums + artists matching the query, each capped at `limit`.

  async search(dto: SearchDto) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 10;
    const skip  = (page - 1) * limit;
    const q     = `%${dto.q.trim()}%`;

    const [songs, albums, artists] = await Promise.all([
      this.songs
        .createQueryBuilder('s')
        .where('s.status = :status', { status: SongStatus.LIVE })
        .andWhere('s.title ILIKE :q', { q })
        .orderBy('s.listen_count', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),

      this.albums
        .createQueryBuilder('a')
        .where('a.title ILIKE :q', { q })
        .orderBy('a.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),

      this.artistProfiles
        .createQueryBuilder('ap')
        .where('ap.stage_name ILIKE :q', { q })
        .orderBy('ap.follower_count', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
    ]);

    return {
      songs:   await Promise.all(songs.map((s)  => this.songsService.buildSongResponse(s))),
      albums:  await Promise.all(albums.map((a) => this.albumsService.buildAlbumSummary(a))),
      artists: artists.map((ap) => this.buildArtistResult(ap)),
    };
  }

  private buildArtistResult(ap: ArtistProfile) {
    return {
      id:            ap.id,
      userId:        ap.userId,
      stageName:     ap.stageName,
      bio:           ap.bio,
      avatarUrl:     ap.avatarUrl
        ? this.storage.getPublicUrl(this.storage.getBuckets().images, ap.avatarUrl)
        : null,
      followerCount: ap.followerCount,
    };
  }
}
