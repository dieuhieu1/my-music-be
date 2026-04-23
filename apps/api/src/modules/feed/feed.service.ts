import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { FeedEvent } from './entities/feed-event.entity';
import { Follow } from '../follow/entities/follow.entity';
import { Song } from '../songs/entities/song.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { StorageService } from '../storage/storage.service';
import { FeedEventType } from '../../common/enums';
import { FeedQueryDto } from './dto/feed-query.dto';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(FeedEvent)    private readonly feedEvents:    Repository<FeedEvent>,
    @InjectRepository(Follow)       private readonly follows:       Repository<Follow>,
    @InjectRepository(Song)         private readonly songs:         Repository<Song>,
    @InjectRepository(Playlist)     private readonly playlists:     Repository<Playlist>,
    @InjectRepository(User)         private readonly users:         Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artistProfiles: Repository<ArtistProfile>,
    private readonly storage: StorageService,
  ) {}

  // ── GET /feed (BL-33) ────────────────────────────────────────────────────

  async getFeed(userId: string, dto: FeedQueryDto) {
    const { page = 1, limit = 20 } = dto;

    // Find all users/artists the current user follows
    const following = await this.follows.find({ where: { followerId: userId } });
    const followedIds = following.map((f) => f.followeeId);

    if (followedIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }

    // Fetch paginated feed events from followed actors, newest first
    const [events, total] = await this.feedEvents.findAndCount({
      where: { actorId: In(followedIds) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (events.length === 0) {
      return { items: [], total, page, limit };
    }

    // Batch-resolve actor display info
    const actorIds = [...new Set(events.map((e) => e.actorId))];
    const actorUsers = await this.users.findBy({ id: In(actorIds) });
    const actorProfiles = await this.artistProfiles.findBy({ userId: In(actorIds) });
    const userMap = new Map<string, User>(actorUsers.map((u) => [u.id, u] as [string, User]));
    const profileMap = new Map<string, ArtistProfile>(actorProfiles.map((ap) => [ap.userId, ap] as [string, ArtistProfile]));

    // Batch-resolve entity data (songs, playlists)
    const songIds = events
      .filter((e) => e.entityType === 'SONG' && e.entityId)
      .map((e) => e.entityId as string);
    const playlistIds = events
      .filter((e) => e.entityType === 'PLAYLIST' && e.entityId)
      .map((e) => e.entityId as string);

    const [songsArr, playlistsArr] = await Promise.all([
      songIds.length > 0 ? this.songs.findBy({ id: In(songIds) }) : ([] as Song[]),
      playlistIds.length > 0 ? this.playlists.findBy({ id: In(playlistIds) }) : ([] as Playlist[]),
    ]);
    const songMap = new Map<string, Song>(songsArr.map((s) => [s.id, s] as [string, Song]));
    const playlistMap = new Map<string, Playlist>(playlistsArr.map((p) => [p.id, p] as [string, Playlist]));

    const items = events.map((event) => this.buildFeedItem(event, userMap, profileMap, songMap, playlistMap));

    return { items, total, page, limit };
  }

  // ── createEvent (used by DropsService on drop fire) ──────────────────────

  async createEvent(
    actorId: string,
    eventType: FeedEventType,
    entityId?: string,
    entityType?: string,
  ): Promise<void> {
    await this.feedEvents.save(
      this.feedEvents.create({
        actorId,
        eventType,
        entityId: entityId ?? null,
        entityType: entityType ?? null,
      }),
    );
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildFeedItem(
    event: FeedEvent,
    userMap: Map<string, User>,
    profileMap: Map<string, ArtistProfile>,
    songMap: Map<string, Song>,
    playlistMap: Map<string, Playlist>,
  ) {
    const actor = userMap.get(event.actorId);
    const profile = profileMap.get(event.actorId);
    const actorAvatarUrl = actor?.avatarUrl
      ? this.storage.getPublicUrl(this.storage.getBuckets().images, actor.avatarUrl)
      : null;

    const base = {
      id: event.id,
      eventType: event.eventType,
      actorId: event.actorId,
      actorName: profile?.stageName ?? actor?.name ?? 'Unknown',
      actorAvatarUrl,
      createdAt: event.createdAt,
      entity: null as unknown,
    };

    if (event.entityType === 'SONG' && event.entityId) {
      const song = songMap.get(event.entityId);
      if (song) {
        base.entity = {
          type: 'SONG',
          id: song.id,
          title: song.title,
          coverArtUrl: song.coverArtUrl
            ? this.storage.getPublicUrl(this.storage.getBuckets().images, song.coverArtUrl)
            : null,
        };
      }
    } else if (event.entityType === 'PLAYLIST' && event.entityId) {
      const playlist = playlistMap.get(event.entityId);
      if (playlist) {
        base.entity = {
          type: 'PLAYLIST',
          id: playlist.id,
          title: playlist.title,
          coverArtUrl: playlist.coverArtUrl
            ? this.storage.getPublicUrl(this.storage.getBuckets().images, playlist.coverArtUrl)
            : null,
          totalTracks: playlist.totalTracks,
        };
      }
    } else if (event.eventType === FeedEventType.ARTIST_FOLLOWED && event.entityId) {
      const followedUser = userMap.get(event.entityId);
      const followedProfile = profileMap.get(event.entityId);
      base.entity = {
        type: 'USER',
        id: event.entityId,
        name: followedProfile?.stageName ?? followedUser?.name ?? 'Unknown',
      };
    }

    return base;
  }
}
