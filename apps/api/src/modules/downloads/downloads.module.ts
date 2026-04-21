import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DownloadRecord } from './entities/download-record.entity';
import { Song } from '../songs/entities/song.entity';
import { SongEncryptionKey } from '../songs/entities/song-encryption-key.entity';
import { User } from '../auth/entities/user.entity';
import { DownloadsService } from './downloads.service';
import { DownloadsController } from './downloads.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DownloadRecord, Song, SongEncryptionKey, User]),
    StorageModule,
  ],
  controllers: [DownloadsController],
  providers: [DownloadsService],
  exports: [DownloadsService],
})
export class DownloadsModule {}
