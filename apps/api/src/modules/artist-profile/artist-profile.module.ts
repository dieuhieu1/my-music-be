import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArtistProfileController } from './artist-profile.controller';
import { ArtistProfileService } from './artist-profile.service';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';
import { User } from '../auth/entities/user.entity';
import { FollowModule } from '../follow/follow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArtistProfile, User]),
    FollowModule, // provides FollowService for follow/unfollow/followers endpoints
  ],
  controllers: [ArtistProfileController],
  providers: [ArtistProfileService],
  exports: [ArtistProfileService],
})
export class ArtistProfileModule {}
