import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Icon } from '@/components/atoms';
import { scoreBand } from '@/features/analyses/components/match';

import { CV_SKILLS, DEMO_INTERVIEW, DEMO_MATCH, holdOnStageCue, JOB_SKILLS } from '../demo';
import { Duo } from './Duo';

/** The application forms stacked on the night side, each asking for the same things again. */
const FORMS = [
  ['name', 'experience'],
  ['name', 'skills'],
  ['name', 'experience', 'skills'],
] as const;

const nightCard = 'rounded-xl bg-night-surface p-4 shadow-popover ring-1 ring-night-border';
const dayCard = 'rounded-xl bg-surface p-4 shadow-popover ring-1 ring-border';

/**
 * @description Act 2, repetition: a stack of application forms typed again on the night side, a profile filled
 * once on the day side: on entry the upload bar runs, then each field is written in and ticked, in order.
 */
export function ProfileAct() {
  const t = useTranslations('home');
  const shownSkills = CV_SKILLS.slice(0, 3)
    .map((skill) => t(`demo.skills.${skill}`))
    .join(', ');
  const fields: [string, ReactNode][] = [
    [t('profile.fields.name'), t('demo.name')],
    [t('profile.fields.role'), t('demo.role')],
    [t('profile.fields.experience'), t('demo.experience')],
    [t('profile.fields.skills'), `${shownSkills} ${t('profile.more', { count: CV_SKILLS.length - 3 })}`],
  ];

  return (
    <Duo
      id="profile"
      label={t('acts.profile')}
      night={{
        title: t('profile.nightTitle'),
        body: t('profile.nightBody'),
        children: (
          <div aria-hidden data-sc-in className="grid max-w-sm pb-14">
            {FORMS.map((rows, index) => (
              <div key={index} className={`ol-form col-start-1 row-start-1 ${nightCard}`}>
                <p className="text-xs font-bold tracking-[0.08em] text-night-fg-muted uppercase">
                  {t('profile.formLabel')}
                </p>
                {rows.map((field, row) => (
                  <div
                    key={field}
                    className="mt-2.5 grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 text-sm"
                  >
                    <span className="text-night-fg-muted">{t(`profile.fields.${field}`)}</span>
                    <span className="flex h-8 items-center rounded-md bg-night px-2 ring-1 ring-night-border">
                      {index === FORMS.length - 1 && row === 0 && (
                        <i className="ol-caret block h-4 w-px bg-night-fg" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ),
      }}
      day={{
        title: t('profile.dayTitle'),
        body: t('profile.dayBody'),
        children: (
          <div data-sc-in className={`ol-fill max-w-md ${dayCard}`}>
            <p className="text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
              {t('profile.profileLabel')} · {t('demoLabel')}
            </p>
            {/* The upload runs first, then each field is written in turn and ticked (landing.css, on .sc-in). */}
            <p className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
              <Icon name="file-text" size="xs" className="text-primary-text" />
              <span className="truncate">{t('profile.fileName')}</span>
            </p>
            <div aria-hidden className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="ol-fill__bar h-full bg-primary" />
            </div>
            <dl className="mt-1">
              {fields.map(([label, value]) => (
                <div
                  key={label}
                  className="ol-fill__row mt-2.5 grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 text-sm"
                >
                  <dt className="text-fg-muted">{label}</dt>
                  <dd className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-md bg-surface-muted px-2 font-medium ring-1 ring-border">
                    <span className="ol-fill__value truncate">{value}</span>
                    <span className="ol-fill__check">
                      <Icon name="check" size="sm" className="text-success" />
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ),
      }}
    />
  );
}

/**
 * @description Act 3, guessing: a question mark on the night side; on the day side the match score counts up on
 * entry (engine `data-sc-count`) with the skills that make it. The score is computed from the sample skills.
 */
export function MatchAct() {
  const t = useTranslations();
  const { matched, missing, score } = DEMO_MATCH;
  const { level } = scoreBand(score);
  const levelText = t(`analyses.result.levels.${level}`);

  return (
    <Duo
      id="match"
      label={t('home.acts.match')}
      night={{
        title: t('home.match.nightTitle'),
        body: t('home.match.nightBody'),
        children: (
          <p
            aria-hidden
            data-sc-in
            className="text-[clamp(7rem,16vw,13rem)] leading-none font-extrabold text-night-border"
          >
            ?
          </p>
        ),
      }}
      day={{
        title: t('home.match.dayTitle'),
        body: t('home.match.dayBody'),
        children: (
          <div
            className={`grid max-w-xl grid-cols-1 items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] ${dayCard}`}
          >
            <div
              data-sc-in
              role="meter"
              aria-label={t('analyses.result.score')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
              aria-valuetext={`${t('analyses.result.scoreValue', { score })}, ${levelText}`}
              className="ol-gauge relative size-34 justify-self-center text-primary"
            >
              <svg viewBox="0 0 100 100" aria-hidden className="size-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  strokeWidth="9"
                  className="stroke-surface-sunken"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  strokeWidth="9"
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="100"
                  strokeDashoffset={100 - score}
                  className="ol-gauge__arc stroke-current"
                />
              </svg>
              <span
                aria-hidden
                className="absolute inset-0 grid place-items-center text-4xl font-extrabold text-fg"
              >
                <span data-sc-count={`0 ${score}`} className="tabular-nums">
                  {score}
                </span>
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
                {t('home.match.basis', {
                  jobTitle: t('home.demo.jobTitle'),
                  matched: matched.length,
                  total: JOB_SKILLS.length,
                })}{' '}
                · {t('home.demoLabel')}
              </p>
              <ul data-sc-in data-sc-stagger="45" className="mt-2 flex flex-wrap gap-1.5">
                {matched.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-md bg-success-soft px-2 py-1 text-xs font-semibold text-success-soft-fg"
                  >
                    {t(`home.demo.skills.${skill}`)}
                  </li>
                ))}
              </ul>
              <ul data-sc-in data-sc-stagger="45" className="mt-2 flex flex-wrap gap-1.5">
                {missing.map((skill) => (
                  <li
                    key={skill}
                    className="rounded-md bg-warning-soft px-2 py-1 text-xs font-semibold text-warning-soft-fg"
                  >
                    {t('home.match.missing', { skill: t(`home.demo.skills.${skill}`) })}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ),
      }}
    />
  );
}

const fromCv = (chunks: ReactNode) => (
  <mark className="rounded-sm bg-primary-soft px-0.5 text-primary-soft-fg">{chunks}</mark>
);
const fromDocs = (chunks: ReactNode) => (
  <mark className="rounded-sm bg-ai-soft px-0.5 text-ai-soft-fg">{chunks}</mark>
);

/** Act progress at which each line of the real letter appears. */
const LETTER_LINES_AT = [0, 0.1, 0.24, 0.38, 0.52];

/**
 * @description Act 4, voice (pinned): the night side's midnight draft is struck out line by line (CSS from the
 * act's `--sc-p`) while the day side's letter writes itself (engine cues), its phrases marked by source.
 */
export function LetterAct() {
  const t = useTranslations('home');
  const lines: ReactNode[] = [
    t('letter.greeting', { company: t('demo.company') }),
    t.rich('letter.p1', { cv: fromCv, doc: fromDocs }),
    t.rich('letter.p2', { cv: fromCv, doc: fromDocs }),
    t('letter.p3'),
    <>
      {fromCv(t('letter.fromCv'))} · {fromDocs(t('letter.fromDocs'))}
    </>,
  ];

  return (
    <Duo
      id="letter"
      label={t('acts.letter')}
      sectionProps={{ 'data-sc-act': 'pin', 'data-sc-span': '2' }}
      pinned
      night={{
        title: t('letter.nightTitle'),
        className: 'justify-center max-md:justify-start max-md:pt-14 max-md:gap-2',
        children: (
          <div
            aria-label={t('letter.draftLabel')}
            role="group"
            className={`flex max-w-md flex-col gap-2 text-[0.95rem] leading-relaxed max-md:gap-1 max-md:text-sm ${nightCard}`}
          >
            <p className="text-night-fg-muted italic">{t('letter.draftGreeting')}</p>
            <p className="ol-strike">{t('letter.draft1')}</p>
            <p className="ol-strike">{t('letter.draft2')}</p>
            <p className="ol-strike">{t('letter.draft3')}</p>
            <p className="ol-strike">{t('letter.draft4')}</p>
            <p className="text-night-fg-muted italic">{t('letter.draftNote')}</p>
          </div>
        ),
      }}
      day={{
        title: t('letter.dayTitle'),
        className: 'justify-center max-md:justify-start max-md:pt-8 max-md:gap-2',
        children: (
          <div
            aria-label={t('letter.letterLabel')}
            role="group"
            className={`flex max-w-md flex-col gap-2 text-[0.95rem] leading-relaxed max-md:gap-1 max-md:text-sm ${dayCard}`}
          >
            {lines.map((line, index) => (
              <p
                key={index}
                data-sc-cue={holdOnStageCue(LETTER_LINES_AT[index]!, index === 0 ? 0 : 0.06)}
                data-sc-rise="0.3"
                className={index === lines.length - 1 ? 'text-fg-muted' : undefined}
              >
                {line}
              </p>
            ))}
          </div>
        ),
      }}
    />
  );
}

/**
 * @description Act 5, rehearsal: the quiet act before the close. A mirror on the night side, a mock interview with
 * feedback on the day side, both wiped in as the section crosses the viewport (engine `data-sc-reveal`).
 */
export function InterviewAct() {
  const t = useTranslations();
  const { question, total, score } = DEMO_INTERVIEW;

  return (
    <Duo
      id="interview"
      label={t('home.acts.interview')}
      sectionProps={{ 'data-sc-act': 'flow' }}
      night={{
        title: t('home.interview.nightTitle'),
        body: t('home.interview.nightBody'),
        children: (
          <div
            aria-hidden
            data-sc-reveal="down"
            data-sc-reveal-at="0.15 0.5"
            className="grid h-60 max-w-sm place-items-center rounded-t-[7.5rem] rounded-b-2xl bg-night-surface p-8 text-center text-night-fg-muted italic ring-1 ring-night-border"
          >
            {t('home.interview.mirror')}
          </div>
        ),
      }}
      day={{
        title: t('home.interview.dayTitle'),
        body: t('home.interview.dayBody'),
        children: (
          <div
            data-sc-reveal="up"
            data-sc-reveal-at="0.15 0.5"
            className={`flex max-w-lg flex-col gap-3 ${dayCard}`}
          >
            <p className="text-xs font-bold tracking-[0.08em] text-fg-muted uppercase">
              {t('home.interview.session', {
                question: t('interviews.session.questionLabel', { n: question, total }),
              })}{' '}
              · {t('home.demoLabel')}
            </p>
            <p className="max-w-[90%] rounded-xl rounded-tl-sm bg-surface-muted px-4 py-3 text-sm">
              {t('home.interview.question')}
            </p>
            <p className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-fg">
              {t('home.interview.answer')}
            </p>
            <p className="text-sm">
              <span className="mr-2 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-soft-fg">
                {t('interviews.session.score', { score })}
              </span>
              {t('home.interview.feedback')}
            </p>
          </div>
        ),
      }}
    />
  );
}
