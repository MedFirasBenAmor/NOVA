export const DOCUMENT_STORAGE_PROVIDER = Symbol('DOCUMENT_STORAGE_PROVIDER');

export type StoredDocument = { storageKey: string; provider: 'LOCAL' };

export type DocumentStorageProvider = {
  store(input: { buffer: Buffer; extension: string }): Promise<StoredDocument>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
};
