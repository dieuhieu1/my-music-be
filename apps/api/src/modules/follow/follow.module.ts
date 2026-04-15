import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FollowService } from './follow.service';
import { Follow } from './entities/follow.entity';
import { User } from '../auth/entities/user.entity';
import { ArtistProfile } from '../auth/entities/artist-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Follow, User, ArtistProfile])],
  providers: [FollowService],
  exports: [FollowService],
})
export class FollowModule {}
