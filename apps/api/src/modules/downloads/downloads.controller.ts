import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import { DownloadsService } from './downloads.service';
import { RevalidateDownloadsDto } from './dto/revalidate-downloads.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Prefix 'songs' so routes resolve as:
//   POST   /songs/:songId/download
//   GET    /songs/downloads
//   POST   /songs/downloads/revalidate
//   DELETE /songs/downloads/:songId
//
// This controller is registered in AppModule BEFORE SongsModule so that
// static segments ('downloads') match before the dynamic ':songId' param
// in SongsController.
@Controller('songs')
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  @Get('downloads')
  getDownloads(@CurrentUser('id') userId: string) {
    return this.downloadsService.getDownloads(userId);
  }

  @Post('downloads/revalidate')
  @HttpCode(HttpStatus.OK)
  revalidate(
    @CurrentUser('id') userId: string,
    @Body() dto: RevalidateDownloadsDto,
  ) {
    return this.downloadsService.revalidateDownloads(userId, dto);
  }

  @Delete('downloads/:songId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDownload(
    @CurrentUser('id') userId: string,
    @Param('songId', ParseUUIDPipe) songId: string,
  ) {
    return this.downloadsService.removeDownload(userId, songId);
  }

  @Post(':songId/download')
  @HttpCode(HttpStatus.CREATED)
  downloadSong(
    @CurrentUser('id') userId: string,
    @Param('songId', ParseUUIDPipe) songId: string,
  ) {
    return this.downloadsService.downloadSong(userId, songId);
  }
}
