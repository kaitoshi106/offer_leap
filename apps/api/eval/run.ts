/**
 * AI eval runner: sends every dataset case to the configured model, scores the answers and prints field accuracy,
 * failure rate, latency (p50/p95) and tokens. Calls the vendor directly (no quota, no usage log).
 *
 *   pnpm --filter @offerleap/api eval resume-extraction [--repeat 2] [--provider mock]
 *   pnpm --filter @offerleap/api eval job-match
 *
 * Uses GEMINI_* from the repo .env. Every run costs real (free-tier) calls: keep datasets small.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

import { INDUSTRIES } from '../prisma/seed-data/industries';
import { PROVINCES } from '../prisma/seed-data/provinces';
import type { AiProvider } from '../src/modules/ai/ai.types';
import {
  buildJobMatchParts,
  JOB_MATCH_TASK,
  jobMatchSchema,
  jobMatchSystem,
} from '../src/modules/ai/prompts/job-match.v1';
import {
  buildResumeExtractionParts,
  RESUME_EXTRACTION_TASK,
  resumeExtractionSchema,
  resumeExtractionSystem,
} from '../src/modules/ai/prompts/resume-extraction.v2';
import { GeminiProvider } from '../src/modules/ai/providers/gemini.provider';
import { MockAiProvider } from '../src/modules/ai/providers/mock.provider';
import { toAnalysisResult } from '../src/modules/analyses/analysis.mapper';
import { toResumeSuggestions } from '../src/modules/resumes/resume-suggestions';
import { JOB_MATCH_CASES } from './datasets/job-match';
import { RESUME_CASES } from './datasets/resume-extraction';
import { type FieldResult, looksVietnamese, percentile, scoreFields } from './scorers';

config({ path: ['.env', '../../.env'], quiet: true });

interface CaseRun {
  id: string;
  run: number;
  ok: boolean;
  error?: string;
  latencyMs: number;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  fields: FieldResult[];
}

/** One task: how to call the model for a case and score the post-processed answer. */
interface EvalTask {
  task: string;
  cases: { id: string }[];
  run: (
    provider: AiProvider,
    caseIndex: number,
  ) => Promise<{ fields: FieldResult[]; model: string; tokens: [number, number] }>;
}

const context = { industries: INDUSTRIES, provinces: PROVINCES };
const EVAL_USER = 'eval';

const TASKS: Record<string, EvalTask> = {
  'resume-extraction': {
    task: RESUME_EXTRACTION_TASK,
    cases: RESUME_CASES,
    run: async (provider, index) => {
      const item = RESUME_CASES[index]!;
      const answer = await provider.generateJson({
        userId: EVAL_USER,
        task: RESUME_EXTRACTION_TASK,
        system: resumeExtractionSystem(new Date()),
        parts: buildResumeExtractionParts({ type: 'text', text: item.cv }, context),
        schema: resumeExtractionSchema(context),
      });
      // Score what users actually get: the cleaned suggestions, not the raw answer.
      const suggestions = toResumeSuggestions(answer.data);
      return {
        fields: scoreFields(item.expected, suggestions as unknown as Record<string, unknown>),
        model: answer.model,
        tokens: [answer.usage.inputTokens, answer.usage.outputTokens],
      };
    },
  },
  'job-match': {
    task: JOB_MATCH_TASK,
    cases: JOB_MATCH_CASES,
    run: async (provider, index) => {
      const item = JOB_MATCH_CASES[index]!;
      const answer = await provider.generateJson({
        userId: EVAL_USER,
        task: JOB_MATCH_TASK,
        system: jobMatchSystem(item.locale, new Date()),
        parts: buildJobMatchParts({ type: 'text', text: item.cv }, item.jobDescription),
        schema: jobMatchSchema,
      });
      const { result } = toAnalysisResult(answer.data);
      const fields = scoreFields(item.expected, result as unknown as Record<string, unknown>);
      if (item.summaryInLocale) {
        const vietnamese = looksVietnamese(result.summary);
        fields.push({
          field: 'summaryLanguage',
          pass: item.locale === 'vi' ? vietnamese : !vietnamese,
          expected: item.locale,
          actual: vietnamese ? 'vi' : 'en',
        });
      }
      return { fields, model: answer.model, tokens: [answer.usage.inputTokens, answer.usage.outputTokens] };
    },
  },
};

