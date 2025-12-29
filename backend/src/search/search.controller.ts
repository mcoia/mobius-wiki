import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { User } from '../common/decorators/user.decorator';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  async search(
    @Query() dto: SearchQueryDto,
    @User() user: any,
  ) {
    return this.searchService.search(
      dto.q,
      user,
      dto.limit,
      dto.offset,
      dto.wikiId,
      dto.sectionId,
    );
  }
}
