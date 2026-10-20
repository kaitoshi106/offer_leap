import type { Locale } from '@offerleap/shared';

import type { Expectation } from '../scorers';

export interface JobMatchCase {
  id: string;
  note: string;
  locale: Locale;
  cv: string;
  jobDescription: string;
  expected: Record<string, Expectation>;
  /** The summary must be written in the requested language. */
  summaryInLocale: boolean;
}

const REACT_CV = `Nguyễn Văn An — Senior Frontend Developer, Hà Nội
2019 – nay: Senior Frontend Developer, ABC Software — React, TypeScript, Next.js, Jest, design system
2017 – 2019: Frontend Developer, XYZ — Vue.js
Kỹ năng: React, TypeScript, Next.js, Jest, Tailwind CSS`;

const NODE_CV = `Le Thi Nhung — Backend Engineer, Ho Chi Minh City
2021 – present: Backend Engineer, FinPay — NestJS, PostgreSQL, Redis, Kafka, payment microservices
2019 – 2021: Junior Developer, Sunrise — Node.js, Express, MongoDB
Skills: Node.js, NestJS, TypeScript, PostgreSQL, Kafka, Docker, AWS`;

const MARKETING_CV = `Pham Thu Ha — Digital Marketing Specialist, Da Nang
2018 – 2023: Digital Marketing Executive — SEO, Google Ads, Facebook Ads, content
Skills: SEO, Google Ads, Content Marketing`;

export const JOB_MATCH_CASES: JobMatchCase[] = [
  {
    id: 'strong-fit-react',
    note: 'Senior React CV for a senior React role',
    locale: 'en',
    cv: REACT_CV,
    jobDescription: `Acme is hiring a Senior Frontend Engineer.
Requirements: 5+ years with React and TypeScript, Next.js, unit testing (Jest). Nice to have: design systems, GraphQL.`,
    expected: {
      score: { range: [70, 100] },
      matchedSkills: { includes: ['React', 'TypeScript'] },
      missingSkills: { excludes: ['React', 'TypeScript'] },
    },
    summaryInLocale: false,
  },
  {
    id: 'partial-fit-go',
    note: 'Node backend CV for a Go role: Go and Kubernetes missing, answered in Vietnamese',
    locale: 'vi',
    cv: NODE_CV,
    jobDescription: `CloudBank tuyển Senior Backend Engineer (Golang).
Yêu cầu: 5+ năm backend, thành thạo Go, microservices, PostgreSQL, Kafka, Kubernetes, hệ thống thanh toán.`,
    expected: {
      score: { range: [35, 75] },
      missingSkills: { includes: ['Go|Golang'] },
    },
    summaryInLocale: true,
  },
  {
    id: 'poor-fit-marketing',
    note: 'Marketing CV for a backend role scores low',
    locale: 'en',
    cv: MARKETING_CV,
    jobDescription: `We need a Backend Engineer: 3+ years with Java or Go, SQL databases, REST APIs, Docker.`,
    expected: { score: { range: [0, 30] } },
    summaryInLocale: false,
  },
];
