import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  region: process.env.AWS_REGION ?? 'ap-southeast-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  buckets: {
    audio:    process.env.AWS_S3_BUCKET_AUDIO     ?? 'mymusic-audio',
    audioEnc: process.env.AWS_S3_BUCKET_AUDIO_ENC ?? 'mymusic-audio-enc',
    images:   process.env.AWS_S3_BUCKET_IMAGES    ?? 'mymusic-images',
  },
  presignExpiresIn: parseInt(process.env.AWS_S3_PRESIGN_EXPIRES_SEC ?? '3600', 10),
}));
