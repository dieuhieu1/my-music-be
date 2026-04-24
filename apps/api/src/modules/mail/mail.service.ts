import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = config.get<string>('SMTP_FROM') ?? 'noreply@mymusic.local';
    const host = config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = config.get<number>('SMTP_PORT') ?? 1025;
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    const isGmail = host.includes('gmail.com');

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: isGmail,
      auth: user ? { user, pass } : undefined,
      tls: isGmail ? { rejectUnauthorized: true } : undefined,
    });
  }

  async send(opts: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, ...opts });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${(err as Error).message}`);
      throw err;
    }
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  verificationEmail(code: string): string {
    return `<h2>Verify your email</h2>
<p>Your 6-digit verification code is:</p>
<h1 style="letter-spacing:8px">${code}</h1>
<p>This code expires in 15 minutes.</p>`;
  }

  passwordResetEmail(code: string): string {
    return `<h2>Password Reset</h2>
<p>Your 6-digit reset code is:</p>
<h1 style="letter-spacing:8px">${code}</h1>
<p>This code expires in 15 minutes. If you didn't request a reset, ignore this email.</p>`;
  }

  accountLockedEmail(): string {
    return `<h2>Account Temporarily Locked</h2>
<p>Your account has been locked due to too many failed login attempts.</p>
<p>It will be automatically unlocked after 15 minutes.</p>
<p>If this wasn't you, please reset your password immediately.</p>`;
  }

  premiumActivatedEmail(expiresAt: Date): string {
    return `<h2>Premium Activated!</h2>
<p>Your My Music Premium subscription is now active.</p>
<p>Expires: <strong>${expiresAt.toDateString()}</strong></p>
<p>Enjoy unlimited downloads and ad-free listening!</p>`;
  }

  premiumRevokedEmail(): string {
    return `<h2>Premium Subscription Ended</h2>
<p>Your My Music Premium subscription has been deactivated.</p>
<p>Your downloaded tracks are no longer available for offline listening.</p>`;
  }

  songApprovedEmail(songTitle: string): string {
    return `<h2>Your song has been approved!</h2>
<p><strong>${songTitle}</strong> has been reviewed and approved by our team.</p>
<p>It is now live on My Music for listeners to enjoy.</p>`;
  }

  songRejectedEmail(songTitle: string, reason: string): string {
    return `<h2>Song Review Update</h2>
<p>Unfortunately, <strong>${songTitle}</strong> did not pass our review process.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>If you believe this decision was made in error, please contact support.</p>`;
  }

  songReuploadRequiredEmail(songTitle: string, notes: string): string {
    return `<h2>Action Required: Re-upload Your Song</h2>
<p>Our team has reviewed <strong>${songTitle}</strong> and requires changes before it can go live.</p>
<p><strong>Notes from reviewer:</strong> ${notes}</p>
<p>Please log in to your dashboard to re-upload the corrected file.</p>`;
  }

  songRestoredEmail(songTitle: string): string {
    return `<h2>Song Restored</h2>
<p><strong>${songTitle}</strong> has been restored and is now live again on My Music.</p>`;
  }

  // Phase 9: report takedown (BL-38)
  songTakenDownEmail(songTitle: string): string {
    return `<h2>Content Taken Down</h2>
<p>Your song <strong>${songTitle}</strong> has been taken down following a community report.</p>
<p>If you believe this was done in error, please contact support.</p>`;
  }

  // ── Drop email templates (Phase 8 — BL-61, BL-63, BL-65) ─────────────────

  upcomingDropEmail(songTitle: string, artistName: string, dropAt: Date, is24h: boolean): string {
    const timeLabel = is24h ? '24 hours' : '1 hour';
    return `<h2>Upcoming Drop Alert</h2>
<p><strong>${artistName}</strong> is dropping "<strong>${songTitle}</strong>" in ${timeLabel}!</p>
<p>Drop time: <strong>${dropAt.toLocaleString()}</strong></p>
<p>Open My Music to be ready when it drops.</p>`;
  }

  dropCancelledEmail(songTitle: string, artistName: string): string {
    return `<h2>Drop Cancelled</h2>
<p>Unfortunately, <strong>${artistName}</strong>'s drop of "<strong>${songTitle}</strong>" has been cancelled.</p>
<p>Stay tuned for future releases!</p>`;
  }

  dropRescheduledEmail(songTitle: string, artistName: string, newDropAt: Date): string {
    return `<h2>Drop Rescheduled</h2>
<p><strong>${artistName}</strong>'s drop of "<strong>${songTitle}</strong>" has been rescheduled.</p>
<p>New drop time: <strong>${newDropAt.toLocaleString()}</strong></p>`;
  }
}
