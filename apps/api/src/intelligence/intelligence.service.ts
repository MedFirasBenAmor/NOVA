import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionMethod,
  DatapointStatus,
  EntityType,
  Product,
  SourceType,
  type DatapointDefinition,
} from '@prisma/client';
import type {
  IntelligenceCandidateDatapoint,
  IntelligenceEventType,
  IntelligenceExtractionMethod,
  IntelligenceInput,
  IntelligenceIntentType,
  IntelligenceResult,
} from '@nova/shared-types';
import { randomUUID } from 'node:crypto';
import { isUUID } from 'class-validator';
import { DatapointsService } from '../datapoints/datapoints.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { ConversationsService } from '../conversations/conversations.service';
import { CollectionStrategyService } from '../collection/collection-strategy.service';
import {
  RequirementProfileService,
  type SelectedProduct,
} from '../datapoints/requirement-profile.service';
import {
  INTELLIGENCE_PROVIDER,
  type IntelligenceProvider,
} from './intelligence.provider';

const intents = new Set<IntelligenceIntentType>([
  'INSURANCE_SHOPPING',
  'NEW_ACQUISITION',
  'RENEWAL',
  'COMMERCIAL_VEHICLE_USE',
  'CLAIM_MENTIONED',
  'DOCUMENT_REFUSAL',
  'GENERAL_INQUIRY',
]);
const events = new Set<IntelligenceEventType>([
  'VEHICLE_PURCHASE',
  'COMMERCIAL_USE',
  'RENEWAL_MENTIONED',
  'CLAIM_MENTIONED',
  'DOCUMENT_UPLOAD_REFUSED',
]);
const methods = new Set<IntelligenceExtractionMethod>([
  'EXTRACTED',
  'ENRICHED',
  'INFERRED',
]);
const usableStatuses = new Set<DatapointStatus>([
  DatapointStatus.CANDIDATE,
  DatapointStatus.EXTRACTED,
  DatapointStatus.INFERRED,
  DatapointStatus.ENRICHED,
  DatapointStatus.CONFIRMED,
  DatapointStatus.VALIDATED,
]);

@Injectable()
export class IntelligenceService {
  constructor(
    @Inject(INTELLIGENCE_PROVIDER)
    private readonly provider: IntelligenceProvider,
    private readonly prisma: PrismaService,
    private readonly datapoints: DatapointsService,
    private readonly conversations: ConversationsService,
    private readonly strategy: CollectionStrategyService,
    private readonly profiles: RequirementProfileService,
  ) {}

