import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ArtistProfileService } from './artist-profile.service';
import { FollowService } from '../follow/follow.service';
import { UpdateArtistProfileDto } from './dto/update-artist-profile.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';

@Controller('artists')
export class ArtistProfileController {
  constructor(
    private readonly artistProfileService: ArtistProfileService,
    private readonly followService: FollowService,
  ) {}

  // ── PATCH /artists/me/profile (BL-67) ────────────────────────────────────
  // Declared before :id routes — 'me' is a literal segment, not a UUID param.

  @Patch('me/profile')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_, file, cb) => {
        if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPEG, PNG, WebP images are allowed'), false);
        }
      },
    }),
  )
  updateMyProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateArtistProfileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.artistProfileService.updateMyProfile(userId, dto, file);
  }

  // ── GET /artists/:id/profile (BL-11) ─────────────────────────────────────

  @Public()
  @Get(':id/profile')
  getProfile(@Param('id', ParseUUIDPipe) userId: string) {
    return this.artistProfileService.findProfile(userId);
  }

  // ── POST /artists/:id/follow (BL-32) ─────────────────────────────────────

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  followArtist(
    @CurrentUser('id') followerId: string,
    @Param('id', ParseUUIDPipe) artistUserId: string,
  ) {
    return this.followService.followArtist(followerId, artistUserId);
  }

  // ── DELETE /artists/:id/follow (BL-32) ───────────────────────────────────

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollowArtist(
    @CurrentUser('id') followerId: string,
    @Param('id', ParseUUIDPipe) artistUserId: string,
  ) {
    return this.followService.unfollowArtist(followerId, artistUserId);
  }

  // ── GET /artists/:id/is-following (auth required) ────────────────────────
  // Returns { isFollowing: boolean } so the FE can initialise FollowButton state.

  @Get(':id/is-following')
  async isFollowing(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) artistUserId: string,
  ) {
    const isFollowing = await this.followService.isFollowing(userId, artistUserId);
    return { isFollowing };
  }

  // ── GET /artists/:id/followers (BL-32) ───────────────────────────────────

  @Public()
  @Get(':id/followers')
  getFollowers(
    @Param('id', ParseUUIDPipe) artistUserId: string,
    @Query() query: PaginationDto,
  ) {
    return this.followService.getArtistFollowers(artistUserId, query.page ?? 1, query.limit ?? 20);
  }
}
