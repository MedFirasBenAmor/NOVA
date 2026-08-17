import {
  DocumentCollectionMode,
  DocumentStatus,
  DocumentType,
} from '@prisma/client';
import { DocumentProcessorService } from './document-processor.service';

describe('DocumentProcessorService', () => {
  it('processes a driver license, preserves provenance, and is idempotent', async () => {
    const document = {
      id: '00000000-0000-4000-8000-000000000001',
      leadId: '00000000-0000-4000-8000-000000000002',
      entityId: '00000000-0000-4000-8000-000000000003',
      documentType: DocumentType.DRIVER_LICENSE,
      collectionMode: DocumentCollectionMode.FULL_DOCUMENT,
      status: DocumentStatus.UPLOADED as DocumentStatus,
      storageKey: 'private.jpg',
      mimeType: 'image/jpeg',
    };
    const updates: Array<Record<string, unknown>> = [];
    const prisma = {
      document: {
        findUnique: jest.fn().mockResolvedValue(document),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            updates.push(data);
            return Promise.resolve({});
          }),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const datapoints = {
      upsertCandidate: jest
        .fn()
        .mockResolvedValue({ accepted: true, value: { id: document.id } }),
    };
    const storage = {
      read: jest.fn().mockResolvedValue(Buffer.from('synthetic')),
      store: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
    };
    const ocr = {
      name: 'mock',
      recognize: jest.fn().mockResolvedValue({
        textBlocks: [
          { text: 'SURNAME: TREMBLAY', confidence: 0.99, page: 1 },
          { text: 'GIVEN NAME: ALEX', confidence: 0.99, page: 1 },
          { text: 'DOB: 1990-05-17', confidence: 0.98, page: 1 },
        ],
      }),
    };
    const entities = { assertOwnedEntityType: jest.fn().mockResolvedValue({}) };
    const service = new DocumentProcessorService(
      prisma as never,
      datapoints as never,
      storage,
      ocr,
      entities as never,
    );
    await service.process(document.id);
    expect(datapoints.upsertCandidate).toHaveBeenCalledTimes(3);
    const firstCall = datapoints.upsertCandidate.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(firstCall[0]).toBe(document.leadId);
    expect(firstCall[1].sourceType).toBe('FULL_DOCUMENT');
    expect(firstCall[1].sourceReferenceId).toBe(document.id);
    expect(firstCall[1].entityId).toBe(document.entityId);
    expect(entities.assertOwnedEntityType).toHaveBeenCalledWith(
      document.leadId,
      document.entityId,
      'DRIVER',
    );
    expect((firstCall[1].metadata as Record<string, unknown>).documentId).toBe(
      document.id,
    );
    expect(updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'PROCESSING' }),
        expect.objectContaining({ status: 'PROCESSED', candidatesAccepted: 3 }),
      ]),
    );
    document.status = DocumentStatus.PROCESSED;
    await service.process(document.id);
    expect(datapoints.upsertCandidate).toHaveBeenCalledTimes(3);
  });

  it('rejects documents whose entity is not the owned driver', async () => {
    const document = {
      id: '00000000-0000-4000-8000-000000000001',
      leadId: 'lead',
      entityId: '00000000-0000-4000-8000-000000000099',
      documentType: DocumentType.DRIVER_LICENSE,
      collectionMode: DocumentCollectionMode.FULL_DOCUMENT,
      status: DocumentStatus.UPLOADED,
      storageKey: 'private.jpg',
      mimeType: 'image/jpeg',
    };
    const update = jest.fn().mockResolvedValue({});
    const service = new DocumentProcessorService(
      {
        document: { findUnique: jest.fn().mockResolvedValue(document), update },
        auditEvent: { create: jest.fn().mockResolvedValue({}) },
      } as never,
      {} as never,
      {} as never,
      { name: 'mock', recognize: jest.fn() },
      {
        assertOwnedEntityType: jest
          .fn()
          .mockRejectedValue(new Error('wrong type')),
      } as never,
    );
    await expect(service.process(document.id)).rejects.toThrow('wrong type');
    const failureCall = update.mock.calls.at(-1) as [
      { data: Record<string, unknown> },
    ];
    expect(failureCall[0].data.status).toBe('FAILED');
  });

  it('marks failures safely', async () => {
    const document = {
      id: '00000000-0000-4000-8000-000000000001',
      leadId: 'lead',
      entityId: null,
      documentType: DocumentType.DRIVER_LICENSE,
      collectionMode: DocumentCollectionMode.TARGETED_CAPTURE,
      status: DocumentStatus.UPLOADED,
      storageKey: 'private.jpg',
      mimeType: 'image/jpeg',
    };
    const update = jest.fn().mockResolvedValue({});
    const service = new DocumentProcessorService(
      {
        document: { findUnique: jest.fn().mockResolvedValue(document), update },
        auditEvent: { create: jest.fn().mockResolvedValue({}) },
      } as never,
      {} as never,
      {} as never,
      { name: 'mock', recognize: jest.fn() },
      { assertOwnedEntityType: jest.fn().mockResolvedValue({}) } as never,
    );
    await expect(service.process(document.id)).rejects.toThrow(
      'MISSING_DRIVER_ENTITY',
    );
    const failureCall = update.mock.calls.at(-1) as [
      { data: Record<string, unknown> },
    ];
    expect(failureCall[0].data.status).toBe('FAILED');
    expect(failureCall[0].data.failureReason).toBe('MISSING_DRIVER_ENTITY');
  });
});
