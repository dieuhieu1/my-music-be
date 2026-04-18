import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';

import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { PlaylistQueryDto } from './dto/playlist-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  // ── GET /playlists?page&limit — own playlists ─────────────────────────────

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query() dto: PlaylistQueryDto,
  ) {
    return this.playlistsService.findAll(userId, dto);
  }

  // ── GET /playlists/liked — special LikedSongs playlist ───────────────────

  @Get('liked')
  getLikedSongs(@CurrentUser('id') userId: string) {
    return this.playlistsService.getLikedSongs(userId);
  }

  // ── GET /playlists/saved — playlists saved by the current user ────────────

  @Get('saved')
  getSavedPlaylists(
    @CurrentUser('id') userId: string,
    @Query() dto: PlaylistQueryDto,
  ) {
    return this.playlistsService.getSavedPlaylists(userId, dto);
  }

  // ── GET /playlists/:id (BL-12) ───────────────────────────────────────────

  @Get(':id')
  findById(
    @CurrentUser('id') requesterId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
  ) {
    return this.playlistsService.findById(playlistId, requesterId);
  }

  // ── POST /playlists (BL-22) ──────────────────────────────────────────────

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistsService.create(userId, dto);
  }

  // ── PATCH /playlists/:id ─────────────────────────────────────────────────

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Body() dto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(userId, playlistId, dto);
  }

  // ── DELETE /playlists/:id (BL-17) ────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
  ) {
    return this.playlistsService.remove(userId, playlistId);
  }

  // ── POST /playlists/:id/songs ─────────────────────────────────────────────

  @Post(':id/songs')
  addSong(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Body() dto: AddSongDto,
  ) {
    return this.playlistsService.addSong(userId, playlistId, dto);
  }

  // ── DELETE /playlists/:id/songs/:songId ───────────────────────────────────

  @Delete(':id/songs/:songId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSong(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
    @Param('songId', ParseUUIDPipe) songId: string,
  ) {
    return this.playlistsService.removeSong(userId, playlistId, songId);
  }

  // ── POST /playlists/:id/save (BL-13) ─────────────────────────────────────

  @Post(':id/save')
  savePlaylist(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
  ) {
    return this.playlistsService.savePlaylist(userId, playlistId);
  }

  // ── DELETE /playlists/:id/save ────────────────────────────────────────────

  @Delete(':id/save')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsavePlaylist(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) playlistId: string,
  ) {
    return this.playlistsService.unsavePlaylist(userId, playlistId);
  }
}
