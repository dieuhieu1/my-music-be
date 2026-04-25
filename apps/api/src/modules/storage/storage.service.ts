import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly region: string;
  private readonly buckets: { audio: string; audioEnc: string; images: string };

  constructor(private readonly config: ConfigService) {
    this.region = config.get<string>('storage.region') ?? 'ap-southeast-1';
    this.buckets = config.get('storage.buckets');

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId:     config.get<string>('storage.accessKeyId') ?? '',
        secretAccessKey: config.get<string>('storage.secretAccessKey') ?? '',
      },
    });
  }

  async onModuleInit(): Promise<void> {
    for (const bucket of Object.values(this.buckets)) {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
        this.logger.log(`S3 bucket verified: "${bucket}"`);
      } catch {
        this.logger.error(`S3 bucket "${bucket}" is missing or not accessible — create it before starting`);
      }
    }
  }

  async upload(bucket: string, key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
    return key;
  }

  // Multipart upload for streams (large audio files).
  async uploadStream(bucket: string, key: string, stream: Readable, _size: number, mimeType: string): Promise<string> {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: bucket, Key: key, Body: stream, ContentType: mimeType },
    });
    await upload.done();
    return key;
  }

  // Direct public URL — requires the images bucket to have a public-read bucket policy.
  getPublicUrl(bucket: string, key: string): string {
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async presignedGetObject(bucket: string, key: string, expirySeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expirySeconds },
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  getBuckets(): { audio: string; audioEnc: string; images: string } {
    return this.buckets;
  }
}
