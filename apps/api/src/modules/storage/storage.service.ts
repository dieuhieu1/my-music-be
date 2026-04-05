import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Minio.Client;
  private readonly buckets: { audio: string; images: string };

  constructor(private readonly config: ConfigService) {
    this.client = new Minio.Client({
      endPoint: config.get<string>('minio.endPoint'),
      port: config.get<number>('minio.port'),
      useSSL: config.get<boolean>('minio.useSSL'),
      accessKey: config.get<string>('minio.accessKey'),
      secretKey: config.get<string>('minio.secretKey'),
    });
    this.buckets = config.get('minio.buckets');
  }

  // Create required buckets on startup if they don't exist
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

  // Upload from a Buffer (small files, cover art)
  async upload(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    await this.client.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return objectName;
  }

  // Upload from a stream (large audio files — avoids loading entire file into RAM)
  async uploadStream(
    bucket: string,
    objectName: string,
    stream: Readable,
    size: number,
    mimeType: string,
  ): Promise<string> {
    await this.client.putObject(bucket, objectName, stream, size, {
      'Content-Type': mimeType,
    });
    return objectName;
  }

  // Generate a time-limited presigned GET URL
  // Default 900s (15 min) for stream URLs — client refreshes 5 min before expiry
  async presignedGetObject(
    bucket: string,
    objectName: string,
    expirySeconds = 900,
  ): Promise<string> {
    return this.client.presignedGetObject(bucket, objectName, expirySeconds);
  }

  async deleteObject(bucket: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucket, objectName);
  }

  getBuckets(): { audio: string; images: string } {
    return this.buckets;
  }
}
