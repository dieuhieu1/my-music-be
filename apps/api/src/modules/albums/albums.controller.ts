import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { AlbumsService } from './albums.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { UpdateAlbumDto } from './dto/update-album.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';

const coverArtInterceptor = FileInterceptor('coverArt', {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new BadRequestException('Cover art must be JPEG, PNG, or WebP'), false);
    }
  },
});

@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  // ── GET /albums (public paginated browse) ────────────────────────────────

  @Get()
  @Public()
  browse(
    @Query('page',  new DefaultValuePipe(1),  ParseIntPipe) page:  number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.albumsService.browsePaginated(page, Math.min(limit, 100));
  }

  // ── GET /albums/mine (artist's own albums) ───────────────────────────────

  @Get('mine')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  findMine(@CurrentUser('id') userId: string) {
    return this.albumsService.findAllByUser(userId);
  }

  // ── GET /albums/:id (public) ──────────────────────────────────────────────

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseUUIDPipe) albumId: string) {
    return this.albumsService.findById(albumId);
  }

  // ── POST /albums ──────────────────────────────────────────────────────────

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  @UseInterceptors(coverArtInterceptor)
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAlbumDto,
    @UploadedFile() coverArtFile?: Express.Multer.File,
  ) {
    return this.albumsService.create(userId, dto, coverArtFile);
  }

  // ── PATCH /albums/:id ─────────────────────────────────────────────────────

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  @UseInterceptors(coverArtInterceptor)
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) albumId: string,
    @Body() dto: UpdateAlbumDto,
    @UploadedFile() coverArtFile?: Express.Multer.File,
  ) {
    return this.albumsService.update(userId, albumId, dto, coverArtFile);
  }

  // ── DELETE /albums/:id (BL-18) ────────────────────────────────────────────

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) albumId: string,
  ) {
    return this.albumsService.remove(userId, albumId);
  }
}
