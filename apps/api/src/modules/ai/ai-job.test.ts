import type { Queue } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';

import { AI_JOB_OPTIONS, enqueueAiJob } from './ai-job';

describe('enqueueAiJob', () => {
  it('queues the job under the record id with the shared AI options', async () => {
    const queue = { add: vi.fn().mockResolvedValue(undefined) } as unknown as Queue;
    const markFailed = vi.fn();

    await enqueueAiJob(queue, 'analyse', { analysisId: 'a1' }, 'a1', markFailed);

    expect(queue.add).toHaveBeenCalledWith(
      'analyse',
      { analysisId: 'a1' },
      { jobId: 'a1', ...AI_JOB_OPTIONS },
    );
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("marks the record failed when the queue can't be reached, so the client doesn't wait for it forever", async () => {
    const down = new Error('Redis connection refused');
    const queue = { add: vi.fn().mockRejectedValue(down) } as unknown as Queue;
    const markFailed = vi.fn().mockResolvedValue(undefined);

    await expect(enqueueAiJob(queue, 'analyse', { analysisId: 'a1' }, 'a1', markFailed)).rejects.toBe(down);
    expect(markFailed).toHaveBeenCalledOnce();
  });
});
