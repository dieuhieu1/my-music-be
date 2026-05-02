import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminService } from './admin.service';
import { RejectSongDto } from './dto/reject-song.dto';
import { ReuploadRequiredDto } from './dto/reupload-required.dto';
import { RejectGenreSuggestionDto } from './dto/reject-genre-suggestion.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto';
import { AdminSongQueryDto } from './dto/admin-song-query.dto';
import { AdminGrantPremiumDto } from './dto/admin-grant-premium.dto';
import { AdminRevokePremiumDto } from './dto/admin-revoke-premium.dto';
import { CreateOfficialArtistDto } from './dto/create-official-artist.dto';
import { UpdateOfficialArtistDto } from './dto/update-official-artist.dto';
import { UpdateSongStatusDto } from './dto/update-song-status.dto';
import { AdminUploadSongDto } from '../songs/dto/admin-upload-song.dto';
import { ReportAdminQueryDto } from '../reports/dto/report-admin-query.dto';
import { ResolveReportDto } from '../reports/dto/resolve-report.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';
import { Role } from '../../common/enums';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 4B — Song approval queue (preserved)
  // ════════════════════════════════════════════════════════════════════════════

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

  // ── Phase 9 BL-85: general admin song list (replaces old queue endpoint) ──
  // Optional status param, defaults to PENDING — backward compatible
  @Get('songs')
  listSongs(@Query() query: AdminSongQueryDto) {
    return this.adminService.listSongsAdmin(query);
  }

  // ── Song detail ───────────────────────────────────────────────────────────
  @Get('songs/:id')
  getSongDetail(@Param('id', ParseUUIDPipe) songId: string) {
    return this.adminService.getAdminSongDetail(songId);
  }

  // ── Flexible status update (replaces separate approve/reject/restore/takedown) ──
  @Patch('songs/:id/status')
  @HttpCode(HttpStatus.OK)
  updateSongStatus(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) songId: string,
    @Body() dto: UpdateSongStatusDto,
  ) {
    return this.adminService.updateSongStatus(adminId, songId, dto);
  }

  // ── Admin song upload (bypasses PENDING, goes LIVE) ───────────────────────
  @Post('songs/upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'audio', maxCount: 1 },
        { name: 'coverArt', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
        fileFilter: (_, file, cb) => {
          const allowed = /^(audio\/(mpeg|flac|wav|x-wav|x-flac)|image\/(jpeg|jpg|png|webp))$/;
          cb(allowed.test(file.mimetype) ? null : new BadRequestException(`Unsupported file type: ${file.mimetype}`), allowed.test(file.mimetype));
        },
      },
    ),
  )
  uploadSong(
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminUploadSongDto,
    @UploadedFiles() files: { audio?: Express.Multer.File[]; coverArt?: Express.Multer.File[] },
  ) {
    if (!files?.audio?.[0]) throw new BadRequestException('Audio file is required');
    return this.adminService.adminUploadSong(adminId, dto, files.audio[0], files.coverArt?.[0]);
  }

  // ── Phase 4B audit endpoint (kept, uses old limit param) ──────────────────
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
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      action,
      adminId,
      from,
      to,
    });
  }

  // ── Phase 4B genre suggestions (preserved) ────────────────────────────────

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

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Audit (BL-40) — size param convention
  // ════════════════════════════════════════════════════════════════════════════

  @Get('audit')
  getAuditLogsPaginated(
    @Query('page')       page?:       string,
    @Query('size')       size?:       string,
    @Query('action')     action?:     string,
    @Query('adminId')    adminId?:    string,
    @Query('targetType') targetType?: string,
    @Query('from')       from?:       string,
    @Query('to')         to?:         string,
  ) {
    return this.adminService.getAuditLogs({
      page:       page       ? parseInt(page,  10) : undefined,
      size:       size       ? parseInt(size,  10) : undefined,
      action,
      adminId,
      targetType,
      from,
      to,
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — User management (BL-68–71)
  // ════════════════════════════════════════════════════════════════════════════

  @Get('users')
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:userId')
  getUserDetail(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Patch('users/:userId/roles')
  @HttpCode(HttpStatus.OK)
  updateUserRoles(
    @CurrentUser('id') adminId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.adminService.updateUserRoles(adminId, userId, dto);
  }

  @Get('users/:userId/sessions')
  getUserSessions(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.getUserSessions(userId);
  }

  @Delete('users/:userId/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUserSession(
    @Param('userId',    ParseUUIDPipe) userId:    string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.adminService.deleteUserSession(userId, sessionId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Payments (BL-74, BL-75)
  // ════════════════════════════════════════════════════════════════════════════

  @Get('payments')
  listPayments(@Query() query: AdminPaymentQueryDto) {
    return this.adminService.listPayments(query);
  }

  @Get('payments/manual-grants')
  listManualGrants(@Query() query: AdminPaymentQueryDto) {
    return this.adminService.listManualGrants(query);
  }

  @Post('payments/grant')
  @HttpCode(HttpStatus.CREATED)
  grantPremium(
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminGrantPremiumDto,
  ) {
    return this.adminService.adminGrantPremium(adminId, dto);
  }

  @Post('payments/revoke')
  @HttpCode(HttpStatus.OK)
  revokePremium(
    @CurrentUser('id') adminId: string,
    @Body() dto: AdminRevokePremiumDto,
  ) {
    return this.adminService.adminRevokePremiumAdmin(adminId, dto);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Reports (BL-38)
  // ════════════════════════════════════════════════════════════════════════════

  @Get('reports')
  listReports(@Query() query: ReportAdminQueryDto) {
    return this.adminService.listReports(query);
  }

  @Patch('reports/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  dismissReport(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.dismissReport(adminId, reportId, dto);
  }

  @Patch('reports/:id/takedown')
  @HttpCode(HttpStatus.OK)
  takedownReport(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.takedownReport(adminId, reportId, dto);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Official Artist Management
  // ════════════════════════════════════════════════════════════════════════════

  @Post('artists')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  createOfficialArtist(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateOfficialArtistDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.adminService.createOfficialArtist(adminId, dto, avatar);
  }

  @Get('artists')
  listOfficialArtists(
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listOfficialArtists(
      page ? parseInt(page, 10) : 1,
      size ? parseInt(size, 10) : 20,
      search,
    );
  }

  @Get('artists/:id')
  getOfficialArtistDetail(@Param('id', ParseUUIDPipe) artistId: string) {
    return this.adminService.getOfficialArtistDetail(artistId);
  }

  @Patch('artists/:id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  updateOfficialArtist(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) artistId: string,
    @Body() dto: UpdateOfficialArtistDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    return this.adminService.updateOfficialArtist(adminId, artistId, dto, avatar);
  }

  @Delete('artists/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOfficialArtist(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) artistId: string,
  ) {
    return this.adminService.deleteOfficialArtist(adminId, artistId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Phase 9 — Revenue summary
  // ════════════════════════════════════════════════════════════════════════════

  @Get('revenue/summary')
  getRevenueSummary() {
    return this.adminService.getRevenueSummary();
  }
}
