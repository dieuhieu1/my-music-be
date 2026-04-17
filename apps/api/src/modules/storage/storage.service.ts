import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;       // internal — used for uploads/deletes
  private readonly presignClient: Minio.Client; // public-facing — used for presigned URLs
  private readonly buckets: { audio: string; images: string };

  constructor(private readonly config: ConfigService) {
    const endPoint = config.get<string>('minio.endPoint');
    const port     = config.get<number>('minio.port');
    const useSSL   = config.get<boolean>('minio.useSSL');
    const accessKey = config.get<string>('minio.accessKey');
    const secretKey = config.get<string>('minio.secretKey');

    this.client = new Minio.Client({ endPoint, port, useSSL, accessKey, secretKey });

    // Build a second client that signs URLs with the browser-accessible hostname.
    // Presigned URL signatures include the host — replacing it after signing breaks
    // the signature (SignatureDoesNotMatch). We must sign with the public host.
    const publicUrl = config.get<string | null>('minio.publicUrl');
    if (publicUrl) {
      const parsed = new URL(publicUrl);
      this.presignClient = new Minio.Client({
        endPoint: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80),
        useSSL: parsed.protocol === 'https:',
        accessKey,
        secretKey,
      });
    } else {
      this.presignClient = this.client;
    }

    this.buckets = config.get('minio.buckets');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket(this.buckets.audio);
    await this.ensureBucket(this.buckets.images);
  }

  private async ensureBucket(name: string): Promise<void> {
    const exists = await this.client.bucketExists(name);
    if (!exists) {
      await this.client.makeBucket(name);
      this.logger.log(`Created MinIO bucket: "${name}"`);
    }
  }

  async upload(bucket: string, objectName: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.putObject(bucket, objectName, buffer, buffer.length, { 'Content-Type': mimeType });
    return objectName;
  }

  async uploadStream(bucket: string, objectName: string, stream: Readable, size: number, mimeType: string): Promise<string> {
    await this.client.putObject(bucket, objectName, stream, size, { 'Content-Type': mimeType });
    return objectName;
  }

  // Direct public URL for objects in publicly readable buckets (cover art, avatars).
  // Falls back to a presigned URL if no public URL is configured.
  getPublicUrl(bucket: string, objectName: string): string {
    const publicUrl = this.config.get<string | null>('minio.publicUrl');
    const base = publicUrl ? publicUrl.replace(/\/$/, '') : `http://${this.config.get('minio.endPoint')}:${this.config.get('minio.port')}`;
    return `${base}/${bucket}/${objectName}`;
  }

  // Presigned URL — use only for private buckets (audio files).
  async presignedGetObject(bucket: string, objectName: string, expirySeconds = 900): Promise<string> {
    return this.client.presignedGetObject(bucket, objectName, expirySeconds);
  }

  async deleteObject(bucket: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucket, objectName);
  }

  getBuckets(): { audio: string; images: string } {
    return this.buckets;
  }
}
