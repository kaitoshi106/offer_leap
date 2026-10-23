'use client';

import { INTERVIEW_LIMITS, type InterviewDetail, type InterviewQuestion } from '@offerleap/shared';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Badge, Button, Heading, Icon, Skeleton, Text, Textarea } from '@/components/atoms';
import { Alert, ScoreGauge, type ScoreTone } from '@/components/molecules';
import { Dialog, useToast } from '@/components/organisms';
import { scoreBand } from '@/features/analyses/components/match';
import { Link, useRouter } from '@/i18n/navigation';
import { useErrorText } from '@/lib/api/use-error-text';
import { cn } from '@/lib/cn';
import { useSpeechRecognition } from '@/lib/speech';
import { useMutateOnce } from '@/lib/api/use-mutate-once';

import {
  useAnswerQuestion,
  useCompleteInterview,
  useDeleteInterview,
  useInterview,
  useSkipQuestion,
} from '../api/use-interviews';

const isDone = (question: InterviewQuestion) => question.answer !== null || question.skipped;

/** Colour of a 0–10 answer score. */
function answerTone(score: number): ScoreTone {
  if (score >= 8) return 'success';
  if (score >= 6) return 'primary';
  if (score >= 4) return 'warning';
  return 'danger';
}

/**
 * @description A mock interview as a conversation: answered questions with feedback, the current question with
 * the answer box (typed or spoken), then the summary. After each answer focus moves to the next question so
 * keyboard and screen-reader users continue where the conversation does.
 * @param props.id - Interview id from the URL.
 */
export function InterviewSessionView({ id }: { id: string }) {
  const t = useTranslations('interviews.session');
  const errorText = useErrorText();
  const { data: interview, error, isPending } = useInterview(id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/interviews"
        className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary-text outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Icon name="arrow-right" size="sm" className="rotate-180" />
        {t('back')}
      </Link>
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      {isPending && <Skeleton className="h-96 w-full" />}
      {interview && <Conversation interview={interview} />}
    </div>
  );
}

function Conversation({ interview }: { interview: InterviewDetail }) {
  const t = useTranslations('interviews');
  const current = interview.questions.find((question) => !isDone(question));
  const visible = interview.questions.filter((question) => isDone(question) || question === current);
  const currentRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // A new current question (after answering) takes focus — but not on page load.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    currentRef.current?.focus();
  }, [current?.index]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading level={1} size="lg">
            {interview.jobTitle}
          </Heading>
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Badge tone="ai">{t(`types.${interview.type}`)}</Badge>
            {t('session.progress', { answered: interview.answeredCount, total: interview.questionCount })}
          </div>
        </div>
        <DeleteInterview id={interview.id} />
      </div>

      <ol className="flex flex-col gap-6">
        {visible.map((question) => (
          <QuestionItem
            key={question.index}
            question={question}
            total={interview.questionCount}
            headingRef={question === current ? currentRef : undefined}
          />
        ))}
      </ol>

      {interview.status === 'IN_PROGRESS' &&
        (current ? (
          <Composer key={current.index} interviewId={interview.id} question={current} />
        ) : (
          <Finish interviewId={interview.id} />
        ))}
      {interview.result && <Summary interview={interview} />}
    </>
  );
}