  async analyze(leadId: string, dto: CreateInteractionDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException(`Lead not found: ${leadId}`);
    await this.conversations.addCustomerMessage(leadId, dto.message);

    const values = await this.datapoints.values(leadId);
    const currentProduct = await this.profiles.selectedForLead(leadId);
    const definitions = currentProduct
      ? await this.profiles.forProduct(currentProduct)
      : await this.profiles.forProduct(Product.AUTO_HOME);
    const knownDatapoints = values
      .filter(
        (value) => value.value !== null && usableStatuses.has(value.status),
      )
      .map((value) => ({
        key: value.definition.key,
        value: value.value,
        entityType: value.entityType,
        ...(value.entityId ? { entityId: value.entityId } : {}),
      }));
    const input: IntelligenceInput = {
      message: dto.message,
      ...(currentProduct ? { currentProduct } : {}),
      ...(dto.entityContext ? { entityContext: dto.entityContext } : {}),
      knownDatapoints,
      catalog: definitions.map((definition) => {
        const rules = definition.validationRules as {
          allowedValues?: unknown[];
        } | null;
        return {
          key: definition.key,
          label: definition.label,
          dataType: definition.dataType,
          entityType: definition.entityType,
          ...(rules?.allowedValues
            ? { allowedValues: rules.allowedValues }
            : {}),
        };
      }),
    };
    const rawResult = await this.provider.analyze(input);
    this.validateResult(rawResult);

    const interactionId = randomUUID();
    const definitionByKey = new Map(
      definitions.map((definition) => [definition.key, definition]),
    );
    const scopeIds = {
      VEHICLE:
        dto.entityContext?.vehicleId ??
        values.find((value) => value.entityType === EntityType.VEHICLE)
          ?.entityId ??
        randomUUID(),
      DRIVER:
        dto.entityContext?.driverId ??
        values.find((value) => value.entityType === EntityType.DRIVER)
          ?.entityId ??
        randomUUID(),
      CLAIM:
        dto.entityContext?.claimId ??
        values.find((value) => value.entityType === EntityType.CLAIM)
          ?.entityId ??
        randomUUID(),
    };
    const validCandidates: IntelligenceCandidateDatapoint[] = [];
    const rejections: Array<{ key: string; reason: string }> = [];
    const conflicts: Array<{ key: string; entityId?: string }> = [];
    let acceptedCandidateDatapoints = 0;
    let newDatapointsAdded = 0;

    for (const rawCandidate of rawResult.candidateDatapoints) {
      const definition = definitionByKey.get(rawCandidate.key);
      if (!definition) {
        rejections.push({ key: rawCandidate.key, reason: 'UNKNOWN_KEY' });
        continue;
      }
      const candidate = this.withScope(rawCandidate, definition, scopeIds);
      try {
        this.validateCandidate(candidate, definition);
      } catch (error) {
        rejections.push({
          key: candidate.key,
          reason:
            error instanceof BadRequestException
              ? String(error.message)
              : 'INVALID_CANDIDATE',
        });
        continue;
      }

      const existing = values.find(
        (value) =>
          value.definition.key === candidate.key &&
          value.entityId === (candidate.entityId ?? null),
      );
      if (
        existing &&
        JSON.stringify(existing.value) === JSON.stringify(candidate.value)
      ) {
        rejections.push({ key: candidate.key, reason: 'ALREADY_KNOWN' });
        continue;
      }

      const persisted = await this.datapoints.upsertCandidate(leadId, {
        key: candidate.key,
        value: candidate.value,
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        sourceType: this.sourceType(candidate.method),
        collectionMethod: this.collectionMethod(candidate.method),
        sourceReferenceId: interactionId,
        confidence: candidate.confidence,
        metadata: candidate.evidence
          ? { evidence: candidate.evidence }
          : undefined,
      });
      validCandidates.push(candidate);
      if (persisted.accepted) {
        acceptedCandidateDatapoints += 1;
        if (!existing) newDatapointsAdded += 1;
        await this.prisma.auditEvent.create({
          data: {
            action: 'INTELLIGENCE_CANDIDATE_ACCEPTED',
            entityType: 'DatapointValue',
            entityId: persisted.value.id,
          },
        });
      } else {
        rejections.push({ key: candidate.key, reason: 'CONFLICT' });
        conflicts.push({
          key: candidate.key,
          ...(candidate.entityId ? { entityId: candidate.entityId } : {}),
        });
      }
    }

    if (rejections.length) {
      await this.prisma.auditEvent.createMany({
        data: rejections.map(() => ({
          action: 'INTELLIGENCE_CANDIDATE_REJECTED',
          entityType: 'Lead',
          entityId: leadId,
        })),
      });
    }
    await this.prisma.auditEvent.create({
      data: {
        action: 'INTELLIGENCE_ANALYSIS_COMPLETED',
        entityType: 'Lead',
        entityId: leadId,
      },
    });
    const product = currentProduct ?? this.safeProviderProduct(rawResult);
    const completeness = product
      ? await this.datapoints.completeness(leadId, product)
      : {
          product: rawResult.product.type,
          completeness: 0,
          known: [],
          missing: [],
          conditionalRequired: [],
        };
    const nextAction = product
      ? await this.strategy.select(leadId, product, completeness)
      : this.strategy.productSelectionAction();

    return {
      intelligence: {
        ...rawResult,
        candidateDatapoints: validCandidates,
      },
      metrics: {
        candidateDatapointsDetected: rawResult.candidateDatapoints.length,
        acceptedCandidateDatapoints,
        rejectedCandidateDatapoints: rejections.length,
        newDatapointsAdded,
        questionsPotentiallyAvoided: newDatapointsAdded,
        manualQuestionsAsked:
          nextAction.type === 'ASK_DATAPOINT' ||
          nextAction.type === 'ASK_GROUPED_DATAPOINTS'
            ? 1
            : 0,
        documentSuggestionsMade:
          nextAction.type === 'SUGGEST_FULL_DOCUMENT' ? 1 : 0,
        targetedCaptureSuggestionsMade:
          nextAction.type === 'SUGGEST_TARGETED_CAPTURE' ? 1 : 0,
        datapointsPotentiallyCoveredBySuggestedSource:
          'coveredMissingDatapoints' in nextAction
            ? nextAction.coveredMissingDatapoints.length
            : 0,
      },
      rejections,
      conflicts,
      completeness,
      nextAction,
    };
  }

