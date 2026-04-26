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
    this.from = config.get<string>('mail.from') ?? 'noreply@mymusic.app';

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,    // STARTTLS — upgraded by requireTLS below
      requireTLS: true,
      auth: {
        user: config.get<string>('mail.user'),
        pass: config.get<string>('mail.pass'),
      },
      tls: { rejectUnauthorized: true },
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

  // ── Base shell ────────────────────────────────────────────────────────────

  private base(body: string): string {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>My Music</title>
</head>
<body style="margin:0;padding:0;background-color:#0d0d0d;font-family:Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;padding:48px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <!-- gold accent bar -->
  <tr><td style="height:3px;background:linear-gradient(90deg,#e8b84b 0%,#a07d2e 100%);border-radius:4px 4px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  <!-- header -->
  <tr>
    <td style="background:#111111;padding:28px 40px;border-left:1px solid #242424;border-right:1px solid #242424;">
      <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#e8b84b;letter-spacing:0.04em;font-weight:400;">&#9834; My Music</span>
    </td>
  </tr>
  <!-- header divider -->
  <tr>
    <td style="background:#111111;padding:0 40px;border-left:1px solid #242424;border-right:1px solid #242424;font-size:0;line-height:0;">
      <div style="height:1px;background:#242424;">&nbsp;</div>
    </td>
  </tr>
  <!-- body -->
  <tr>
    <td style="background:#111111;padding:40px 40px 48px;border-left:1px solid #242424;border-right:1px solid #242424;border-bottom:1px solid #242424;border-radius:0 0 8px 8px;">
      ${body}
    </td>
  </tr>
  <!-- footer -->
  <tr>
    <td style="padding:28px 40px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#5a5550;letter-spacing:0.08em;text-transform:uppercase;">Your music, your way.</p>
      <p style="margin:0;font-size:11px;color:#3a3530;">&copy; ${year} My Music &middot; All rights reserved</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  // ── Block helpers ─────────────────────────────────────────────────────────

  private h1(text: string): string {
    return `<h1 style="margin:16px 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:400;color:#f5eed8;letter-spacing:-0.01em;line-height:1.3;">${text}</h1>`;
  }

  private p(text: string, muted = false): string {
    const color = muted ? '#7a726a' : '#c8bfaa';
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${color};">${text}</p>`;
  }

  private otpBlock(value: string): string {
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;">
  <tr>
    <td style="background:#181818;border:1px solid rgba(232,184,75,0.2);border-radius:8px;padding:28px;text-align:center;">
      <div style="font-family:'Courier New',Courier,monospace;font-size:44px;font-weight:700;letter-spacing:18px;color:#e8b84b;line-height:1;">${value}</div>
      <div style="margin-top:12px;font-size:11px;color:#5a5550;letter-spacing:0.08em;text-transform:uppercase;">One-time code &middot; Expires in 15&nbsp;minutes</div>
    </td>
  </tr>
</table>`;
  }

  private infoBox(html: string): string {
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr>
    <td width="3" style="background:#e8b84b;border-radius:3px 0 0 3px;font-size:0;">&nbsp;</td>
    <td style="background:#161616;border-radius:0 4px 4px 0;padding:16px 20px;font-size:14px;line-height:1.65;color:#c8bfaa;">${html}</td>
  </tr>
</table>`;
  }

  private warnBox(html: string): string {
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr>
    <td width="3" style="background:#e06040;border-radius:3px 0 0 3px;font-size:0;">&nbsp;</td>
    <td style="background:#1a1210;border-radius:0 4px 4px 0;padding:16px 20px;font-size:14px;line-height:1.65;color:#c8bfaa;">${html}</td>
  </tr>
</table>`;
  }

  private badge(label: string, gold = true): string {
    const bg = gold ? '#e8b84b' : '#2a2a2a';
    const color = gold ? '#0d0d0d' : '#c8bfaa';
    return `<span style="display:inline-block;background:${bg};color:${color};font-size:10px;font-weight:700;padding:3px 10px;border-radius:3px;letter-spacing:0.08em;text-transform:uppercase;">${label}</span>`;
  }

  private trackCard(title: string, subtitle?: string): string {
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
  <tr>
    <td style="background:#181818;border:1px solid #242424;border-radius:6px;padding:18px 22px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td width="36" valign="middle" style="font-size:24px;color:#e8b84b;padding-right:14px;font-family:Georgia,serif;">&#9834;</td>
          <td valign="middle">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;color:#f5eed8;line-height:1.3;">${title}</div>
            ${subtitle ? `<div style="margin-top:4px;font-size:12px;color:#7a726a;letter-spacing:0.03em;">${subtitle}</div>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  }

  // ── Email templates ───────────────────────────────────────────────────────

  verificationEmail(code: string): string {
    return this.base(`
      ${this.h1('Verify your email')}
      ${this.p('Welcome to My Music. Enter the code below to confirm your email address and start listening.')}
      ${this.otpBlock(code)}
      ${this.p("If you didn't create an account, you can safely ignore this email.", true)}
    `);
  }

  passwordResetEmail(code: string): string {
    return this.base(`
      ${this.h1('Reset your password')}
      ${this.p('We received a request to reset the password for your My Music account. Use the code below to continue.')}
      ${this.otpBlock(code)}
      ${this.warnBox("If you didn't request a password reset, your account may be at risk. Please contact support immediately.")}
    `);
  }

  accountLockedEmail(): string {
    return this.base(`
      ${this.h1('Account temporarily locked')}
      ${this.p('Your My Music account has been temporarily locked due to too many failed login attempts.')}
      ${this.infoBox('Your account will be automatically unlocked <strong style="color:#e8b84b;">after 15 minutes</strong>. No action is required.')}
      ${this.p("If you didn't trigger these attempts, we strongly recommend resetting your password once your account is unlocked.", true)}
    `);
  }

  premiumActivatedEmail(expiresAt: Date): string {
    return this.base(`
      ${this.badge('Premium')}
      ${this.h1('Welcome to My Music Premium')}
      ${this.p('Your premium subscription is now active. Enjoy the full My Music experience — unlimited downloads and ad-free listening.')}
      ${this.infoBox(`Your subscription is active until <strong style="color:#e8b84b;">${expiresAt.toDateString()}</strong>.`)}
      ${this.p('Thank you for supporting independent music.', true)}
    `);
  }

  premiumRevokedEmail(): string {
    return this.base(`
      ${this.h1('Your Premium subscription has ended')}
      ${this.p('Your My Music Premium subscription has expired. Your downloaded tracks are no longer available for offline listening.')}
      ${this.infoBox('Renew your subscription anytime to regain full access to all premium features.')}
      ${this.p('Thank you for being a premium member. We hope to see you back soon.', true)}
    `);
  }

  songApprovedEmail(songTitle: string): string {
    return this.base(`
      ${this.badge('Approved')}
      ${this.h1('Your track is now live')}
      ${this.p('Great news — your song has been reviewed and approved by our team.')}
      ${this.trackCard(songTitle, 'Now streaming on My Music')}
      ${this.p('Your listeners can now discover and enjoy your music. Keep creating!', true)}
    `);
  }

  songRejectedEmail(songTitle: string, reason: string): string {
    return this.base(`
      ${this.badge('Review update', false)}
      ${this.h1('Track review decision')}
      ${this.p('After reviewing your submission, our team was unable to approve this track at this time.')}
      ${this.trackCard(songTitle)}
      ${this.infoBox(`<strong style="color:#e8b84b;">Reason:</strong> ${reason}`)}
      ${this.p('If you believe this decision was made in error, please reach out to our support team.', true)}
    `);
  }

  songReuploadRequiredEmail(songTitle: string, notes: string): string {
    return this.base(`
      ${this.badge('Action required', false)}
      ${this.h1('Changes requested for your track')}
      ${this.p('Our review team needs you to make some changes before your track can go live.')}
      ${this.trackCard(songTitle)}
      ${this.infoBox(`<strong style="color:#e8b84b;">Reviewer notes:</strong><br>${notes}`)}
      ${this.p('Log in to your artist dashboard to re-upload the updated file.', true)}
    `);
  }

  songRestoredEmail(songTitle: string): string {
    return this.base(`
      ${this.badge('Restored')}
      ${this.h1('Your track has been restored')}
      ${this.p("Your track has been reinstated following your appeal. It's now live again on My Music.")}
      ${this.trackCard(songTitle, 'Now streaming on My Music')}
      ${this.p("Thank you for your patience. If you have any questions, don't hesitate to contact support.", true)}
    `);
  }

  songTakenDownEmail(songTitle: string): string {
    return this.base(`
      ${this.badge('Content notice', false)}
      ${this.h1('Your track has been taken down')}
      ${this.p('Following a community report and review by our team, your track has been removed from My Music.')}
      ${this.trackCard(songTitle)}
      ${this.warnBox('If you believe this action was taken in error, please contact our support team to submit an appeal.')}
    `);
  }

  upcomingDropEmail(songTitle: string, artistName: string, dropAt: Date, is24h: boolean): string {
    const timeLabel = is24h ? '24 hours' : '1 hour';
    return this.base(`
      ${this.badge('Drop alert')}
      ${this.h1('A track is dropping soon')}
      ${this.p(`<strong style="color:#f5eed8;">${artistName}</strong> is about to release something new on My Music.`)}
      ${this.trackCard(songTitle, `Dropping in ${timeLabel}`)}
      ${this.infoBox(`<strong style="color:#e8b84b;">Drop time:</strong> ${dropAt.toLocaleString()}`)}
      ${this.p('Open My Music and be ready when it drops.', true)}
    `);
  }

  dropCancelledEmail(songTitle: string, artistName: string): string {
    return this.base(`
      ${this.badge('Drop update', false)}
      ${this.h1('Scheduled drop cancelled')}
      ${this.p(`We wanted to let you know that <strong style="color:#f5eed8;">${artistName}</strong>'s upcoming drop has been cancelled.`)}
      ${this.trackCard(songTitle, 'Drop cancelled')}
      ${this.p("Stay tuned — great music is still on the way. We'll notify you when there's something new from this artist.", true)}
    `);
  }

  dropRescheduledEmail(songTitle: string, artistName: string, newDropAt: Date): string {
    return this.base(`
      ${this.badge('Drop update', false)}
      ${this.h1('Drop rescheduled')}
      ${this.p(`<strong style="color:#f5eed8;">${artistName}</strong>'s upcoming drop has been moved to a new time.`)}
      ${this.trackCard(songTitle, 'Coming soon')}
      ${this.infoBox(`<strong style="color:#e8b84b;">New drop time:</strong> ${newDropAt.toLocaleString()}`)}
      ${this.p("We'll remind you when the release is close. Stay tuned.", true)}
    `);
  }
}
