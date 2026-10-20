import type { InterviewDetail, InterviewListItem, InterviewSummary } from '@offerleap/shared';

import type { InterviewQuestion, InterviewSession } from '../../generated/prisma/client';

type SessionRow = InterviewSession & { questions: InterviewQuestion[] };

/** Prisma `include` that loads the questions in order. */
export const INTERVIEW_INCLUDE = { questions: { orderBy: { index: 'asc' } } } as const;

export function toInterviewListItem(session: SessionRow): InterviewListItem {
  return {
    id: session.id,
    jobTitle: session.jobTitle,
    type: session.type,
    status: session.status,
    questionCount: session.questions.length,
    answeredCount: session.questions.filter((question) => question.answeredAt !== null).length,
    overallScore: session.overallScore,
    createdAt: session.createdAt.toISOString(),
  };
}

export function toInterviewDetail(session: SessionRow): InterviewDetail {
  return {
    ...toInterviewListItem(session),
    applicationId: session.applicationId,
    jobDescription: session.jobDescription,
    locale: session.locale,
    questions: session.questions.map((question) => ({
      index: question.index,
      question: question.question,
      focus: question.focus,
      answer: question.answer,
      skipped: question.skipped,
      score: question.score,
      feedback: question.feedback,
      betterAnswer: question.betterAnswer,
    })),
    // Written only after validation, so the cast is safe.
    result: (session.result as InterviewSummary | null) ?? null,
  };
}