  private safeProviderProduct(
    result: IntelligenceResult,
  ): SelectedProduct | undefined {
    if (result.product.confidence < 0.98) return undefined;
    const product = result.product.type;
    return this.profiles.isSelectable(product) ? product : undefined;
  }

  private validateResult(result: IntelligenceResult) {
    if (
      !result ||
      !result.intent ||
      !intents.has(result.intent.type) ||
      !this.validConfidence(result.intent.confidence) ||
      !result.product ||
      !Object.values(Product).includes(result.product.type) ||
      !this.validConfidence(result.product.confidence) ||
      !Array.isArray(result.events) ||
      !Array.isArray(result.candidateDatapoints) ||
      result.events.some(
        (event) =>
          !events.has(event.type) || !this.validConfidence(event.confidence),
      ) ||
      result.candidateDatapoints.some(
        (candidate) =>
          !candidate ||
          typeof candidate.key !== 'string' ||
          !Object.values(EntityType).includes(candidate.entityType) ||
          candidate.value === undefined ||
          !methods.has(candidate.method) ||
          !this.validConfidence(candidate.confidence),
      )
    ) {
      throw new BadGatewayException('Invalid structured intelligence result');
    }
  }

  private validateCandidate(
    candidate: IntelligenceCandidateDatapoint,
    definition: DatapointDefinition,
  ) {
    if (candidate.entityType !== definition.entityType) {
      throw new BadRequestException('INVALID_ENTITY_TYPE');
    }
    if (candidate.entityId && !isUUID(candidate.entityId)) {
      throw new BadRequestException('INVALID_ENTITY_ID');
    }
    this.datapoints.validateInput(definition, {
      key: candidate.key,
      value: candidate.value,
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      sourceType: this.sourceType(candidate.method),
      collectionMethod: this.collectionMethod(candidate.method),
      confidence: candidate.confidence,
    });
  }

  private withScope(
    candidate: IntelligenceCandidateDatapoint,
    definition: DatapointDefinition,
    scopeIds: Record<'VEHICLE' | 'DRIVER' | 'CLAIM', string>,
  ): IntelligenceCandidateDatapoint {
    if (
      definition.entityType === EntityType.VEHICLE ||
      definition.entityType === EntityType.DRIVER ||
      definition.entityType === EntityType.CLAIM
    ) {
      return {
        ...candidate,
        entityType: definition.entityType,
        entityId: candidate.entityId ?? scopeIds[definition.entityType],
      };
    }
    return {
      ...candidate,
      entityType: definition.entityType,
      entityId: undefined,
    };
  }

  private sourceType(method: IntelligenceExtractionMethod) {
    if (method === 'ENRICHED') return SourceType.ENRICHED;
    if (method === 'INFERRED') return SourceType.DERIVED;
    return SourceType.CUSTOMER_CHAT;
  }

  private collectionMethod(method: IntelligenceExtractionMethod) {
    if (method === 'ENRICHED') return CollectionMethod.ENRICHED;
    if (method === 'INFERRED') return CollectionMethod.DERIVED;
    return CollectionMethod.EXTRACTED;
  }

  private validConfidence(value: number) {
    return typeof value === 'number' && value >= 0 && value <= 1;
  }
}
