import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { RejectSongDto } from './dto/reject-song.dto';
import { ReuploadRequiredDto } from './dto/reupload-required.dto';
import { RejectGenreSuggestionDto } from './dto/reject-genre-suggestion.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums';
import { AuditService } from '../audit/audit.service';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  // ── Song approval queue ──────────────────────────────────────────────────

  @Get('songs')
  getSongApprovalQueue() {
    return this.adminService.getSongApprovalQueue();
  }

  @Patch('songs/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveSong(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.adminService.approveSong(adminId, songId);
  }

  @Patch('songs/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectSong(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) songId: string,
    @Body() dto: RejectSongDto,
  ) {
    return this.adminService.rejectSong(adminId, songId, dto);
  }

  @Patch('songs/:id/reupload-required')
  @HttpCode(HttpStatus.OK)
  requestReupload(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) songId: string,
    @Body() dto: ReuploadRequiredDto,
  ) {
    return this.adminService.requestReupload(adminId, songId, dto);
  }

  @Patch('songs/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreSong(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) songId: string,
  ) {
    return this.adminService.restoreSong(adminId, songId);
  }

  // ── Audit logs ───────────────────────────────────────────────────────────

  @Get('audit-logs')
  getAuditLogs(
    @Query('page')    page?:    string,
    @Query('limit')   limit?:   string,
    @Query('action')  action?:  string,
    @Query('adminId') adminId?: string,
    @Query('from')    from?:    string,
    @Query('to')      to?:      string,
  ) {
    return this.auditService.findAll({
      page:    page    ? parseInt(page,    10) : undefined,
      limit:   limit   ? parseInt(limit,   10) : undefined,
      action,
      adminId,
      from,
      to,
    });
  }

  // ── Genre suggestions ────────────────────────────────────────────────────

  @Get('genres/suggestions')
  getGenreSuggestions() {
    return this.adminService.findAllGenreSuggestions();
  }

  @Patch('genres/suggestions/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveGenreSuggestion(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) suggestionId: string,
  ) {
    return this.adminService.approveGenreSuggestion(adminId, suggestionId);
  }

  @Patch('genres/suggestions/:id/reject')
  @HttpCode(HttpStatus.OK)
  rejectGenreSuggestion(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) suggestionId: string,
    @Body() dto: RejectGenreSuggestionDto,
  ) {
    return this.adminService.rejectGenreSuggestion(adminId, suggestionId, dto);
  }
}
