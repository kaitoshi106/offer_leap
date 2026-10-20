/** Personal-document passages (Vietnamese) searched with job descriptions (mixed languages). */
export const RETRIEVAL_DOCUMENTS = {
  graphql:
    'Dự án Shopify Admin clone (2024): xây dựng API GraphQL với Apollo Server, DataLoader để tránh N+1, và kiểm thử end-to-end bằng Playwright cho toàn bộ luồng thanh toán.',
  aws: 'Chứng chỉ AWS Certified Developer – Associate (2023). Triển khai ứng dụng Node.js lên ECS, dùng S3, CloudFront và RDS PostgreSQL.',
  team: 'Mentor cho 3 lập trình viên junior, tổ chức code review hằng tuần và viết tài liệu onboarding cho nhóm frontend.',
  hobby: 'Sở thích: nấu phở bò, làm bánh mì, chụp ảnh phong cảnh vào cuối tuần cùng gia đình.',
} as const;

export type RetrievalDocument = keyof typeof RETRIEVAL_DOCUMENTS;

export interface RetrievalCase {
  id: string;
  query: string;
  /** Must rank first. */
  expected: RetrievalDocument;
  /** Must fall below the similarity floor (never sent to the model). */
  irrelevant: RetrievalDocument[];
}

export const RETRIEVAL_CASES: RetrievalCase[] = [
  {
    id: 'en-graphql-job',
    query:
      'Senior Frontend Engineer: React, TypeScript, GraphQL with Apollo, testing with Playwright. 5+ years.',
    expected: 'graphql',
    irrelevant: ['hobby'],
  },
  {
    id: 'en-cloud-job',
    query: 'Backend Engineer with AWS experience: ECS, S3, PostgreSQL, Node.js. Certification is a plus.',
    expected: 'aws',
    irrelevant: ['hobby'],
  },
  {
    id: 'vi-lead-job',
    query: 'Tuyển Tech Lead frontend: dẫn dắt nhóm, review code, đào tạo thành viên mới.',
    expected: 'team',
    irrelevant: ['hobby'],
  },
  {
    id: 'vi-payments-job',
    query: 'Cần kỹ sư có kinh nghiệm kiểm thử tự động luồng thanh toán và thiết kế API.',
    expected: 'graphql',
    irrelevant: ['hobby'],
  },
];
