import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
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
import { UploadSongDto } from './dto/upload-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
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
  constructor(private readonly songsService: SongsService) {}

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

  // ── GET /songs/:id ────────────────────────────────────────────────────────

  @Get(':id')
  findOne(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.songsService.findById(requesterId, songId);
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

  // ── DELETE /songs/:id ─────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.songsService.remove(userId, songId);
  }
}
