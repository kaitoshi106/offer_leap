import { GoogleGenAI } from '@google/genai';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.schema';
import { AI_PROVIDER, type AiProvider } from './ai.types';
import { GeminiProvider } from './providers/gemini.provider';
import { MockAiProvider } from './providers/mock.provider';

/**
 * Provides the `AiProvider` chosen by `AI_PROVIDER`. Feature modules inject `AI_PROVIDER` and never import a
 * vendor SDK, so switching vendor is a config change plus one provider class.
 */
@Global()
@Module({
  providers: [
    {
      provide: AI_PROVIDER,
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
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
