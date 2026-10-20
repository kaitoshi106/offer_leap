# 0005 — RAG with pgvector and exact per-user search

## Context

AI features (CV ↔ job analysis, cover letters) only knew the CV. Users have more evidence — project write-ups,
certificates, achievements — that a one-page CV leaves out. We want the model to use it without sending every
document in every prompt (cost, latency, prompt size).

## Decision

- Retrieval-augmented generation: documents are split into overlapping chunks, embedded with `gemini-embedding-001`
  (768 dimensions, normalised) and stored in PostgreSQL with **pgvector** — no separate vector database.
- At query time the job description is embedded as a query and the user's chunks are ranked by cosine distance; up
  to four passages above a **calibrated similarity floor** (0.62, measured on query↔document pairs) are added to the
  prompt as untrusted `<notes>`, and listed as sources in the result.
- **Exact search, no HNSW index**: every search is scoped to one user's few hundred chunks, so a sequential scan is
  fast and exact; an approximate index would apply the user filter after choosing candidates and could miss results.
  Prisma can't declare such an index either, so it would show up as schema drift.
- Text extraction stays local (pdf.js via `unpdf`, mammoth): no AI call needed to read text.
- Embeddings are logged but excluded from the per-user AI quota.

## Consequences

- One database to run and back up; retrieval joins naturally with ownership checks.
- If documents per user grew by orders of magnitude, revisit with an ANN index and filtered search (or partitioning).
- Changing the embedding model requires re-embedding documents (the model is stored per document).
- The floor depends on the embedding model; the `retrieval` eval guards it.
