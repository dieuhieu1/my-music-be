import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Genre } from './entities/genre.entity';
import { GenreSuggestion } from './entities/genre-suggestion.entity';
import { Song } from '../songs/entities/song.entity';
import { GenresService } from './genres.service';
import { GenresController } from './genres.controller';
import { GenreBulkTaggingWorker } from '../queue/workers/genre-bulk-tagging.worker';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([Genre, GenreSuggestion, Song]),
    BullModule.registerQueue({ name: QUEUE_NAMES.GENRE_BULK_TAGGING }),
  ],
  controllers: [GenresController],
  providers: [GenresService, GenreBulkTaggingWorker],
  exports: [GenresService],
})
export class GenresModule {}
