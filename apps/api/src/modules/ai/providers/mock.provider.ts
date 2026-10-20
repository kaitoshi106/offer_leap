import type {
  AiEmbedRequest,
  AiEmbedResult,
  AiJsonRequest,
  AiJsonResult,
  AiProvider,
  AiTextRequest,
  AiTextStream,
} from '../ai.types';
import { AiInvalidOutputError } from '../ai.errors';
import { parseJsonOutput } from './json-output';
import { hashEmbedding } from './vectors';

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
  'job-match.v2': {
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
  'interview-feedback.v1': {
    score: 7,
    feedback: 'Clear and relevant answer. Add a concrete result to show the impact of your work.',
    betterAnswer:
      'In a previous project I owned the migration to Next.js. I planned it in small steps and measured page speed before and after.',
  },
  'interview-summary.v1': {
    overallScore: 68,
    summary:
      'You answered clearly and stayed on topic. Adding measurable results would make your answers stronger.',
    strengths: ['Clear structure', 'Relevant React experience'],
    improvements: ['Quantify results', 'Practise system design questions'],
  },
};

/** Mock interview questions; the request's schema decides how many are returned. */
const MOCK_QUESTIONS = [
  ['Tell me about a project you are proud of.', 'Ownership'],
  ['How do you keep a large React app fast?', 'Performance'],
  ['Describe a disagreement with a teammate and how you resolved it.', 'Collaboration'],
  ['How would you design a reusable form component?', 'Component design'],
  ['How do you test your front-end code?', 'Testing'],
  ['Explain how the browser renders a page.', 'Web fundamentals'],
  ['Tell me about a bug that was hard to find.', 'Debugging'],
  ['How do you handle unclear requirements?', 'Communication'],
  ['How would you migrate a codebase to TypeScript?', 'Planning'],
  ['Where do you want to grow in the next two years?', 'Motivation'],
] as const;

/**
 * @description Finds the question count the schema expects by trying lengths until one validates, so the mock
 * stays generic instead of knowing the prompt's internals.
 * @param schema - The questions schema of this request.
 */
function mockQuestions(schema: { safeParse: (value: unknown) => { success: boolean } }) {
  for (let count = 1; count <= MOCK_QUESTIONS.length; count += 1) {
    const answer = {
      questions: MOCK_QUESTIONS.slice(0, count).map(([question, focus]) => ({ question, focus })),
    };
    if (schema.safeParse(answer).success) return answer;
  }
  return undefined;
}

/** Canned free-text answers per task (streamed word by word). */
const MOCK_TEXTS: Record<string, string> = {
  'cover-letter.v2': `Dear Hiring Team,

I am excited to apply for this role. Over the past six years I have built fast, accessible web applications with React, TypeScript and Next.js.

I would welcome the chance to bring that experience to your team.

Best regards,
Nguyễn Văn An`,
};

/**
 * Deterministic provider for tests and offline development (`AI_PROVIDER=mock`): no network, no key, no cost.
 * Answers still go through schema validation, so a fixture that drifts from the prompt's schema fails loudly.
 */
export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  /** Bag-of-words vectors: one accidental shared word scores ~0.14, real topical overlap 0.3+. */
  readonly similarityFloor = 0.2;

  async generateJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>> {
    const answer =
      request.task === 'interview-questions.v1' ? mockQuestions(request.schema) : MOCK_ANSWERS[request.task];
    if (answer === undefined) throw new AiInvalidOutputError(`No mock answer for ${request.task}`);
    return {
      data: parseJsonOutput(JSON.stringify(answer), request.schema),
      model: 'mock',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }

  async streamText(request: AiTextRequest): Promise<AiTextStream> {
    const text = MOCK_TEXTS[request.task];
    if (text === undefined) throw new AiInvalidOutputError(`No mock text for ${request.task}`);
    async function* chunks(): AsyncGenerator<string> {
      // Keep the whitespace so the pieces join back into the exact text.
      for (const piece of text!.split(/(?<=\s)/)) yield piece;
    }
    return { model: 'mock', chunks: chunks(), usage: () => ({ inputTokens: 0, outputTokens: 0 }) };
  }

  async embed(request: AiEmbedRequest): Promise<AiEmbedResult> {
    return {
      vectors: request.texts.map(hashEmbedding),
      model: 'mock-embedding',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