function QuestionItem({
  question,
  total,
  headingRef,
}: {
  question: InterviewQuestion;
  total: number;
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations('interviews.session');
  return (
    <li className="flex flex-col gap-3">
      {/* Interviewer */}
      <div className="flex gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ai-soft text-ai-soft-fg"
        >
          <Icon name="sparkles" size="sm" />
        </span>
        <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm border border-border bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center gap-2">
            <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-fg outline-none">
              {t('questionLabel', { n: question.index + 1, total })}
            </h2>
            <Badge>{question.focus}</Badge>
          </div>
          <p className="leading-relaxed text-fg">{question.question}</p>
        </div>
      </div>

      {isDone(question) && (
        <>
          {/* Candidate */}
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-primary-fg">
              <span className="sr-only">{t('you')}: </span>
              {question.skipped ? <em>{t('skipped')}</em> : question.answer}
            </div>
          </div>
          {/* Feedback */}
          {question.feedback && question.score !== null && (
            <div className="ml-12 flex flex-col gap-2 rounded-xl border border-border bg-surface-muted/50 p-4">
              <Badge tone={answerTone(question.score)} className="self-start">
                {t('score', { score: question.score })}
              </Badge>
              <Text size="sm" className="leading-relaxed">
                {question.feedback}
              </Text>
              {question.betterAnswer && (
                <details className="group text-sm">
                  <summary className="flex cursor-pointer items-center gap-1 font-medium text-primary-text">
                    {t('betterAnswer')}
                    <Icon
                      name="chevron-down"
                      size="xs"
                      className="transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-2 leading-relaxed whitespace-pre-line text-fg-muted">
                    {question.betterAnswer}
                  </p>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

function Composer({ interviewId, question }: { interviewId: string; question: InterviewQuestion }) {
  const t = useTranslations('interviews');
  const locale = useLocale();
  const errorText = useErrorText();
  const answer = useAnswerQuestion(interviewId);
  // Each answer is scored by AI (and counts against the quota): a double submit must not send it twice.
  const answerOnce = useMutateOnce(answer);
  const skip = useSkipQuestion(interviewId);
  const skipOnce = useMutateOnce(skip);
  const speech = useSpeechRecognition(locale);
  const [text, setText] = useState('');
  const busy = answer.isPending || skip.isPending;
  const error = answer.error ?? skip.error;

  function submit(event: FormEvent) {
    event.preventDefault();
    // The browser hands over the last phrase only when recording stops: sending now would lose it.
    if (speech.listening) return;
    if (text.trim()) answerOnce({ index: question.index, answer: text.trim() });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
    >
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
      <label htmlFor="interview-answer" className="text-sm font-medium text-fg">
        {t('session.answer')}
      </label>
      <Textarea
        id="interview-answer"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        maxLength={INTERVIEW_LIMITS.answerMax}
        placeholder={t('session.answerPlaceholder')}
        disabled={busy}
      />
      {speech.listening && (
        <Text size="xs" tone="muted" role="status" className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-danger" />
          {t('speech.listening')}
        </Text>
      )}
      {speech.error && <Alert tone="warning">{t('speech.error')}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {speech.supported ? (
          <Button
            variant={speech.listening ? 'danger' : 'outline'}
            size="sm"
            aria-pressed={speech.listening}
            leftIcon={<Icon name="mic" size="sm" />}
            disabled={busy}
            onClick={() =>
              speech.toggle((phrase) => setText((current) => (current ? `${current} ${phrase}` : phrase)))
            }
          >
            {speech.listening ? t('speech.stop') : t('speech.start')}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={busy}
            loading={skip.isPending}
            onClick={() => skipOnce(question.index)}
          >
            {t('session.skip')}
          </Button>
          <Button
            type="submit"
            loading={answer.isPending}
            disabled={busy || speech.listening || !text.trim()}
          >
            {t('session.send')}
          </Button>
        </div>
      </div>
      {answer.isPending && (
        <Text size="sm" tone="muted" role="status">
          {t('session.reviewing')}
        </Text>
      )}
    </form>
  );
}

function Finish({ interviewId }: { interviewId: string }) {
  const t = useTranslations('interviews.session');
  const errorText = useErrorText();
  const complete = useCompleteInterview(interviewId);
  const completeOnce = useMutateOnce(complete);
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-ai-soft/40 p-6 text-center">
      {complete.error && <Alert tone="danger">{errorText(complete.error)}</Alert>}
      <Text>{t('allAnswered')}</Text>
      <Button
        loading={complete.isPending}
        leftIcon={<Icon name="sparkles" size="sm" />}
        onClick={() => completeOnce(undefined)}
      >
        {t('finish')}
      </Button>
      {complete.isPending && (
        <Text size="sm" tone="muted" role="status">
          {t('finishing')}
        </Text>
      )}
    </div>
  );
}

function Summary({ interview }: { interview: InterviewDetail }) {
  const t = useTranslations('interviews.session');
  const tLevels = useTranslations('analyses.result.levels');
  const result = interview.result!;
  const { level, tone } = scoreBand(result.overallScore);
  const list = (items: string[]) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-fg-subtle">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );

  return (
    <section
      aria-labelledby="interview-summary"
      className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-6 shadow-card"
    >
      <Heading level={2} size="sm" id="interview-summary" className="flex items-center gap-2">
        <Icon name="sparkles" size="sm" className="text-ai-soft-fg" />
        {t('summaryTitle')}
      </Heading>
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <ScoreGauge
            score={result.overallScore}
            tone={tone}
            label={t('overall')}
            valueText={`${result.overallScore}/100, ${tLevels(level)}`}
          />
          <Badge tone={tone}>{tLevels(level)}</Badge>
        </div>
        <Text className="leading-relaxed">{result.summary}</Text>
      </div>
      <div className={cn('grid gap-5 sm:grid-cols-2')}>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-fg">{t('strengths')}</h3>
          {list(result.strengths)}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold text-fg">{t('improvements')}</h3>
          {list(result.improvements)}
        </div>
      </div>
    </section>
  );
}

function DeleteInterview({ id }: { id: string }) {
  const t = useTranslations('interviews.session');
  const tCommon = useTranslations('common');
  const errorText = useErrorText();
  const router = useRouter();
  const toast = useToast();
  const remove = useDeleteInterview();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t('delete')}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        closeLabel={tCommon('close')}
        error={remove.error ? errorText(remove.error) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(id, {
                  onSuccess: () => {
                    toast.show({ tone: 'success', title: t('deleted') });
                    router.replace('/interviews');
                  },
                })
              }
            >
              {t('delete')}
            </Button>
          </>
        }
      />
    </>
  );
}
