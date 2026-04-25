import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { SongsService } from './songs.service';
import { PlaylistsService } from '../playlists/playlists.service';
import { UploadSongDto } from './dto/upload-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { ResubmitSongDto } from './dto/resubmit-song.dto';
import { BrowseSongsDto } from './dto/browse-songs.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { Role } from '../../common/enums';

// Shared multer config — 50 MB limit covers both audio and cover art
const uploadInterceptor = FileFieldsInterceptor(
  [
    { name: 'audio', maxCount: 1 },
    { name: 'coverArt', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (_, file, cb) => {
      const allowed = /^(audio\/(mpeg|flac|wav|x-wav|x-flac)|image\/(jpeg|jpg|png|webp))$/;
      if (allowed.test(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
      }
    },
  },
);

type UploadedFileMap = {
  audio?: Express.Multer.File[];
  coverArt?: Express.Multer.File[];
};

@Controller('songs')
export class SongsController {
  constructor(
    private readonly songsService: SongsService,
    private readonly playlistsService: PlaylistsService,
  ) {}

  // ── GET /songs (BL-09: public browse, LIVE songs only) ───────────────────

  @Get()
  @Public()
  browse(@Query() dto: BrowseSongsDto) {
    return this.songsService.browse(dto);
  }

  // ── POST /songs/upload (BL-48, BL-39, BL-44) ─────────────────────────────

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  @UseInterceptors(uploadInterceptor)
  upload(
    @CurrentUser('id') userId: string,
    @Body() dto: UploadSongDto,
    @UploadedFiles() files: UploadedFileMap,
  ) {
    const audioFile = files.audio?.[0];
    if (!audioFile) throw new BadRequestException('Audio file is required (field name: "audio")');
    return this.songsService.upload(userId, dto, audioFile, files.coverArt?.[0]);
  }

  // ── GET /songs/mine (own songs — used by D2 My Songs list) ────────────────

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  findMine(@CurrentUser('id') userId: string) {
    return this.songsService.findAllByUser(userId);
  }

  // ── GET /songs/:id (BL-09: increments listenCount for LIVE songs) ──────────

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @CurrentUser('id') requesterId: string | null,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.songsService.findById(requesterId, songId);
  }

  // ── GET /songs/:id/stream (BL-28: 15-min presigned URL) ──────────────────

  @Get(':id/stream')
  stream(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.songsService.getStreamUrl(requesterId, songId);
  }

  // ── PATCH /songs/:id ──────────────────────────────────────────────────────

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'coverArt', maxCount: 1 }], {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_, file, cb) => {
        if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Cover art must be JPEG, PNG, or WebP'), false);
      },
    }),
  )
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) songId: string,
    @Body() dto: UpdateSongDto,
    @UploadedFiles() files?: { coverArt?: Express.Multer.File[] },
  ) {
    return this.songsService.update(userId, songId, dto, files?.coverArt?.[0]);
  }

  // ── PATCH /songs/:id/resubmit (BL-85) ────────────────────────────────────

  @Patch(':id/resubmit')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  resubmit(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) songId: string,
    @Body() dto: ResubmitSongDto,
  ) {
    return this.songsService.resubmit(userId, songId, dto);
  }

  // ── DELETE /songs/:id ─────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.songsService.remove(userId, songId);
  }

  // ── POST /songs/:id/like (BL-34) ──────────────────────────────────────────

  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  likeSong(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.playlistsService.likeSong(userId, songId);
  }

  // ── DELETE /songs/:id/like (BL-34) ────────────────────────────────────────

  @Delete(':id/like')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlikeSong(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.playlistsService.unlikeSong(userId, songId);
  }
}