function providerFor(name: string): AiProvider {
  if (name === 'mock') return new MockAiProvider();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set (repo .env)');
  return new GeminiProvider({
    client: new GoogleGenAI({ apiKey }),
    models: [
      process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
      ...(process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.1-flash-lite,gemini-3.8-flash')
        .split(',')
        .filter(Boolean),
    ],
  });
}

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : '—');

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { repeat: { type: 'string', default: '1' }, provider: { type: 'string', default: 'gemini' } },
  });
  const taskName = positionals[0] ?? '';
  const evalTask = TASKS[taskName];
  if (!evalTask)
    throw new Error(`Usage: eval <${Object.keys(TASKS).join('|')}> [--repeat N] [--provider gemini|mock]`);
  const repeat = Number(values.repeat);
  const provider = providerFor(values.provider!);

  console.log(
    `\n${evalTask.task} · ${evalTask.cases.length} cases × ${repeat} · provider ${provider.name}\n`,
  );
  const runs: CaseRun[] = [];
  for (let run = 1; run <= repeat; run += 1) {
    for (const [index, { id }] of evalTask.cases.entries()) {
      const startedAt = Date.now();
      try {
        const { fields, model, tokens } = await evalTask.run(provider, index);
        const failed = fields.filter((field) => !field.pass);
        runs.push({
          id,
          run,
          ok: true,
          latencyMs: Date.now() - startedAt,
          model,
          inputTokens: tokens[0],
          outputTokens: tokens[1],
          fields,
        });
        console.log(
          `${failed.length ? '✗' : '✓'} ${id.padEnd(30)} ${String(fields.length - failed.length).padStart(2)}/${fields.length} fields  ${String(Date.now() - startedAt).padStart(6)} ms  ${model}`,
        );
        for (const field of failed) {
          console.log(
            `    ${field.field}: expected ${JSON.stringify(field.expected)}, got ${JSON.stringify(field.actual)}`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        runs.push({
          id,
          run,
          ok: false,
          error: message,
          latencyMs: Date.now() - startedAt,
          inputTokens: 0,
          outputTokens: 0,
          fields: [],
        });
        console.log(`! ${id.padEnd(30)} failed: ${message.slice(0, 160)}`);
      }
    }
  }

  // ── Summary ──
  const completed = runs.filter((run) => run.ok);
  const fieldStats = new Map<string, { pass: number; total: number }>();
  for (const field of completed.flatMap((run) => run.fields)) {
    const stat = fieldStats.get(field.field) ?? { pass: 0, total: 0 };
    stat.total += 1;
    if (field.pass) stat.pass += 1;
    fieldStats.set(field.field, stat);
  }
  const allFields = [...fieldStats.values()].reduce(
    (sum, stat) => ({ pass: sum.pass + stat.pass, total: sum.total + stat.total }),
    { pass: 0, total: 0 },
  );
  const latencies = completed.map((run) => run.latencyMs);

  console.log('\nField accuracy');
  for (const [field, stat] of fieldStats)
    console.log(
      `  ${field.padEnd(20)} ${pct(stat.pass, stat.total).padStart(5)}  (${stat.pass}/${stat.total})`,
    );
  const summary = {
    task: evalTask.task,
    provider: provider.name,
    date: new Date().toISOString(),
    runs: runs.length,
    failureRate: pct(runs.length - completed.length, runs.length),
    fieldAccuracy: pct(allFields.pass, allFields.total),
    perfectCases: pct(completed.filter((run) => run.fields.every((field) => field.pass)).length, runs.length),
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    avgTokens: {
      input: Math.round(completed.reduce((sum, run) => sum + run.inputTokens, 0) / (completed.length || 1)),
      output: Math.round(completed.reduce((sum, run) => sum + run.outputTokens, 0) / (completed.length || 1)),
    },
  };
  console.log(
    `\nOverall: ${summary.fieldAccuracy} of fields, ${summary.perfectCases} perfect cases, ${summary.failureRate} failed calls`,
  );
  console.log(
    `Latency p50 ${summary.latencyMs.p50} ms · p95 ${summary.latencyMs.p95} ms · avg tokens ${summary.avgTokens.input} in / ${summary.avgTokens.output} out\n`,
  );

  const dir = join(__dirname, 'reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${taskName}-${summary.date.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ summary, runs }, null, 2));
  console.log(`Report: ${file}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
