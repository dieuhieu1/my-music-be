import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Genre } from './entities/genre.entity';
import { GenreSuggestion } from './entities/genre-suggestion.entity';
import { SuggestGenreDto } from './dto/suggest-genre.dto';
import { GenreSuggestionStatus } from '../../common/enums';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { GenreBulkTaggingJobData } from '../queue/workers/genre-bulk-tagging.worker';

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre) private readonly genres: Repository<Genre>,
    @InjectRepository(GenreSuggestion) private readonly suggestions: Repository<GenreSuggestion>,
    @InjectQueue(QUEUE_NAMES.GENRE_BULK_TAGGING) private readonly bulkTaggingQueue: Queue,
  ) {}

  // ── GET /genres ──────────────────────────────────────────────────────────

  async findAll() {
    const genres = await this.genres.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    return genres.map((g) => ({ id: g.id, name: g.name, description: g.description }));
  }

  // ── POST /genres/suggest ─────────────────────────────────────────────────

  async suggest(userId: string, dto: SuggestGenreDto, songId?: string) {
    const suggestion = this.suggestions.create({
      userId,
      name: dto.name.trim(),
      songId: songId ?? null,
    });
    const saved = await this.suggestions.save(suggestion);
    return {
      id: saved.id,
      name: saved.name,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  // ── GET /admin/genres/suggestions (BL-69) ────────────────────────────────

  async findAllSuggestions() {
    const items = await this.suggestions.find({
      order: { createdAt: 'DESC' },
    });
    return items.map((s) => ({
      id: s.id,
      userId: s.userId,
      songId: s.songId,
      name: s.name,
      status: s.status,
      reviewedBy: s.reviewedBy,
      reviewedAt: s.reviewedAt,
      createdAt: s.createdAt,
    }));
  }

  // ── PATCH /admin/genres/suggestions/:id/approve (BL-49, BL-70) ───────────

  async approveSuggestion(adminId: string, suggestionId: string) {
    const suggestion = await this.suggestions.findOne({ where: { id: suggestionId } });
    if (!suggestion) throw new NotFoundException('Genre suggestion not found');
    if (suggestion.status !== GenreSuggestionStatus.PENDING) {
      throw new BadRequestException('Suggestion is not pending');
    }

    // Prevent duplicate genre names
    const existing = await this.genres.findOne({ where: { name: suggestion.name } });
    if (existing) {
      throw new ConflictException(`Genre "${suggestion.name}" already exists`);
    }

    const genre = await this.genres.save(
      this.genres.create({ name: suggestion.name }),
    );

    suggestion.status = GenreSuggestionStatus.APPROVED;
    suggestion.reviewedBy = adminId;
    suggestion.reviewedAt = new Date();
    await this.suggestions.save(suggestion);

    // Retroactively tag linked songs (BL-49)
    await this.bulkTaggingQueue
      .add('bulk-tag', { suggestionName: suggestion.name, genreId: genre.id } satisfies GenreBulkTaggingJobData)
      .catch(() => undefined);

    return { id: genre.id, name: genre.name };
  }

  // ── PATCH /admin/genres/suggestions/:id/reject (BL-71) ───────────────────

  async rejectSuggestion(adminId: string, suggestionId: string, notes?: string) {
    const suggestion = await this.suggestions.findOne({ where: { id: suggestionId } });
    if (!suggestion) throw new NotFoundException('Genre suggestion not found');
    if (suggestion.status !== GenreSuggestionStatus.PENDING) {
      throw new BadRequestException('Suggestion is not pending');
    }

    suggestion.status = GenreSuggestionStatus.REJECTED;
    suggestion.reviewedBy = adminId;
    suggestion.reviewedAt = new Date();
    await this.suggestions.save(suggestion);

    return {
      id: suggestion.id,
      status: suggestion.status,
      notes: notes ?? null,
    };
  }
}
