import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../auth/entities/user.entity';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
  ) {}

  // ── GET /users/me ─────────────────────────────────────────────────────────

  async findMe(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.buildUserResponse(user);
  }

  // ── GET /users/:id (public) ────────────────────────────────────────────────

  async findById(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.buildPublicUserResponse(user);
  }

  // ── PATCH /users/me (BL-66) ───────────────────────────────────────────────

  async updateMe(userId: string, dto: UpdateUserDto, file?: Express.Multer.File) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.name !== undefined) user.name = dto.name;

    if (file) {
      // Overwrite-on-update: fixed object path, no stale key accumulation
      const objectName = `avatars/users/${userId}`;
      await this.storage.upload(
        this.storage.getBuckets().images,
        objectName,
        file.buffer,
        file.mimetype,
      );
      user.avatarUrl = objectName;
    }

    const saved = await this.users.save(user);
    return this.buildUserResponse(saved);
  }

  // ── Response builders ─────────────────────────────────────────────────────

  // Full profile — returned to the authenticated user only
  private async buildUserResponse(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: this.resolveAvatarUrl(user.avatarUrl),
      roles: user.roles,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      isPremium: user.isPremium,
      premiumExpiresAt: user.premiumExpiresAt,
      createdAt: user.createdAt,
    };
  }

  // Safe public profile — strips PII and auth fields
  private async buildPublicUserResponse(user: User) {
    return {
      id: user.id,
      name: user.name,
      avatarUrl: this.resolveAvatarUrl(user.avatarUrl),
      roles: user.roles,
      followerCount: user.followerCount,
      followingCount: user.followingCount,
      createdAt: user.createdAt,
    };
  }

  private resolveAvatarUrl(objectPath: string | null): string | null {
    if (!objectPath) return null;
    return this.storage.getPublicUrl(this.storage.getBuckets().images, objectPath);
  }
}
