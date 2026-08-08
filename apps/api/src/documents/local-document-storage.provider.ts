import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile, access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  DocumentStorageProvider,
  StoredDocument,
} from './document-storage.provider';

@Injectable()
export class LocalDocumentStorageProvider implements DocumentStorageProvider {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>('DOCUMENT_STORAGE_PATH', './var/documents'),
    );
  }

  async store(input: {
    buffer: Buffer;
    extension: string;
  }): Promise<StoredDocument> {
    const storageKey = `${randomUUID()}.${input.extension}`;
    const filePath = this.safePath(storageKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, input.buffer, { flag: 'wx', mode: 0o600 });
    return { storageKey, provider: 'LOCAL' };
  }

  async delete(storageKey: string) {
    await unlink(this.safePath(storageKey)).catch(() => undefined);
  }

  read(storageKey: string) {
    return readFile(this.safePath(storageKey));
  }

  async exists(storageKey: string) {
    return access(this.safePath(storageKey), constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  private safePath(storageKey: string) {
    const path = resolve(this.root, storageKey);
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`))
      throw new Error('Invalid storage key');
    return path;
  }
}
