import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ResumesModule } from '../resumes/resumes.module';
import { AnalysesController } from './analyses.controller';
import { AnalysesProcessor } from './analyses.processor';
import { AnalysesService } from './analyses.service';
import { ANALYSIS_QUEUE } from './analyses.types';

@Module({
  imports: [BullModule.registerQueue({ name: ANALYSIS_QUEUE }), ResumesModule, KnowledgeModule],
  controllers: [AnalysesController],
  providers: [AnalysesService, AnalysesProcessor],
})
export class AnalysesModule {}
