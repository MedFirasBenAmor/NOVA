import { BadRequestException } from '@nestjs/common';
import {
  CollectionActionType,
  CollectionAttemptStatus,
  DocumentCollectionMode,
  DocumentStatus,
  DocumentType,
  EntityType,
  Product,
} from '@prisma/client';
import { DocumentsService, type UploadFile } from './documents.service';

const leadId = '00000000-0000-4000-8000-000000000001';
const actionId = '00000000-0000-4000-8000-000000000002';
const folderId = '00000000-0000-4000-8000-000000000003';
const documentId = '00000000-0000-4000-8000-000000000004';
const file: UploadFile = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
  originalname: '../my licence.jpg',
  mimetype: 'image/jpeg',
  size: 4,
};

function setup(
  overrides: Partial<{
    status: CollectionAttemptStatus;
    actionType: CollectionActionType;
    attemptLeadId: string;
    storeFails: boolean;
    dbFails: boolean;
    entityFails: boolean;
  }> = {},
) {
  let completedStatus: CollectionAttemptStatus | undefined;
  let createdEntityId: string | undefined;
  const attempt = {
    id: actionId,
    leadId: overrides.attemptLeadId ?? leadId,
    entityType: EntityType.DRIVER,
    entityId: null,
    documentType: 'DRIVER_LICENSE',
    product: Product.AUTO,
    status: overrides.status ?? CollectionAttemptStatus.ACCEPTED,
    actionType:
      overrides.actionType ?? CollectionActionType.SUGGEST_FULL_DOCUMENT,
  };
  const created = {
    id: documentId,
    documentType: DocumentType.DRIVER_LICENSE,
    collectionMode:
      attempt.actionType === CollectionActionType.SUGGEST_FULL_DOCUMENT
        ? DocumentCollectionMode.FULL_DOCUMENT
        : DocumentCollectionMode.TARGETED_CAPTURE,
    status: DocumentStatus.UPLOADED,
    originalFilename: '.._my_licence.jpg',
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey: 'private-key.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
    uploadedAt: new Date(),
    processingStartedAt: null,
    processedAt: null,
    failureReason: null,
  };
  const tx = {
    document: {
      create: overrides.dbFails
        ? jest.fn().mockRejectedValue(new Error('db failed'))
        : jest
            .fn()
            .mockImplementation(({ data }: { data: { entityId?: string } }) => {
              createdEntityId = data.entityId;
              return Promise.resolve(created);
            }),
    },
    collectionAttempt: {
      update: jest
        .fn()
        .mockImplementation(
          (args: { data: { status: CollectionAttemptStatus } }) => {
            completedStatus = args.data.status;
            return Promise.resolve({});
          },
        ),
    },
    auditEvent: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
  };
  const prisma = {
    lead: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: leadId, folder: { id: folderId } }),
    },
    collectionAttempt: {
      findFirst: jest
        .fn()
        .mockResolvedValue(attempt.leadId === leadId ? attempt : null),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest
      .fn()
      .mockImplementation((callback: (database: typeof tx) => unknown) =>
        callback(tx),
      ),
    document: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const storage = {
    store: overrides.storeFails
      ? jest.fn().mockRejectedValue(new Error('storage failed'))
      : jest.fn().mockResolvedValue({
          storageKey: 'private-key.jpg',
          provider: 'LOCAL',
        }),
    delete: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn(),
    read: jest.fn().mockResolvedValue(file.buffer),
  };
  const config = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  };
  const entities = {
    ensurePrimaryEntity: jest.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000077',
    }),
    assertOwnedEntityType: overrides.entityFails
      ? jest
          .fn()
          .mockRejectedValue(new BadRequestException('Entity must be DRIVER'))
      : jest.fn().mockResolvedValue({}),
  };
  const service = new DocumentsService(
    prisma as never,
    config as never,
    storage,
    { enqueue: jest.fn().mockResolvedValue({}) } as never,
    {
      completeness: jest.fn().mockResolvedValue({
        product: 'AUTO',
        completeness: 100,
        known: [],
        missing: [],
        conditionalRequired: [],
      }),
    } as never,
    {
      currentAction: jest
        .fn()
        .mockResolvedValue({ type: 'COMPLETE', actionId: 'next' }),
    } as never,
    { selectedForLead: jest.fn().mockResolvedValue(Product.AUTO) } as never,
    entities as never,
  );
  return {
    service,
    prisma,
    storage,
    tx,
    config,
    entities,
    completedStatus: () => completedStatus,
    createdEntityId: () => createdEntityId,
  };
}

