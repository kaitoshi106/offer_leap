import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { KnowledgeController } from './knowledge.controller';
import { KnowledgeProcessor } from './knowledge.processor';
import { KnowledgeService } from './knowledge.service';
import { KNOWLEDGE_QUEUE } from './knowledge.types';

/** Personal documents + semantic search (RAG). Other modules import it to give the AI background. */
@Module({
  imports: [BullModule.registerQueue({ name: KNOWLEDGE_QUEUE })],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeProcessor],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
