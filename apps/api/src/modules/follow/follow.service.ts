import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import { Follow } from './entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { FeedEvent } from '../feed/entities/feed-event.entity';
import { FeedEventType, Role } from '../../common/enums';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(Follow)        private readonly follows:   Repository<Follow>,
    @InjectRepository(User)          private readonly users:     Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artists:   Repository<ArtistProfile>,
    @InjectRepository(FeedEvent)     private readonly feedEvents: Repository<FeedEvent>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  // ── BL-32: Follow an artist ───────────────────────────────────────────────

  async followArtist(followerId: string, artistUserId: string): Promise<void> {
    if (followerId === artistUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    // Use a transaction so follower counts and the follow row stay consistent
    // even under concurrent requests (db-use-transactions rule)
    await this.dataSource.transaction(async (manager) => {
      const artistUser = await manager.findOne(User, { where: { id: artistUserId } });
      if (!artistUser || !artistUser.roles.includes(Role.ARTIST)) {
        throw new NotFoundException('Artist not found');
      }
      const existing = await manager.findOne(Follow, {
        where: { followerId, followeeId: artistUserId },
      });
      if (existing) throw new ConflictException('Already following this artist');

      await manager.insert(Follow, { followerId, followeeId: artistUserId, type: 'ARTIST' });
      await manager.increment(User, { id: artistUserId }, 'followerCount', 1);
      await manager.increment(ArtistProfile, { userId: artistUserId }, 'followerCount', 1);
      await manager.increment(User, { id: followerId }, 'followingCount', 1);

      // BL-33: emit ARTIST_FOLLOWED feed event so actor's followers see it
      await manager.insert(FeedEvent, {
        actorId: followerId,
        eventType: FeedEventType.ARTIST_FOLLOWED,
        entityId: artistUserId,
        entityType: 'USER',
      });
    });
  }

  async unfollowArtist(followerId: string, artistUserId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const follow = await manager.findOne(Follow, {
        where: { followerId, followeeId: artistUserId, type: 'ARTIST' },
      });
      if (!follow) throw new NotFoundException('Not following this artist');

      await manager.delete(Follow, { id: follow.id });
      await manager.decrement(User, { id: artistUserId }, 'followerCount', 1);
      await manager.decrement(ArtistProfile, { userId: artistUserId }, 'followerCount', 1);
      await manager.decrement(User, { id: followerId }, 'followingCount', 1);
    });
  }

  // ── BL-32: Follow a user ─────────────────────────────────────────────────

  async followUser(followerId: string, followeeId: string): Promise<void> {
    if (followerId === followeeId) {
      throw new BadRequestException('Cannot follow yourself');
    }
    await this.dataSource.transaction(async (manager) => {
      const followee = await manager.findOne(User, { where: { id: followeeId } });
      if (!followee) throw new NotFoundException('User not found');

      const existing = await manager.findOne(Follow, {
        where: { followerId, followeeId },
      });
      if (existing) throw new ConflictException('Already following this user');

      await manager.insert(Follow, { followerId, followeeId, type: 'USER' });
      await manager.increment(User, { id: followeeId }, 'followerCount', 1);
      await manager.increment(User, { id: followerId }, 'followingCount', 1);
    });
  }

  async unfollowUser(followerId: string, followeeId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const follow = await manager.findOne(Follow, {
        where: { followerId, followeeId, type: 'USER' },
      });
      if (!follow) throw new NotFoundException('Not following this user');

      await manager.delete(Follow, { id: follow.id });
      await manager.decrement(User, { id: followeeId }, 'followerCount', 1);
      await manager.decrement(User, { id: followerId }, 'followingCount', 1);
    });
  }

  // ── Followers / following lists ──────────────────────────────────────────

  async getArtistFollowers(artistUserId: string, page: number, limit: number) {
    const [follows, total] = await this.follows.findAndCount({
      where: { followeeId: artistUserId, type: 'ARTIST' },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const followerIds = follows.map((f) => f.followerId);
    const usersMap =
      followerIds.length > 0
        ? new Map(
            (await this.users.find({ where: { id: In(followerIds) } })).map((u) => [u.id, u]),
          )
        : new Map<string, User>();

    const items = await Promise.all(
      follows.map(async (f) => {
        const u = usersMap.get(f.followerId);
        return {
          id: u?.id,
          name: u?.name,
          avatarUrl: u?.avatarUrl ? this.resolveAvatarUrl(u.avatarUrl) : null,
          followedAt: f.createdAt,
        };
      }),
    );

    return { items, total, page, limit };
  }

  async getUserFollowing(userId: string, page: number, limit: number) {
    const [follows, total] = await this.follows.findAndCount({
      where: { followerId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const followeeIds = follows.map((f) => f.followeeId);
    const usersMap =
      followeeIds.length > 0
        ? new Map(
            (await this.users.find({ where: { id: In(followeeIds) } })).map((u) => [u.id, u]),
          )
        : new Map<string, User>();

    const items = await Promise.all(
      follows.map(async (f) => {
        const u = usersMap.get(f.followeeId);
        return {
          id: u?.id,
          name: u?.name,
          avatarUrl: u?.avatarUrl ? this.resolveAvatarUrl(u.avatarUrl) : null,
          type: f.type,
          followedAt: f.createdAt,
        };
      }),
    );

    return { items, total, page, limit };
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.follows.existsBy({ followerId, followeeId });
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private resolveAvatarUrl(objectPath: string): string | null {
    return this.storage.getPublicUrl(this.storage.getBuckets().images, objectPath);
  }
}
