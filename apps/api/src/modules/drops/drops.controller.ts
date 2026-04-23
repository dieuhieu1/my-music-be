import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { DropsService } from './drops.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { RescheduleDropDto } from './dto/reschedule-drop.dto';

@Controller()
export class DropsController {
  constructor(private readonly dropsService: DropsService) {}

  // ── GET /songs/:songId/teaser (BL-60) — @Public ──────────────────────────

  @Public()
  @Get('songs/:songId/teaser')
  getTeaser(@Param('songId') songId: string) {
    return this.dropsService.getTeaser(songId);
  }

  // ── POST /songs/:songId/notify (BL-64 opt-in) — JWT ─────────────────────

  @Post('songs/:songId/notify')
  optIn(@CurrentUser('id') userId: string, @Param('songId') songId: string) {
    return this.dropsService.optIn(userId, songId);
  }

  // ── DELETE /songs/:songId/notify (BL-64 opt-out) — JWT ──────────────────

  @Delete('songs/:songId/notify')
  optOut(@CurrentUser('id') userId: string, @Param('songId') songId: string) {
    return this.dropsService.optOut(userId, songId);
  }

  // ── DELETE /songs/:songId/drop (BL-63) — ARTIST ──────────────────────────

  @Roles(Role.ARTIST, Role.ADMIN)
  @Delete('songs/:songId/drop')
  cancelDrop(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Param('songId') songId: string,
  ) {
    return this.dropsService.cancelDrop(userId, songId, roles);
  }

  // ── PATCH /songs/:songId/drop (BL-65) — ARTIST ───────────────────────────

  @Roles(Role.ARTIST, Role.ADMIN)
  @Patch('songs/:songId/drop')
  rescheduleDrop(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
    @Param('songId') songId: string,
    @Body() dto: RescheduleDropDto,
  ) {
    return this.dropsService.rescheduleDrop(userId, songId, dto, roles);
  }

  // ── GET /drops (BL-59) — ARTIST|ADMIN ────────────────────────────────────

  @Roles(Role.ARTIST, Role.ADMIN)
  @Get('drops')
  getDrops(
    @CurrentUser('id') userId: string,
    @CurrentUser('roles') roles: string[],
  ) {
    return this.dropsService.getDrops(userId, roles);
  }
}
