import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genre } from './entities/genre.entity';
import { GenreSuggestion } from './entities/genre-suggestion.entity';
import { SuggestGenreDto } from './dto/suggest-genre.dto';

@Injectable()
export class GenresService {
  constructor(
    @InjectRepository(Genre) private readonly genres: Repository<Genre>,
    @InjectRepository(GenreSuggestion) private readonly suggestions: Repository<GenreSuggestion>,
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

  async suggest(userId: string, dto: SuggestGenreDto) {
    const suggestion = this.suggestions.create({
      userId,
      name: dto.name.trim(),
    });
    const saved = await this.suggestions.save(suggestion);
    return {
      id: saved.id,
      name: saved.name,
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }
}
