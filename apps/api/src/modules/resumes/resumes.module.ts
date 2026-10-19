import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { ResumesController } from './resumes.controller';
import { ResumesProcessor } from './resumes.processor';
import { ResumesService } from './resumes.service';
import { RESUME_QUEUE } from './resumes.types';

@Module({
  imports: [BullModule.registerQueue({ name: RESUME_QUEUE }), TaxonomiesModule],
  controllers: [ResumesController],
  providers: [ResumesService, ResumesProcessor],
  exports: [ResumesService],
})
export class ResumesModule {}
