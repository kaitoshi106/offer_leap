import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

/** Where uploaded files are kept. */
interface FileStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

/** Local disk under STORAGE_DIR: development, Docker with a volume, any host with a persistent disk. */
class DiskFileStore implements FileStore {
  private readonly root: string;

  constructor(directory: string) {
    this.root = resolve(directory);
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

/**
 * Postgres (`stored_files`): for hosts whose disk is wiped on every restart or deploy (free tiers). Files are small
 * (CVs and notes, 10 MB at most) and read rarely, so the database copes; it is the one thing that is persistent.
 */
class DatabaseFileStore implements FileStore {
  constructor(private readonly prisma: PrismaService) {}

  async put(key: string, data: Buffer): Promise<void> {
    const bytes = new Uint8Array(data);
    await this.prisma.storedFile.upsert({
      where: { key },
      create: { key, data: bytes },
      update: { data: bytes },
    });
  }

  /** @throws Error when there is no such file (like the disk store's ENOENT). */
  async get(key: string): Promise<Buffer> {
    const file = await this.prisma.storedFile.findUnique({ where: { key } });
    if (!file) throw new Error(`No stored file: ${key}`);
    return Buffer.from(file.data);
  }

  async remove(key: string): Promise<void> {
    await this.prisma.storedFile.deleteMany({ where: { key } });
  }
}

/**
 * Stores uploaded files. Callers only deal in keys (`resumes/<user>/<id>.pdf`); `STORAGE_DRIVER` picks where the
 * bytes go (`disk` under STORAGE_DIR, or `database`), so moving to object storage (S3, GCS) later means adding a
 * store here, not changing its callers.
 */
@Injectable()
export class StorageService implements FileStore {
  private readonly store: FileStore;

  constructor(config: ConfigService<Env, true>, prisma: PrismaService) {
    this.store =
      config.get('STORAGE_DRIVER', { infer: true }) === 'database'
        ? new DatabaseFileStore(prisma)
        : new DiskFileStore(config.get('STORAGE_DIR', { infer: true }));
  }

  put(key: string, data: Buffer): Promise<void> {
    return this.store.put(key, data);
  }

  get(key: string): Promise<Buffer> {
    return this.store.get(key);
  }

  remove(key: string): Promise<void> {
    return this.store.remove(key);
  }
}
