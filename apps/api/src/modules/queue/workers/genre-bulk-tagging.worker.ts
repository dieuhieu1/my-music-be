import { Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from '../../songs/entities/song.entity';
import { GenreSuggestion } from '../../genres/entities/genre-suggestion.entity';
import { QUEUE_NAMES } from '../queue.constants';

export interface GenreBulkTaggingJobData {
  suggestionName: string;
  genreId: string;
}

@Injectable()
@Processor(QUEUE_NAMES.GENRE_BULK_TAGGING)
export class GenreBulkTaggingWorker extends WorkerHost {
  private readonly logger = new Logger(GenreBulkTaggingWorker.name);

  constructor(
    @InjectRepository(Song) private readonly songs: Repository<Song>,
    @InjectRepository(GenreSuggestion) private readonly suggestions: Repository<GenreSuggestion>,
  ) {
    super();
  }

  async process(job: Job<GenreBulkTaggingJobData>): Promise<void> {
    const { suggestionName, genreId } = job.data;
    this.logger.log(`Bulk-tagging genre "${suggestionName}" (${genreId})`);

    // Find all suggestions with the same name that have an associated song
    const linked = await this.suggestions.find({
      where: { name: suggestionName },
      select: ['songId'],
    });

    const songIds = [...new Set(linked.map((s) => s.songId).filter((id): id is string => id !== null))];

    if (!songIds.length) {
      this.logger.log(`No linked songs found for suggestion "${suggestionName}"`);
      return;
    }

    // Bulk-tag each song — add genreId if not already present
    let tagged = 0;
    for (const songId of songIds) {
      const song = await this.songs.findOne({ where: { id: songId } });
      if (!song) continue;

      if (!song.genreIds.includes(genreId)) {
        song.genreIds = [...song.genreIds, genreId];
        await this.songs.save(song);
        tagged++;
      }
    }

    this.logger.log(`Bulk-tagging complete: tagged ${tagged}/${songIds.length} songs`);
  }
}
