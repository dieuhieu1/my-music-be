import { registerAs } from '@nestjs/config';

export const mailConfig = registerAs('mail', () => ({
  user: process.env.GMAIL_USER ?? '',
  pass: process.env.GMAIL_APP_PASSWORD ?? '',
  from: process.env.MAIL_FROM ?? 'noreply@mymusic.app',
}));
