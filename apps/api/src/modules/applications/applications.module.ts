import { Module } from '@nestjs/common';

import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ResumesModule } from '../resumes/resumes.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [ResumesModule, KnowledgeModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
