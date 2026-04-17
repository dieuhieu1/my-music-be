import { Controller, Get, Post, Body } from '@nestjs/common';
import { GenresService } from './genres.service';
import { SuggestGenreDto } from './dto/suggest-genre.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';

@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  // ── GET /genres (public — used by upload form multi-select) ──────────────

  @Public()
  @Get()
  findAll() {
    return this.genresService.findAll();
  }

  // ── POST /genres/suggest (artists only — BL-68) ───────────────────────────

  @Post('suggest')
  @UseGuards(RolesGuard)
  @Roles(Role.ARTIST)
  suggest(
    @CurrentUser('id') userId: string,
    @Body() dto: SuggestGenreDto,
  ) {
    return this.genresService.suggest(userId, dto);
  }
}
