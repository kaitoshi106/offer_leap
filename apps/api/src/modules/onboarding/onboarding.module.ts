import { Module } from '@nestjs/common';

import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [TaxonomiesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
