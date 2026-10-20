import type { AiJsonRequest, AiJsonResult, AiProvider } from '../ai.types';
import { AiInvalidOutputError } from '../ai.errors';
import { parseJsonOutput } from './json-output';

/** Canned answers per task, shaped like what a real model returns. */
const MOCK_ANSWERS: Record<string, unknown> = {
  'resume-extraction.v2': {
    fullName: 'Nguyễn Văn An',
    phone: '0912 345 678',
    provinceCode: 'ha-noi',
    industryCode: 'software',
    jobTitle: 'Frontend Developer',
    level: 'SENIOR',
    yearsOfExperience: 6,
    skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Node.js'],
    uncertainFields: ['phone'],
  },
  'job-match.v1': {
    jobTitle: 'Senior Frontend Engineer',
    company: 'Acme Tech',
    score: 72,
    summary:
      'Strong React and TypeScript background that covers the core of the role; testing and GraphQL are missing.',
    matchedSkills: ['React', 'TypeScript', 'Next.js'],
    missingSkills: [
      { name: 'GraphQL', importance: 'REQUIRED' },
      { name: 'Playwright', importance: 'NICE_TO_HAVE' },
    ],
    strengths: ['6 years building React applications', 'Recent Next.js experience'],
    gaps: ['No GraphQL experience shown'],
    suggestions: [
      'Add a project that uses GraphQL, if you have one',
      'Quantify the impact of your recent work',
    ],
  },
};

/**
 * Deterministic provider for tests and offline development (`AI_PROVIDER=mock`): no network, no key, no cost.
 * Answers still go through schema validation, so a fixture that drifts from the prompt's schema fails loudly.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>> {
    const answer = MOCK_ANSWERS[request.task];
    if (answer === undefined) throw new AiInvalidOutputError(`No mock answer for ${request.task}`);
    return {
      data: parseJsonOutput(JSON.stringify(answer), request.schema),
      model: 'mock',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
