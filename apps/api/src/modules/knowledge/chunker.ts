export interface ChunkOptions {
  /** Target characters per chunk (a few paragraphs: enough context, still specific). */
  size?: number;
  /** Characters repeated from the end of the previous chunk, so a fact split at a boundary is kept whole. */
  overlap?: number;
}

/** Cleans extracted text: unified line breaks, no trailing spaces, at most one blank line in a row. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @description Splits text into overlapping chunks for embedding. Prefers paragraph breaks, then sentence ends,
 * then spaces, so chunks rarely cut a sentence in half.
 * @param text - Normalised text.
 * @param options - {@link ChunkOptions}
 */
export function chunkText(text: string, { size = 900, overlap = 150 }: ChunkOptions = {}): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      // Look for the best break in the last 40% of the window.
      const window = text.slice(start + Math.floor(size * 0.6), end);
      const breakAt = [
        window.lastIndexOf('\n\n'),
        window.search(/[.!?]\s[^.!?]*$/),
        window.lastIndexOf(' '),
      ].find((index) => index > 0);
      if (breakAt !== undefined) end = start + Math.floor(size * 0.6) + breakAt + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    // Step back for the overlap, but always move forward.
    start = Math.max(end - overlap, start + 1);
    // Start the next chunk on a word boundary.
    const space = text.indexOf(' ', start);
    if (space !== -1 && space < end) start = space + 1;
  }
  return chunks;
}
