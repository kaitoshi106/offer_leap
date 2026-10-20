import { GoogleGenAI } from '@google/genai';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema';
import { AiController } from './ai.controller';
import { AiQuotaService } from './ai-quota.service';
import { AI_PROVIDER, AI_VENDOR, type AiProvider } from './ai.types';
import { GeminiProvider } from './providers/gemini.provider';
import { MockAiProvider } from './providers/mock.provider';
import { TrackedAiProvider } from './providers/tracked.provider';

/**
 * Provides `AI_PROVIDER`: the vendor chosen by `AI_PROVIDER` env (`AI_VENDOR`) wrapped in `TrackedAiProvider`
 * (quotas + usage log). Feature modules inject `AI_PROVIDER` and never import a vendor SDK, so switching vendor is
 * a config change plus one provider class.
 */
@Global()
@Module({
  controllers: [AiController],
  providers: [
    AiQuotaService,
    {
      provide: AI_VENDOR,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): AiProvider => {
        if (config.get('AI_PROVIDER', { infer: true }) === 'mock') return new MockAiProvider();
        return new GeminiProvider({
          client: new GoogleGenAI({ apiKey: config.get('GEMINI_API_KEY', { infer: true }) }),
          models: [
            config.get('GEMINI_MODEL', { infer: true }),
            ...config.get('GEMINI_FALLBACK_MODELS', { infer: true }),
          ],
        });
      },
    },
    { provide: AI_PROVIDER, useClass: TrackedAiProvider },
  ],
  exports: [AI_PROVIDER, AiQuotaService],
})
export class AiModule {}
