export const KNOWLEDGE_LIMITS = {
  /** Documents per user (each costs storage and embedding calls). */
  documentsPerUser: 20,
  fileBytes: 5 * 1024 * 1024,
  /** Characters kept per document after text extraction. */
  chars: 100_000,
  titleMax: 120,
  contentMin: 20,
  queryMax: 300,
} as const;

/** Accepted uploads. Text is extracted on the server (no AI needed for that). */
export const KNOWLEDGE_FILE_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
} as const;
export type KnowledgeMimeType = keyof typeof KNOWLEDGE_FILE_TYPES;

export const KnowledgeSource = { UPLOAD: 'UPLOAD', TEXT: 'TEXT' } as const;
export type KnowledgeSource = (typeof KnowledgeSource)[keyof typeof KnowledgeSource];
