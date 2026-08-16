import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionActionType,
  CollectionAttemptStatus,
  DocumentCollectionMode,
  DocumentStatus,
  DocumentType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentQueueService } from './document-queue.service';
import { DatapointsService } from '../datapoints/datapoints.service';
import { RequirementProfileService } from '../datapoints/requirement-profile.service';
import { CollectionStrategyService } from '../collection/collection-strategy.service';
import {
  DOCUMENT_STORAGE_PROVIDER,
  type DocumentStorageProvider,
} from './document-storage.provider';

const acceptedActions = new Set<CollectionActionType>([
  CollectionActionType.SUGGEST_FULL_DOCUMENT,
  CollectionActionType.SUGGEST_TARGETED_CAPTURE,
]);
const mimeExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(DOCUMENT_STORAGE_PROVIDER)
    private readonly storage: DocumentStorageProvider,
    private readonly queue: DocumentQueueService,
    private readonly datapoints: DatapointsService,
    private readonly strategy: CollectionStrategyService,
    private readonly profiles: RequirementProfileService,
  ) {}

  async upload(
    leadId: string,
    file: UploadFile | undefined,
    dto: { collectionActionId: string },
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { folder: true },
    });
    if (!lead || !lead.folder)
      throw new NotFoundException(`Lead not found: ${leadId}`);
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: { id: dto.collectionActionId, leadId },
    });
    if (!attempt || !acceptedActions.has(attempt.actionType))
      throw new BadRequestException(
        'Collection action cannot receive a document',
      );
    if (attempt.status !== CollectionAttemptStatus.ACCEPTED)
      throw new BadRequestException(
        'Collection action must be accepted before upload',
      );
    if (!file?.buffer)
      throw new BadRequestException('A document file is required');
    this.validateFile(file);
    const extension = mimeExtensions[file.mimetype];
    const mode =
      attempt.actionType === CollectionActionType.SUGGEST_FULL_DOCUMENT
        ? DocumentCollectionMode.FULL_DOCUMENT
        : DocumentCollectionMode.TARGETED_CAPTURE;
    const documentType = this.documentType(attempt.documentType);
    const entityId =
      attempt.entityId ??
      (documentType === DocumentType.DRIVER_LICENSE ? randomUUID() : null);
    await this.audit('DOCUMENT_UPLOAD_STARTED', leadId);
    let stored: { storageKey: string; provider: 'LOCAL' } | undefined;
    try {
      stored = await this.storage.store({ buffer: file.buffer, extension });
      const document = await this.prisma.$transaction(async (tx) => {
        const created = await tx.document.create({
          data: {
            leadId,
            customerFolderId: lead.folder!.id,
            collectionAttemptId: attempt.id,
            entityType: attempt.entityType,
            entityId,
            documentType,
            collectionMode: mode,
            originalFilename: this.filename(file.originalname),
            mimeType: file.mimetype,
            sizeBytes: file.size,
            storageProvider: stored!.provider,
            storageKey: stored!.storageKey,
            status: DocumentStatus.UPLOADED,
            uploadedAt: new Date(),
          },
        });
        await tx.collectionAttempt.update({
          where: { id: attempt.id },
          data: {
            status: CollectionAttemptStatus.COMPLETED,
            entityId,
            resolvedAt: new Date(),
          },
        });
        await tx.auditEvent.createMany({
          data: [
            {
              action: 'DOCUMENT_UPLOADED',
              entityType: 'Document',
              entityId: created.id,
            },
            {
              action: 'DOCUMENT_STATUS_CHANGED',
              entityType: 'Document',
              entityId: created.id,
            },
            {
              action: 'COLLECTION_ACTION_COMPLETED',
              entityType: 'CollectionAttempt',
              entityId: attempt.id,
            },
          ],
        });
        return created;
      });
      const nextAction = {
        type: 'WAIT_FOR_PROCESSING' as const,
        documentId: document.id,
        documentType: document.documentType,
        status: 'UPLOADED' as const,
      };
      try {
        await this.queue.enqueue(document.id);
        await this.audit('DOCUMENT_PROCESSING_QUEUED', document.id);
      } catch {
        await this.prisma.document.update({
          where: { id: document.id },
          data: { failureReason: 'QUEUE_UNAVAILABLE' },
        });
      }
      return {
        document: this.metadata(document),
        nextAction,
        metrics: {
          fullDocumentUploads:
            mode === DocumentCollectionMode.FULL_DOCUMENT ? 1 : 0,
          targetedCaptureUploads:
            mode === DocumentCollectionMode.TARGETED_CAPTURE ? 1 : 0,
          uploadFailures: 0,
          uploadedBytes: file.size,
          documentType,
        },
      };
    } catch (error) {
      if (stored) await this.storage.delete(stored.storageKey);
      await this.audit('DOCUMENT_UPLOAD_FAILED', leadId);
      throw error;
    }
  }

  async list(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException(`Lead not found: ${leadId}`);
    return this.prisma.document.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentType: true,
        collectionMode: true,
        status: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,
        uploadedAt: true,
        processingStartedAt: true,
        processedAt: true,
        failureReason: true,
      },
    });
  }

  async status(leadId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, leadId },
    });
    if (!document) throw new NotFoundException('Document not found');
    if (document.status === DocumentStatus.UPLOADED) {
      await this.queue.enqueue(document.id).catch(() => undefined);
    }
    if (
      document.status === DocumentStatus.UPLOADED ||
      document.status === DocumentStatus.PROCESSING
    ) {
      return { documentId, status: document.status };
    }
    const completeness = await this.datapoints.completeness(leadId, 'AUTO');
    return {
      documentId,
      status: document.status,
      failureReason: document.failureReason,
      completeness,
      nextAction: await this.strategy.select(leadId, 'AUTO', completeness),
    };
  }

  private validateFile(file: UploadFile) {
    const max = Number(
      this.config.get('MAX_DOCUMENT_UPLOAD_BYTES', 10 * 1024 * 1024),
    );
    if (!mimeExtensions[file.mimetype])
      throw new BadRequestException('Unsupported document type');
    if (file.size > max)
      throw new BadRequestException('Document exceeds the upload size limit');
    const b = file.buffer;
    const valid =
      file.mimetype === 'image/jpeg'
        ? b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : file.mimetype === 'image/png'
          ? b
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.mimetype === 'application/pdf'
            ? b.subarray(0, 4).toString() === '%PDF'
            : b.subarray(0, 4).toString() === 'RIFF' &&
              b.subarray(8, 12).toString() === 'WEBP';
    if (!valid)
      throw new BadRequestException(
        'Document content does not match its MIME type',
      );
  }

  private documentType(value: string | null) {
    return Object.values(DocumentType).includes(value as DocumentType)
      ? (value as DocumentType)
      : DocumentType.OTHER;
  }
  private filename(value: string) {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'document';
  }
  private metadata(document: {
    id: string;
    documentType: DocumentType;
    collectionMode: DocumentCollectionMode;
    status: DocumentStatus;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    updatedAt: Date;
    uploadedAt: Date | null;
    processingStartedAt: Date | null;
    processedAt: Date | null;
    failureReason: string | null;
  }) {
    return {
      id: document.id,
      documentType: document.documentType,
      collectionMode: document.collectionMode,
      status: document.status,
      originalFilename: document.originalFilename,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      uploadedAt: document.uploadedAt,
      processingStartedAt: document.processingStartedAt,
      processedAt: document.processedAt,
      failureReason: document.failureReason,
    };
  }
  private audit(action: string, leadId: string) {
    return this.prisma.auditEvent.create({
      data: { action, entityType: 'Lead', entityId: leadId },
    });
  }
}

export type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};
