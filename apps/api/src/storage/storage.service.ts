import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';

/**
 * Stores uploaded files on local disk under STORAGE_DIR. Callers only deal in keys (`resumes/<user>/<id>.pdf`),
 * so moving to object storage (S3, GCS) later means replacing this class, not its callers.
 */
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  /**
   * @description Every stored file under a prefix, with when it was last written — for finding files no record
   * points at any more.
   * @param prefix - Top folder, e.g. `resumes`.
   * @returns Keys (`resumes/<user>/<id>.pdf`) and modification times; none when the folder doesn't exist yet.
   */
  async list(prefix: string): Promise<{ key: string; modifiedAt: Date }[]> {
    const folder = this.pathOf(prefix);
    const entries = await readdir(folder, { recursive: true, withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      },
    );
    return Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const path = join(entry.parentPath, entry.name);
          return {
            key: relative(this.root, path).split(sep).join('/'),
            modifiedAt: (await stat(path)).mtime,
          };
        }),
    );
  }

  /**
   * @description Absolute path of a key. Keys are built by the server, but the check still refuses anything that
   * would escape the storage root (`../`), as defence in depth.
   * @throws Error for keys outside the root.
   */
  private pathOf(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  }
}
