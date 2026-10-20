import { Module } from '@nestjs/common';

import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [TaxonomiesModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
