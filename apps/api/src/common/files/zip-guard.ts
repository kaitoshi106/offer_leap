import { inflateRawSync } from 'node:zlib';

/**
 * Most a Word file may unpack to. Real CVs and notes stay far below (text plus a few images); a file above it is
 * refused before any library unpacks it.
 */
export const DOCX_MAX_UNPACKED_BYTES = 50 * 1024 * 1024;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

/**
 * @description How many bytes a ZIP archive (e.g. a DOCX) really unpacks to, as long as that is at most `limit`.
 * A small upload can be crafted to unpack into gigabytes and exhaust the server's memory when a library reads it
 * (a "zip bomb"); the sizes written in the archive can lie, so every entry is actually inflated here, with the
 * output capped by the remaining budget. The work is bounded by `limit`, whatever the archive claims.
 * @param data - The archive.
 * @param limit - Largest total unpacked size accepted, in bytes.
 * @returns The total unpacked size, or `null` when it exceeds `limit` or the archive can't be read.
 */
export function unzippedSizeWithin(data: Buffer, limit: number): number | null {
  try {
    const end = findEndOfCentralDirectory(data);
    if (end === -1) return null;
    const entries = data.readUInt16LE(end + 10);
    let cursor = data.readUInt32LE(end + 16);
    let total = 0;
    for (let index = 0; index < entries; index += 1) {
      if (data.readUInt32LE(cursor) !== CENTRAL_FILE_HEADER) return null;
      const method = data.readUInt16LE(cursor + 10);
      const compressedSize = data.readUInt32LE(cursor + 20);
      const localOffset = data.readUInt32LE(cursor + 42);
      cursor +=
        46 + data.readUInt16LE(cursor + 28) + data.readUInt16LE(cursor + 30) + data.readUInt16LE(cursor + 32);

      if (data.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) return null;
      const start =
        localOffset + 30 + data.readUInt16LE(localOffset + 26) + data.readUInt16LE(localOffset + 28);
      const compressed = data.subarray(start, start + compressedSize);
      const budget = limit - total;
      if (method === STORED) total += compressed.length;
      // Throws (RangeError) as soon as the output would pass the budget.
      else if (method === DEFLATED)
        total += inflateRawSync(compressed, { maxOutputLength: budget + 1 }).length;
      else return null;
      if (total > limit) return null;
    }
    return total;
  } catch {
    return null;
  }
}

/** Offset of the end-of-central-directory record (at most 64 KB of comment after it), or -1. */
function findEndOfCentralDirectory(data: Buffer): number {
  const stop = Math.max(0, data.length - 22 - 0xffff);
  for (let offset = data.length - 22; offset >= stop; offset -= 1) {
    if (data.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;
  }
  return -1;
}
