import { Module } from '@nestjs/common';

import { ResumesModule } from '../resumes/resumes.module';
import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [TaxonomiesModule, ResumesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
