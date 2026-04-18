import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { PlaybackService } from './playback.service';
import { AddToQueueDto } from './dto/add-to-queue.dto';
import { ReorderQueueDto } from './dto/reorder-queue.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('queue')
export class QueueController {
  constructor(private readonly playbackService: PlaybackService) {}

  // ── GET /queue ────────────────────────────────────────────────────────────

  @Get()
  getQueue(@CurrentUser('id') userId: string) {
    return this.playbackService.getQueue(userId);
  }

  // ── POST /queue ───────────────────────────────────────────────────────────

  @Post()
  addToQueue(
    @CurrentUser('id') userId: string,
    @Body() dto: AddToQueueDto,
  ) {
    return this.playbackService.addToQueue(userId, dto);
  }

  // ── PATCH /queue/reorder ──────────────────────────────────────────────────

  @Patch('reorder')
  reorder(
    @CurrentUser('id') userId: string,
    @Body() dto: ReorderQueueDto,
  ) {
    return this.playbackService.reorderQueue(userId, dto);
  }

  // ── PATCH /queue/smart-order (BL-37C) ─────────────────────────────────────

  @Patch('smart-order')
  smartOrder(@CurrentUser('id') userId: string) {
    return this.playbackService.smartOrder(userId);
  }

  // ── DELETE /queue/:id ─────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeItem(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) itemId: string,
  ) {
    return this.playbackService.removeFromQueue(userId, itemId);
  }

  // ── DELETE /queue (BL-03: clear all — called on logout) ──────────────────

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clearQueue(@CurrentUser('id') userId: string) {
    return this.playbackService.clearQueue(userId);
  }
}
