import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalDocumentStorageProvider } from './local-document-storage.provider';

describe('LocalDocumentStorageProvider', () => {
  it('uses a random private key, stores bytes, and blocks traversal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nova-documents-'));
    const provider = new LocalDocumentStorageProvider({
      get: jest.fn().mockReturnValue(root),
    } as never);
    try {
      const first = await provider.store({
        buffer: Buffer.from('one'),
        extension: 'pdf',
      });
      const second = await provider.store({
        buffer: Buffer.from('two'),
        extension: 'pdf',
      });
      expect(first.storageKey).not.toBe(second.storageKey);
      expect(await provider.exists(first.storageKey)).toBe(true);
      await expect(provider.exists('../outside')).rejects.toThrow(
        'Invalid storage key',
      );
      await provider.delete(first.storageKey);
      expect(await provider.exists(first.storageKey)).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