describe('DocumentsService', () => {
  it('stores an accepted full document, completes its attempt, and returns safe WAIT metadata', async () => {
    const { service, completedStatus, createdEntityId } = setup();
    const result = await service.upload(leadId, file, {
      collectionActionId: actionId,
    });
    expect(result).toMatchObject({
      document: {
        id: documentId,
        documentType: 'DRIVER_LICENSE',
        collectionMode: 'FULL_DOCUMENT',
        status: 'UPLOADED',
      },
      nextAction: {
        type: 'WAIT_FOR_PROCESSING',
        documentId,
        status: 'UPLOADED',
      },
    });
    expect(JSON.stringify(result)).not.toContain('storageKey');
    expect(completedStatus()).toBe(CollectionAttemptStatus.COMPLETED);
    expect(createdEntityId()).toBe('00000000-0000-4000-8000-000000000077');
  });

  it('preserves targeted capture separately', async () => {
    const { service } = setup({
      actionType: CollectionActionType.SUGGEST_TARGETED_CAPTURE,
    });
    const result = await service.upload(leadId, file, {
      collectionActionId: actionId,
    });
    expect(result.document.collectionMode).toBe('TARGETED_CAPTURE');
    expect(result.metrics.targetedCaptureUploads).toBe(1);
  });

  it.each([CollectionAttemptStatus.DECLINED, CollectionAttemptStatus.PROPOSED])(
    'rejects a %s collection action',
    async (status) => {
      const { service } = setup({ status });
      await expect(
        service.upload(leadId, file, { collectionActionId: actionId }),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects another lead action, unsupported MIME, and oversized files', async () => {
    const foreign = setup({
      attemptLeadId: '00000000-0000-4000-8000-000000000099',
    });
    await expect(
      foreign.service.upload(leadId, file, { collectionActionId: actionId }),
    ).rejects.toThrow();
    const { service } = setup();
    await expect(
      service.upload(
        leadId,
        { ...file, mimetype: 'text/plain' },
        { collectionActionId: actionId },
      ),
    ).rejects.toThrow('Unsupported document type');
    const smallLimit = setup();
    smallLimit.config.get.mockReturnValue(1);
    await expect(
      smallLimit.service.upload(leadId, file, { collectionActionId: actionId }),
    ).rejects.toThrow('size limit');
  });

  it('rejects a document action with the wrong entity type', async () => {
    const wrong = setup({ entityFails: true });
    wrong.prisma.collectionAttempt.findFirst.mockResolvedValueOnce({
      id: actionId,
      leadId,
      entityType: EntityType.DRIVER,
      entityId: '00000000-0000-4000-8000-000000000099',
      documentType: 'DRIVER_LICENSE',
      product: Product.AUTO,
      status: CollectionAttemptStatus.ACCEPTED,
      actionType: CollectionActionType.SUGGEST_FULL_DOCUMENT,
    });
    await expect(
      wrong.service.upload(leadId, file, { collectionActionId: actionId }),
    ).rejects.toThrow(BadRequestException);
    expect(wrong.storage.store).not.toHaveBeenCalled();
  });

  it('deletes stored bytes if database persistence fails while leaving acceptance untouched', async () => {
    const { service, storage, tx } = setup({ dbFails: true });
    await expect(
      service.upload(leadId, file, { collectionActionId: actionId }),
    ).rejects.toThrow('db failed');
    expect(storage.delete).toHaveBeenCalledWith('private-key.jpg');
    expect(tx.collectionAttempt.update).not.toHaveBeenCalled();
  });
});
