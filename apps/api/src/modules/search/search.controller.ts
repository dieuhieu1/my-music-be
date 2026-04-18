import { Controller, Get, Query } from '@nestjs/common';

import { SearchService } from './search.service';
import { SearchDto } from './dto/search.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // ── GET /search?q=&page&limit (BL-23) ─────────────────────────────────────

  @Get()
  @Public()
  search(@Query() dto: SearchDto) {
    return this.searchService.search(dto);
  }
}
