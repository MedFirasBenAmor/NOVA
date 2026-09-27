import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CollectionMethod,
  DocumentStatus,
  DocumentType,
  EntityType,
  Product,
  SourceType,
} from '@prisma/client';
import type {
  IntelligenceCandidateDatapoint,
  IntelligenceInput,
} from '@nova/shared-types';
import { DatapointsService } from '../datapoints/datapoints.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DOCUMENT_STORAGE_PROVIDER,
  type DocumentStorageProvider,
} from './document-storage.provider';
import { DriverLicenseExtractor } from './driver-license.extractor';
import { EntityLifecycleService } from '../datapoints/entity-lifecycle.service';
import { RequirementProfileService } from '../datapoints/requirement-profile.service';
import { OCR_PROVIDER, type OcrProvider } from './ocr/ocr.provider';
import {
  INTELLIGENCE_PROVIDER,
  type IntelligenceProvider,
} from '../intelligence/intelligence.provider';

@Injectable()
export class DocumentProcessorService {
  private readonly extractor = new DriverLicenseExtractor();
  constructor(
    private readonly prisma: PrismaService,
    private readonly datapoints: DatapointsService,
    @Inject(DOCUMENT_STORAGE_PROVIDER)
    private readonly storage: DocumentStorageProvider,
    @Inject(OCR_PROVIDER) private readonly ocr: OcrProvider,
    private readonly entities: EntityLifecycleService,
    @Optional()
    @Inject(INTELLIGENCE_PROVIDER)
    private readonly intelligence?: IntelligenceProvider,
    @Optional()
    private readonly profiles?: RequirementProfileService,
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
      const buffer = await this.storage.read(document.storageKey);
      const ocr = await this.ocr.recognize({
        buffer,
        mimeType: document.mimeType,
      });
      const candidates =
        document.documentType === DocumentType.DRIVER_LICENSE
          ? await this.driverLicenseCandidates(document, ocr)
          : await this.policyDocumentCandidates(document, ocr);
      if (!candidates.length) throw new Error('EXTRACTION_NO_FIELDS');
      let accepted = 0;
      let rejected = 0;
      for (const candidate of candidates) {
        try {
          const scoped = await this.scopedCandidate(document, candidate);
          const result = await this.datapoints.upsertCandidate(
            document.leadId,
            {
              key: scoped.key,
              value: scoped.value,
              entityType: scoped.entityType,
              entityId: scoped.entityId,
              sourceType:
                document.collectionMode === 'FULL_DOCUMENT'
                  ? SourceType.FULL_DOCUMENT
                  : SourceType.TARGETED_DOCUMENT_CAPTURE,
              collectionMethod:
                document.collectionMode === 'FULL_DOCUMENT'
                  ? CollectionMethod.EXTRACTED
                  : CollectionMethod.TARGETED_CAPTURE,
              sourceReferenceId: document.id,
              confidence: scoped.confidence,
              metadata: {
                documentId: document.id,
                documentType: document.documentType,
                ...(scoped.evidence ? { evidence: scoped.evidence } : {}),
                ...(scoped.page ? { page: scoped.page } : {}),
                confidence: scoped.confidence,
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

  private async driverLicenseCandidates(
    document: { leadId: string; entityId: string | null },
    ocr: Parameters<DriverLicenseExtractor['extract']>[0],
  ) {
    if (!document.entityId) throw new Error('MISSING_DRIVER_ENTITY');
    const driverEntityId = document.entityId;
    await this.entities.assertOwnedEntityType(
      document.leadId,
      driverEntityId,
      EntityType.DRIVER,
    );
    return this.extractor.extract(ocr).map((candidate) => ({
      ...candidate,
      method: 'EXTRACTED' as const,
      entityType: EntityType.DRIVER,
      entityId: driverEntityId,
    }));
  }

  private async policyDocumentCandidates(
    document: { leadId: string; documentType: DocumentType },
    ocr: {
      textBlocks: Array<{ text: string; confidence: number; page?: number }>;
    },
  ) {
    if (document.documentType !== DocumentType.CURRENT_AUTO_POLICY)
      throw new Error('UNSUPPORTED_DOCUMENT_TYPE');
    if (!this.intelligence || !this.profiles)
      throw new Error('DOCUMENT_INTELLIGENCE_UNAVAILABLE');
    const product =
      (await this.profiles.selectedForLead(document.leadId)) ?? Product.AUTO;
    const [definitions, values, entityIds] = await Promise.all([
      this.profiles.forProduct(product),
      this.datapoints.values(document.leadId),
      this.entities.ensurePrimaryEntitiesForProduct(document.leadId, product),
    ]);
    const rulesFor = (definition: (typeof definitions)[number]) =>
      definition.validationRules as {
        allowedValues?: unknown[];
        labels?: Record<string, string>;
      } | null;
    const input: IntelligenceInput = {
      message: [
        'Synthetic OCR text from a current auto policy document.',
        ...ocr.textBlocks.map((block) => block.text),
      ].join('\n'),
      currentProduct: product,
      entityContext: {
        vehicleId: entityIds.VEHICLE,
        driverId: entityIds.DRIVER,
        propertyId: entityIds.PROPERTY,
      },
      knownDatapoints: values.map((value) => ({
        key: value.definition.key,
        value: value.value,
        entityType: value.entityType,
        ...(value.entityId ? { entityId: value.entityId } : {}),
      })),
      catalog: definitions.map((definition) => {
        const rules = rulesFor(definition);
        return {
          key: definition.key,
          label: definition.label,
          dataType: definition.dataType,
          entityType: definition.entityType,
          ...(rules?.allowedValues
            ? { allowedValues: rules.allowedValues }
            : {}),
          ...(rules?.labels ? { labels: rules.labels } : {}),
        };
      }),
    };
    try {
      const result = await this.intelligence.analyze(input);
      return result.candidateDatapoints.map((candidate) => ({
        ...candidate,
        entityId: this.entityIdFor(candidate.entityType, entityIds),
      }));
    } catch (error) {
      if (error instanceof ServiceUnavailableException)
        throw new Error('DOCUMENT_INTELLIGENCE_UNAVAILABLE');
      throw error;
    }
  }

  private async scopedCandidate(
    document: { leadId: string },
    candidate: IntelligenceCandidateDatapoint & {
      entityId?: string;
      page?: number;
    },
  ) {
    const ownedEntityTypes: EntityType[] = [
      EntityType.VEHICLE,
      EntityType.DRIVER,
      EntityType.PROPERTY,
      EntityType.CLAIM,
      EntityType.CO_APPLICANT,
    ];
    if (ownedEntityTypes.includes(candidate.entityType) && candidate.entityId) {
      await this.entities.assertOwnedEntityType(
        document.leadId,
        candidate.entityId,
        candidate.entityType,
      );
    }
    return candidate;
  }

  private entityIdFor(
    entityType: string,
    entityIds: Partial<Record<EntityType, string>>,
  ) {
    if (entityType === EntityType.VEHICLE) return entityIds.VEHICLE;
    if (entityType === EntityType.DRIVER) return entityIds.DRIVER;
    if (entityType === EntityType.PROPERTY) return entityIds.PROPERTY;
    return undefined;
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
      'DOCUMENT_INTELLIGENCE_UNAVAILABLE',
    ]);
    return known.has(error.message)
      ? error.message
      : 'PROCESSING_INTERNAL_ERROR';
  }
}
