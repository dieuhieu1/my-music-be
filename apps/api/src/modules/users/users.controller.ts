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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { UsersService } from './users.service';
import { FollowService } from '../follow/follow.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../auth/entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly followService: FollowService,
  ) {}

  // ── GET /users/me — must be declared before :id to take precedence ─────────

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.findMe(user.id);
  }

  // ── PATCH /users/me (BL-66) ───────────────────────────────────────────────

  @Patch('me')
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
  updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.usersService.updateMe(user.id, dto, file);
  }

  // ── GET /users/:id (public) ────────────────────────────────────────────────

  @Public()
  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) userId: string) {
    return this.usersService.findById(userId);
  }

  // ── POST /users/:id/follow (BL-32) ────────────────────────────────────────

  @Post(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  followUser(
    @CurrentUser('id') followerId: string,
    @Param('id', ParseUUIDPipe) followeeId: string,
  ) {
    return this.followService.followUser(followerId, followeeId);
  }

  // ── DELETE /users/:id/follow (BL-32) ──────────────────────────────────────

  @Delete(':id/follow')
  @HttpCode(HttpStatus.NO_CONTENT)
  unfollowUser(
    @CurrentUser('id') followerId: string,
    @Param('id', ParseUUIDPipe) followeeId: string,
  ) {
    return this.followService.unfollowUser(followerId, followeeId);
  }

  // ── GET /users/:id/following (BL-32) ──────────────────────────────────────

  @Public()
  @Get(':id/following')
  getFollowing(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: PaginationDto,
  ) {
    return this.followService.getUserFollowing(userId, query.page ?? 1, query.limit ?? 20);
  }
}
