import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response } from 'express';

import { User } from './entities/user.entity';
import { ArtistProfile } from './entities/artist-profile.entity';
import { Session } from './entities/session.entity';
import { PasswordReset } from './entities/password-reset.entity';
import { VerificationCode } from './entities/verification-code.entity';
import { Role, DeviceType } from '../../common/enums';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';

import {
  RegisterDto,
  RegisterArtistDto,
} from './dto/register.dto';
import {
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  VerifyCodeDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
} from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 min
const CODE_TTL_MIN = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ArtistProfile) private readonly artists: Repository<ArtistProfile>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
    @InjectRepository(VerificationCode) private readonly codes: Repository<VerificationCode>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private generate6DigitCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private cookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      maxAge: maxAgeMs,
    };
  }

  private accessTtlMs(): number {
    // e.g. "15m" → 15 * 60 * 1000
    const raw = this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const [, n, unit] = match;
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return parseInt(n) * multipliers[unit];
  }

  private refreshTtlMs(): number {
    const raw = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 86_400_000;
    const [, n, unit] = match;
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return parseInt(n) * multipliers[unit];
  }

  private issueTokens(user: User, jti: string) {
    const payload: JwtPayload = { sub: user.id, email: user.email, roles: user.roles };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN') ?? '15m',
    });
    const refreshToken = this.jwt.sign(
      { sub: user.id, jti },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN') ?? '30d',
      },
    );
    return { accessToken, refreshToken };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, this.cookieOptions(this.accessTtlMs()));
    res.cookie('refresh_token', refreshToken, this.cookieOptions(this.refreshTtlMs()));
  }

  private clearAuthCookies(res: Response) {
    const opts = {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    res.clearCookie('access_token', opts);
    res.clearCookie('refresh_token', opts);
  }

  private parseDeviceType(ua: string): DeviceType {
    if (/mobile|android|iphone/i.test(ua)) return DeviceType.MOBILE;
    if (/tablet|ipad/i.test(ua)) return DeviceType.TABLET;
    if (/windows|macintosh|linux/i.test(ua)) return DeviceType.DESKTOP;
    return DeviceType.OTHER;
  }

  private safeUser(user: User) {
    const { passwordHash, failedAttempts, lockUntil, ...safe } = user as any;
    if (safe.avatarUrl) {
      safe.avatarUrl = this.storage.getPublicUrl(
        this.storage.getBuckets().images,
        safe.avatarUrl,
      );
    }
    return safe;
  }

  // ── Register USER (BL-01) ─────────────────────────────────────────────────

  async register(dto: RegisterDto, res: Response) {
    const exists = await this.users.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      roles: [Role.USER],
    });
    await this.users.save(user);

    await this.sendVerificationCode(user.email);

    return { message: 'Registration successful. Check your email for a verification code.' };
  }

  // ── Register ARTIST (BL-46 + BL-47 atomic) ───────────────────────────────

  async registerArtist(dto: RegisterArtistDto, res: Response) {
    const exists = await this.users.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    await this.dataSource.transaction(async (em) => {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = em.create(User, {
        name: dto.name,
        email: dto.email,
        passwordHash,
        roles: [Role.USER, Role.ARTIST],
      });
      await em.save(user);

      const profile = em.create(ArtistProfile, {
        userId: user.id,
        stageName: dto.stageName,
        bio: dto.bio ?? null,
      });
      await em.save(profile);
    });

    await this.sendVerificationCode(dto.email);

    return { message: 'Artist registration successful. Check your email for a verification code.' };
  }

  // ── Login (BL-02, BL-43 brute-force) ─────────────────────────────────────

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.isLocked) {
      throw new ForbiddenException('Account locked. Try again later or reset your password.');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await this.users.save(user);
        // Queue lock notification email
        await this.emailQueue.add('account-locked', {
          to: user.email,
          subject: 'Your account has been locked',
          html: this.mail.accountLockedEmail(),
        });
        throw new ForbiddenException('Account locked due to too many failed attempts. Check your email.');
      }
      await this.users.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified. Please verify your email first.');
    }

    // Reset failed attempts on success
    user.failedAttempts = 0;
    user.lockUntil = null;
    await this.users.save(user);

    // Create session
    const jti = uuidv4();
    const ua = req.headers['user-agent'] ?? '';
    const session = this.sessions.create({
      userId: user.id,
      refreshTokenId: jti,
      deviceType: this.parseDeviceType(ua),
      deviceName: ua.slice(0, 200) || null,
      ipAddress: (req.ip ?? '').slice(0, 45),
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
    });
    await this.sessions.save(session);

    const { accessToken, refreshToken } = this.issueTokens(user, jti);
    this.setAuthCookies(res, accessToken, refreshToken);

    // accessToken included in body for admin portal (Bearer auth); web app reads httpOnly cookie
    return { user: this.safeUser(user), accessToken };
  }

  // ── Logout (BL-03) ────────────────────────────────────────────────────────

  async logout(userId: string, req: Request, res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    if (refreshToken) {
      try {
        const payload = this.jwt.verify(refreshToken, {
          secret: this.config.get('JWT_REFRESH_SECRET'),
        }) as { sub: string; jti: string };
        await this.sessions.softDelete({ refreshTokenId: payload.jti, userId });
      } catch {
        // Refresh token already expired/invalid — cron will clean up the session
      }
    }
    this.clearAuthCookies(res);
    return { message: 'Logged out' };
  }

  // ── Refresh with rotation (BL-04) ─────────────────────────────────────────

  async refresh(user: User, session: Session, req: Request, res: Response) {
    // Rotate: invalidate old session, create new one
    await this.sessions.softDelete({ id: session.id });

    const jti = uuidv4();
    const ua = req.headers['user-agent'] ?? '';
    const newSession = this.sessions.create({
      userId: user.id,
      refreshTokenId: jti,
      deviceType: this.parseDeviceType(ua),
      deviceName: ua.slice(0, 200) || null,
      ipAddress: (req.ip ?? '').slice(0, 45),
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
    });
    await this.sessions.save(newSession);

    const { accessToken, refreshToken } = this.issueTokens(user, jti);
    this.setAuthCookies(res, accessToken, refreshToken);

    return { user: this.safeUser(user) };
  }

  // ── Change password (BL-05) ───────────────────────────────────────────────

  async changePassword(user: User, dto: ChangePasswordDto) {
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.users.save(user);
    return { message: 'Password changed successfully' };
  }

  // ── Forgot password (BL-06) ───────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.users.findOne({ where: { email: dto.email } });
    // Always return success to avoid user enumeration
    if (!user) return { message: 'If that email exists, a reset code was sent.' };

    const code = this.generate6DigitCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);

    // Invalidate any previous unused codes
    await this.resets.update({ email: dto.email, used: false }, { used: true });

    const reset = this.resets.create({
      email: dto.email,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
    });
    await this.resets.save(reset);

    await this.emailQueue.add('password-reset', {
      to: dto.email,
      subject: 'Reset your password',
      html: this.mail.passwordResetEmail(code),
    });

    return { message: 'If that email exists, a reset code was sent.' };
  }

  // ── Verify reset code (BL-07) ─────────────────────────────────────────────

  async verifyCode(dto: VerifyCodeDto) {
    const reset = await this.resets.findOne({
      where: { email: dto.email, used: false },
      order: { createdAt: 'DESC' },
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    const valid = await bcrypt.compare(dto.code, reset.codeHash);
    if (!valid) throw new BadRequestException('Invalid or expired code');

    return { message: 'Code verified' };
  }

  // ── Reset password (BL-08) ────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.resets.findOne({
      where: { email: dto.email, used: false },
      order: { createdAt: 'DESC' },
    });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired code');
    }
    const valid = await bcrypt.compare(dto.code, reset.codeHash);
    if (!valid) throw new BadRequestException('Invalid or expired code');

    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User not found');

    user.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    user.failedAttempts = 0;
    user.lockUntil = null;

    reset.used = true;

    await this.dataSource.transaction(async (em) => {
      await em.save(user);
      await em.save(reset);
      // Revoke all sessions on password reset (security)
      await em.softDelete(Session, { userId: user.id });
    });

    return { message: 'Password reset successfully. Please log in.' };
  }

  // ── Verify email (BL-78) ──────────────────────────────────────────────────

  async verifyEmail(dto: VerifyEmailDto) {
    const code = await this.codes.findOne({
      where: { email: dto.email, used: false },
      order: { createdAt: 'DESC' },
    });
    if (!code || code.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification code');
    }
    const valid = await bcrypt.compare(dto.code, code.codeHash);
    if (!valid) throw new BadRequestException('Invalid or expired verification code');

    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user) throw new NotFoundException('User not found');

    user.isEmailVerified = true;
    code.used = true;

    await this.dataSource.transaction(async (em) => {
      await em.save(user);
      await em.save(code);
    });

    return { message: 'Email verified successfully' };
  }

  // ── Resend verification (BL-79) ───────────────────────────────────────────

  async resendVerification(dto: ResendVerificationDto) {
    const user = await this.users.findOne({ where: { email: dto.email } });
    if (!user || user.isEmailVerified) {
      // Prevent enumeration + avoid revealing verification state
      return { message: 'If applicable, a new verification code has been sent.' };
    }

    await this.sendVerificationCode(dto.email);
    return { message: 'If applicable, a new verification code has been sent.' };
  }

  // ── Sessions (BL-42) ──────────────────────────────────────────────────────

  async getSessions(userId: string) {
    return this.sessions.find({
      where: { userId },
      order: { lastSeenAt: 'DESC' },
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId, userId } });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessions.softDelete({ id: sessionId });
    return { message: 'Session revoked' };
  }

  // ── Internal helper ───────────────────────────────────────────────────────

  private async sendVerificationCode(email: string): Promise<void> {
    const code = this.generate6DigitCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);

    // Invalidate previous codes
    await this.codes.update({ email, used: false }, { used: true });

    const vc = this.codes.create({
      email,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000),
    });
    await this.codes.save(vc);

    await this.emailQueue.add('verify-email', {
      to: email,
      subject: 'Verify your email',
      html: this.mail.verificationEmail(code),
    });
  }
}
