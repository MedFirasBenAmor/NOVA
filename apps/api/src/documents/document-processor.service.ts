import { Inject, Injectable } from '@nestjs/common';
import {
  CollectionMethod,
  DocumentStatus,
  DocumentType,
  SourceType,
} from '@prisma/client';
import { DatapointsService } from '../datapoints/datapoints.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_STORAGE_PROVIDER,
  type DocumentStorageProvider,
} from './document-storage.provider';
import { DriverLicenseExtractor } from './driver-license.extractor';
import { OCR_PROVIDER, type OcrProvider } from './ocr/ocr.provider';

@Injectable()
export class DocumentProcessorService {
  private readonly extractor = new DriverLicenseExtractor();
  constructor(
    private readonly prisma: PrismaService,
    private readonly datapoints: DatapointsService,
    @Inject(DOCUMENT_STORAGE_PROVIDER)
    private readonly storage: DocumentStorageProvider,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
  ) {}

  async process(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (
      !document ||
      document.status === DocumentStatus.PROCESSED ||
      document.status === DocumentStatus.PROCESSING
    )
      return;
    const started = Date.now();
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.PROCESSING,
        processingStartedAt: new Date(),
        failureReason: null,
        processingProvider: this.ocr.name,
      },
    });
    await this.audit('DOCUMENT_PROCESSING_STARTED', documentId);
    try {
      if (document.documentType !== DocumentType.DRIVER_LICENSE)
        throw new Error('UNSUPPORTED_DOCUMENT_TYPE');
      if (!document.entityId) throw new Error('MISSING_DRIVER_ENTITY');
      const buffer = await this.storage.read(document.storageKey);
      const ocr = await this.ocr.recognize({
        buffer,
        mimeType: document.mimeType,
      });
      const candidates = this.extractor.extract(ocr);
      if (!candidates.length) throw new Error('EXTRACTION_NO_FIELDS');
      let accepted = 0;
      let rejected = 0;
      for (const candidate of candidates) {
        try {
          const result = await this.datapoints.upsertCandidate(
            document.leadId,
            {
              key: candidate.key,
              value: candidate.value,
              entityType: 'DRIVER',
              entityId: document.entityId,
              sourceType:
                document.collectionMode === 'FULL_DOCUMENT'
                  ? SourceType.FULL_DOCUMENT
                  : SourceType.TARGETED_DOCUMENT_CAPTURE,
              collectionMethod:
                document.collectionMode === 'FULL_DOCUMENT'
                  ? CollectionMethod.EXTRACTED
                  : CollectionMethod.TARGETED_CAPTURE,
              sourceReferenceId: document.id,
              confidence: candidate.confidence,
              metadata: {
                documentId: document.id,
                documentType: document.documentType,
                page: candidate.page,
                confidence: candidate.confidence,
              },
            },
          );
          if (result.accepted) {
            accepted += 1;
            await this.audit('DOCUMENT_CANDIDATE_ACCEPTED', result.value.id);
          } else {
            rejected += 1;
            await this.audit('DOCUMENT_CANDIDATE_REJECTED', result.value.id);
          }
        } catch {
          rejected += 1;
          await this.audit('DOCUMENT_CANDIDATE_REJECTED', document.id);
        }
      }
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.PROCESSED,
          processedAt: new Date(),
          processingDurationMs: Date.now() - started,
          processingProvider: ocr.provider ?? this.ocr.name,
          candidatesDetected: candidates.length,
          candidatesAccepted: accepted,
          candidatesRejected: rejected,
        },
      });
      await this.audit('DOCUMENT_PROCESSING_COMPLETED', documentId);
    } catch (error) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          failureReason: this.failureCode(error),
          processedAt: new Date(),
          processingDurationMs: Date.now() - started,
        },
      });
      await this.audit('DOCUMENT_PROCESSING_FAILED', documentId);
      throw error;
    }
  }
  private audit(action: string, entityId: string) {
    return this.prisma.auditEvent.create({
      data: { action, entityType: 'Document', entityId },
    });
  }

  private failureCode(error: unknown) {
    if (!(error instanceof Error)) return 'PROCESSING_INTERNAL_ERROR';
    const known = new Set([
      'OCR_PROVIDER_UNAVAILABLE',
      'OCR_TIMEOUT',
      'OCR_UNREADABLE',
      'UNSUPPORTED_DOCUMENT_CONTENT',
      'EXTRACTION_NO_FIELDS',
      'UNSUPPORTED_DOCUMENT_TYPE',
      'MISSING_DRIVER_ENTITY',
    ]);
    return known.has(error.message)
      ? error.message
      : 'PROCESSING_INTERNAL_ERROR';
  }
}
