import { Module } from '@nestjs/common';

import { ResumesModule } from '../resumes/resumes.module';
import { ProfileModule } from '../profile/profile.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [ProfileModule, ResumesModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
