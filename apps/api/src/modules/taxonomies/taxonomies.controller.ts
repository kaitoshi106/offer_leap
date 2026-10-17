import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ProvinceItem, TaxonomyItem } from '@offerleap/shared';

import { Public } from '../../common/decorators/auth.decorators';
import { TaxonomiesService } from './taxonomies.service';

/** Reference data changes only on deploys (seed), so browsers and CDNs may cache it for an hour. */
const CACHE_ONE_HOUR = 'public, max-age=3600';

@ApiTags('taxonomies')
@Public()
@Controller('taxonomies')
export class TaxonomiesController {
  constructor(private readonly taxonomies: TaxonomiesService) {}

  @ApiOperation({ summary: 'Industries (vi/en labels)' })
  @Header('Cache-Control', CACHE_ONE_HOUR)
  @Get('industries')
  industries(): Promise<TaxonomyItem[]> {
    return this.taxonomies.industries();
  }

  @ApiOperation({ summary: 'Provinces and centrally-run cities (34 units since 2025)' })
  @Header('Cache-Control', CACHE_ONE_HOUR)
  @Get('provinces')
  provinces(): Promise<ProvinceItem[]> {
    return this.taxonomies.provinces();
  }
}
