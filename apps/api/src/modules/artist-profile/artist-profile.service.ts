import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { UpdateArtistProfileDto } from './dto/update-artist-profile.dto';

@Injectable()
export class ArtistProfileService {
  constructor(
    @InjectRepository(ArtistProfile) private readonly artists: Repository<ArtistProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
  ) {}

  // ── GET /artists/:id/profile (BL-11) ─────────────────────────────────────
  // :id is the artist's userId (the User record with ARTIST role)

  async findProfile(userId: string) {
    const profile = await this.artists.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Artist not found');

    // BL-11: increment listener count — fire-and-forget so it never delays
    // the response. The count is eventually consistent, which is fine here.
    this.artists.increment({ userId }, 'listenerCount', 1).catch(() => {});

    return this.buildArtistResponse(profile);
  }

  // ── PATCH /artists/me/profile (BL-67) ────────────────────────────────────

  async updateMyProfile(
    userId: string,
    dto: UpdateArtistProfileDto,
    file?: Express.Multer.File,
  ) {
    const profile = await this.artists.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Artist profile not found');

    if (dto.stageName !== undefined) profile.stageName = dto.stageName;
    if (dto.bio !== undefined) profile.bio = dto.bio ?? null;
    if (dto.socialLinks !== undefined) profile.socialLinks = dto.socialLinks ?? [];

    if (file) {
      const objectName = `avatars/artists/${userId}`;
      await this.storage.upload(
        this.storage.getBuckets().images,
        objectName,
        file.buffer,
        file.mimetype,
      );
      profile.avatarUrl = objectName;
    }

    const saved = await this.artists.save(profile);
    // Re-fetch with user relation since save() doesn't reload relations
    const reloaded = await this.artists.findOne({
      where: { id: saved.id },
      relations: ['user'],
    });
    return this.buildArtistResponse(reloaded!);
  }

  // ── GET /artists — paginated list with optional name search ──────────────

  async findAll(page: number, limit: number, search?: string) {
    const qb = this.artists
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.user', 'user')
      .orderBy('ap.followerCount', 'DESC');

    if (search?.trim()) {
      qb.where('LOWER(ap.stageName) LIKE :q', {
        q: `%${search.trim().toLowerCase()}%`,
      });
    }

    const [profiles, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = await Promise.all(profiles.map((p) => this.buildArtistResponse(p)));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Response builder ──────────────────────────────────────────────────────

  private async buildArtistResponse(profile: ArtistProfile) {
    const [artistAvatarUrl, userAvatarUrl] = await Promise.all([
      this.resolveAvatarUrl(profile.avatarUrl),
      this.resolveAvatarUrl(profile.user?.avatarUrl ?? null),
    ]);

    return {
      id: profile.id,
      userId: profile.userId,
      stageName: profile.stageName,
      bio: profile.bio,
      avatarUrl: artistAvatarUrl,
      followerCount: profile.followerCount,
      listenerCount: profile.listenerCount,
      socialLinks: profile.socialLinks,
      suggestedGenres: profile.suggestedGenres ?? [],
      user: profile.user
        ? { name: profile.user.name, avatarUrl: userAvatarUrl }
        : undefined,
      createdAt: profile.createdAt,
    };
  }

  private resolveAvatarUrl(objectPath: string | null): string | null {
    if (!objectPath) return null;
    return this.storage.getPublicUrl(this.storage.getBuckets().images, objectPath);
  }
}
