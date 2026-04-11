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
}
