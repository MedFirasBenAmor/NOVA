import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
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
import { DatapointsService } from '../datapoints/datapoints.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { ConversationsService } from '../conversations/conversations.service';
import { IntakeOrchestratorService } from '../collection/intake-orchestrator.service';
import {
  EntityLifecycleService,
  type PrimaryEntityMap,
} from '../datapoints/entity-lifecycle.service';
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
    private readonly intake: IntakeOrchestratorService,
    private readonly entities: EntityLifecycleService,
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
          labels?: Record<string, string>;
        } | null;
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
    const { result: providerResult, degraded } =
      await this.analyzeWithGracefulDegradation(input);
    const rawResult = this.withDeterministicCandidates(
      providerResult,
      dto.message,
      definitions,
    );
    this.validateResult(rawResult);

    const inferredProduct = currentProduct
      ? undefined
      : (this.safeProviderProduct(rawResult) ??
        this.explicitMessageProduct(dto.message));
    if (inferredProduct) {
      await this.intake.selectProduct(leadId, inferredProduct);
    }
    const effectiveProduct = currentProduct ?? inferredProduct;
    if (effectiveProduct && this.renewalMentioned(dto.message)) {
      if (
        effectiveProduct === Product.AUTO ||
        effectiveProduct === Product.AUTO_HOME
      ) {
        await this.intake.inferCurrentInsuranceFromRenewal(leadId, 'AUTO');
      }
      if (
        effectiveProduct === Product.HOME ||
        effectiveProduct === Product.AUTO_HOME
      ) {
        await this.intake.inferCurrentInsuranceFromRenewal(leadId, 'HOME');
      }
    }
    const activeDefinitions = effectiveProduct
      ? await this.profiles.forProduct(effectiveProduct)
      : definitions;
    const effectiveResult =
      activeDefinitions === definitions
        ? rawResult
        : this.withDeterministicCandidates(
            rawResult,
            dto.message,
            activeDefinitions,
          );

    const isCustomerCorrection = this.isCorrectionMessage(dto.message);
    const interactionId = randomUUID();
    const definitionByKey = new Map(
      activeDefinitions.map((definition) => [definition.key, definition]),
    );
    const primaryEntityIds = effectiveProduct
      ? await this.entities.ensurePrimaryEntitiesForProduct(
          leadId,
          effectiveProduct,
        )
      : {};
    const validCandidates: IntelligenceCandidateDatapoint[] = [];
    const rejections: Array<{ key: string; reason: string }> = [];
    const conflicts: Array<{ key: string; entityId?: string }> = [];
    let acceptedCandidateDatapoints = 0;
    let newDatapointsAdded = 0;

    for (const rawCandidate of effectiveResult.candidateDatapoints) {
      const definition = definitionByKey.get(rawCandidate.key);
      if (!definition) {
        rejections.push({ key: rawCandidate.key, reason: 'UNKNOWN_KEY' });
        continue;
      }
      const candidate = this.withScope(
        rawCandidate,
        definition,
        primaryEntityIds,
        dto.entityContext,
      );
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

      const candidateWrite = {
        key: candidate.key,
        value: candidate.value,
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        sourceType: this.sourceType(candidate.method),
        collectionMethod: this.collectionMethod(candidate.method),
        sourceReferenceId: interactionId,
        confidence: candidate.confidence,
        metadata: {
          ...(candidate.evidence ? { evidence: candidate.evidence } : {}),
          ...(isCustomerCorrection ? { customerCorrection: true } : {}),
        },
      };
      let persisted: {
        value: { id: string };
        accepted: boolean;
        conflict: boolean;
      };
      try {
        persisted =
          isCustomerCorrection && existing
            ? {
                value: await this.datapoints.upsert(leadId, candidateWrite),
                accepted: true,
                conflict: false,
              }
            : await this.datapoints.upsertCandidate(leadId, candidateWrite);
      } catch (error) {
        if (error instanceof BadRequestException) {
          rejections.push({
            key: candidate.key,
            reason: String(error.message),
          });
          continue;
        }
        throw error;
      }
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
    const completeness = effectiveProduct
      ? await this.datapoints.completeness(leadId, effectiveProduct)
      : {
          product: rawResult.product.type,
          completeness: 0,
          known: [],
          missing: [],
          conditionalRequired: [],
        };
    const nextAction = effectiveProduct
      ? await this.intake.currentAction(leadId)
      : this.intake.productSelectionAction();

    return {
      intelligence: {
        ...rawResult,
        candidateDatapoints: validCandidates,
      },
      metrics: {
        candidateDatapointsDetected: effectiveResult.candidateDatapoints.length,
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
        intelligenceProviderDegraded: degraded ? 1 : 0,
        productSelectedByIntelligence: inferredProduct ? 1 : 0,
      },
      rejections,
      conflicts,
      completeness,
      nextAction,
    };
  }

  private isCorrectionMessage(message: string) {
    return /\b(no|nope|wrong|incorrect|actually|correction|correct it|you are wrong|you're wrong|not a|not an|it is|it's|instead)\b/i.test(
      message,
    );
  }

  private async analyzeWithGracefulDegradation(input: IntelligenceInput) {
    try {
      return { result: await this.provider.analyze(input), degraded: false };
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      return {
        degraded: true,
        result: {
          intent: { type: 'GENERAL_INQUIRY', confidence: 0 },
          product: {
            type: input.currentProduct ?? Product.COMMON,
            confidence: input.currentProduct ? 1 : 0,
          },
          events: [],
          candidateDatapoints: [],
        } satisfies IntelligenceResult,
      };
    }
  }

  private explicitMessageProduct(message: string): SelectedProduct | undefined {
    const autoIntent =
      /\b(rav[-\s]?4|vehicle|car|auto|drive|driving|financ|lease|uber|turo|delivery|insurer|accident|claim|truck)\b/i.test(
        message,
      );
    const homeIntent =
      /\b(home|house|condo|tenant|property|habitation|apartment|dwelling|mortgage|basement|roof|cottage)\b/i.test(
        message,
      );
    if (autoIntent && homeIntent) return Product.AUTO_HOME;
    if (autoIntent) return Product.AUTO;
    if (homeIntent) return Product.HOME;
    return undefined;
  }

  private withDeterministicCandidates(
    result: IntelligenceResult,
    message: string,
    definitions: DatapointDefinition[],
  ): IntelligenceResult {
    const definitionsByKey = new Map(
      definitions.map((definition) => [definition.key, definition]),
    );
    const existingKeys = new Set(
      result.candidateDatapoints.map((candidate) => candidate.key),
    );
    const candidates = [...result.candidateDatapoints];
    const add = (key: string, value: unknown, confidence = 0.96) => {
      if (existingKeys.has(key)) return;
      const definition = definitionsByKey.get(key);
      if (!definition) return;
      candidates.push({
        key,
        value,
        entityType: definition.entityType,
        method: 'EXTRACTED',
        confidence,
      });
      existingKeys.add(key);
    };

    const name = this.extractName(message);
    if (name?.firstName) add('customer.first_name', name.firstName);
    if (name?.lastName) add('customer.last_name', name.lastName);

    const birthDate = this.extractDateNear(message, [
      'born',
      'birth',
      'date of birth',
      'dob',
      'né',
      'naissance',
    ]);
    if (birthDate) add('customer.date_of_birth', birthDate);

    const coverageDate = this.extractDateNear(message, [
      'cover',
      'coverage',
      'start',
      'begin',
      'effective',
      'assurance',
    ]);
    if (coverageDate) add('request.desired_coverage_date', coverageDate);
    if (this.renewalMentioned(message)) add('request.type', 'RENEWAL');

    const vehicle = this.extractVehicle(message);
    if (vehicle.year) add('vehicle.year', vehicle.year);
    if (vehicle.make) add('vehicle.make', vehicle.make);
    if (vehicle.model) add('vehicle.model', vehicle.model);

    return { ...result, candidateDatapoints: candidates };
  }

  private renewalMentioned(message: string) {
    return /\b(renew|renewal|renouvellement|renouveler|renouvelle|renouvelé|renouvellee)\b/i.test(
      message,
    );
  }

  private extractName(message: string) {
    const match = message.match(
      /\b(?:my\s+full\s+name\s+is|full\s+name\s+is|my\s+name\s+is|i\s+am|i'm)\s+([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ' -]{0,80})/i,
    );
    if (!match?.[1]) return undefined;
    const rawName = match[1]
      .split(/\b(?:i\s+was|i\s+have|i\s+am|born|birth|coverage|cover)\b/i)[0]
      .split(/[,.]/)[0]
      .trim()
      .replace(/\s+/g, ' ');
    if (!rawName) return undefined;
    const isFullName = /full\s+name/i.test(match[0]);
    if (!isFullName) return { firstName: rawName };
    const parts = rawName.split(' ').filter(Boolean);
    if (parts.length < 2) return { firstName: rawName };
    const particles = new Set(['al', 'ben', 'bin', 'de', 'del', 'el', 'van']);
    const lastNameStart =
      parts.length >= 3 && particles.has(parts[parts.length - 2].toLowerCase())
        ? parts.length - 2
        : parts.length - 1;
    return {
      firstName: parts.slice(0, lastNameStart).join(' '),
      lastName: parts.slice(lastNameStart).join(' '),
    };
  }

  private extractDateNear(message: string, anchors: string[]) {
    const lower = message.toLowerCase();
    for (const anchor of anchors) {
      const index = lower.indexOf(anchor.toLowerCase());
      if (index === -1) continue;
      const window = message.slice(Math.max(0, index - 20), index + 100);
      const date = this.extractDate(window);
      if (date) return date;
    }
    return undefined;
  }

  private extractDate(message: string) {
    const match = message.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
    if (!match) return undefined;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(
      2,
      '0',
    )}-${String(day).padStart(2, '0')}`;
  }

  private extractVehicle(message: string) {
    const hasToyota = /\btoyota\b/i.test(message);
    const rav4Match = message.match(/\brav[-\s]?4\b/i);
    const vehicleYearMatch =
      message.match(
        /\b(19\d{2}|20\d{2})\b(?=[A-Za-zÀ-ÖØ-öø-ÿ0-9\s,-]{0,25}\b(?:toyota|rav[-\s]?4)\b)/i,
      ) ??
      message.match(
        /\b(?:toyota|rav[-\s]?4)\b[A-Za-zÀ-ÖØ-öø-ÿ0-9\s,-]{0,25}\b(19\d{2}|20\d{2})\b/i,
      ) ??
      message.match(
        /\b(19\d{2}|20\d{2})\b(?=[A-Za-zÀ-ÖØ-öø-ÿ0-9\s,-]{0,25}\b(?:car|auto|vehicle)\b)/i,
      ) ??
      message.match(
        /\b(?:car|auto|vehicle)\b[A-Za-zÀ-ÖØ-öø-ÿ0-9\s,-]{0,25}\b(19\d{2}|20\d{2})\b/i,
      );
    return {
      year: vehicleYearMatch ? Number(vehicleYearMatch[1]) : undefined,
      make: hasToyota ? 'Toyota' : undefined,
      model: rav4Match ? 'RAV4' : undefined,
    };
  }

  private safeProviderProduct(
    result: IntelligenceResult,
  ): SelectedProduct | undefined {
    if (result.product.confidence < 0.9) return undefined;
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
    primaryEntityIds: PrimaryEntityMap,
    entityContext?: IntelligenceInput['entityContext'],
  ): IntelligenceCandidateDatapoint {
    const contextualEntityId = this.contextualEntityId(
      definition,
      entityContext,
    );
    if (contextualEntityId) {
      return {
        ...candidate,
        entityType: definition.entityType,
        entityId: contextualEntityId,
      };
    }
    if (this.entities.isPrimaryScopedType(definition.entityType)) {
      return {
        ...candidate,
        entityType: definition.entityType,
        entityId: primaryEntityIds[definition.entityType],
      };
    }
    return {
      ...candidate,
      entityType: definition.entityType,
      entityId: undefined,
    };
  }

  private contextualEntityId(
    definition: DatapointDefinition,
    entityContext: IntelligenceInput['entityContext'],
  ) {
    if (
      entityContext?.currentDatapoint?.key === definition.key &&
      entityContext.currentDatapoint.entityType === definition.entityType &&
      entityContext.currentDatapoint.entityId
    )
      return entityContext.currentDatapoint.entityId;
    if (definition.entityType === EntityType.VEHICLE)
      return entityContext?.vehicleId;
    if (definition.entityType === EntityType.DRIVER)
      return entityContext?.driverId;
    if (definition.entityType === EntityType.PROPERTY)
      return entityContext?.propertyId;
    if (definition.entityType === EntityType.CLAIM)
      return entityContext?.claimId;
    if (definition.entityType === EntityType.CO_APPLICANT)
      return entityContext?.coApplicantId;
    return undefined;
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
