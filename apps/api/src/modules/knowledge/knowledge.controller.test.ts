import { THROTTLER_LIMIT } from '@nestjs/throttler/dist/throttler.constants';
import { describe, expect, it } from 'vitest';

import { KnowledgeController } from './knowledge.controller';

describe('KnowledgeController', () => {
  it('limits searches per user like the other AI calls: each one is a paid embedding request', () => {
    const limit = Reflect.getMetadata(`${THROTTLER_LIMIT}default`, KnowledgeController.prototype.search) as
      number | undefined;
    expect(limit).toBeDefined();
    expect(limit).toBeLessThanOrEqual(60);
  });
});
