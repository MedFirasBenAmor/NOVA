import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CollectionActionType,
  CollectionAttemptStatus,
  EntityDomain,
  EntityType,
  IntakePhase,
  type CollectionLoop,
} from '@prisma/client';
import type { CompletenessResponse, NextAction } from '@nova/shared-types';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DatapointsService } from '../datapoints/datapoints.service';
import {
  RequirementProfileService,
  type SelectedProduct,
} from '../datapoints/requirement-profile.service';
import { ConversationsService } from '../conversations/conversations.service';
import {
  COLLECTION_CAPABILITIES,
  actionTypeFor,
} from './collection-capabilities';
import { EntityLifecycleService } from '../datapoints/entity-lifecycle.service';
import { SectionReviewService } from '../datapoints/section-review.service';
import { buildInputContract } from '../datapoints/input-contract';

@Injectable()
export class CollectionStrategyService {
  productSelectionAction(): NextAction {
    return {
      type: 'SELECT_PRODUCT',
      actionId: 'select-product',
      options: [
        { value: 'AUTO', label: 'Auto' },
        { value: 'HOME', label: 'Home' },
        { value: 'AUTO_HOME', label: 'Auto + Home' },
      ],
    };
  }

  async selectForLead(leadId: string): Promise<NextAction> {
    const product = await this.profiles.selectedForLead(leadId);
    if (!product) return this.productSelectionAction();
    const completeness = await this.datapoints.completeness(leadId, product);
    return this.select(leadId, product, completeness);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly datapoints: DatapointsService,
    private readonly conversations: ConversationsService,
    private readonly profiles: RequirementProfileService,
    private readonly entities: EntityLifecycleService,
    private readonly reviews?: SectionReviewService,
  ) {}

  async select(
    leadId: string,
    product: SelectedProduct,
    completeness: CompletenessResponse,
  ): Promise<NextAction> {
    const [definitions, attempts, documents] = await Promise.all([
      this.profiles.forProduct(product),
      this.prisma.collectionAttempt.findMany({
        where: { leadId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.findMany({
        where: { leadId, status: { in: ['UPLOADED', 'PROCESSING'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    ]);
    if (documents[0]) {
      return {
        type: 'WAIT_FOR_PROCESSING',
        documentId: documents[0].id,
        documentType: documents[0].documentType,
        status:
          documents[0].status === 'PROCESSING' ? 'PROCESSING' : 'UPLOADED',
      };
    }
    const loopAction = await this.loopAction(leadId, product, completeness);
    if (loopAction) return loopAction;
    if (!completeness.missing.length) {
      const reviewAction = await this.reviews?.nextReviewAction(
        leadId,
        product,
      );
      if (reviewAction) return reviewAction;
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { intakePhase: IntakePhase.COMPLETE },
      });
      return { type: 'COMPLETE', actionId: randomUUID() };
    }
    const resolved = new Map(
      attempts
        .filter(
          (a) =>
            a.status !== CollectionAttemptStatus.PROPOSED && a.capabilityId,
        )
        .map((a) => [a.capabilityId as string, a.status]),
    );
    const capability = COLLECTION_CAPABILITIES.filter(
      (cap) =>
        !resolved.has(cap.id) &&
        (cap.type === 'FULL_DOCUMENT' ||
          resolved.get(cap.id.replace('_TARGETED', '_FULL')) ===
            CollectionAttemptStatus.DECLINED ||
          resolved.get(cap.id.replace('_TARGETED', '_FULL')) ===
            CollectionAttemptStatus.SKIPPED),
    )
      .map((cap) => ({
        cap,
        covered: completeness.missing.filter(
          (m) =>
            m.entityType === cap.entityType &&
            cap.providesDatapoints.includes(m.key),
        ),
      }))
      .filter(({ covered }) => covered.length >= 2)
      .sort((a, b) => a.cap.priority - b.cap.priority)[0];
    const accepted = attempts.find(
      (attempt) =>
        attempt.status === CollectionAttemptStatus.ACCEPTED &&
        attempt.capabilityId,
    );
    if (accepted) {
      const cap = COLLECTION_CAPABILITIES.find(
        (candidate) => candidate.id === accepted.capabilityId,
      );
      const covered = cap
        ? completeness.missing.filter(
            (item) =>
              item.entityType === cap.entityType &&
              cap.providesDatapoints.includes(item.key),
          )
        : [];
      if (cap && covered.length) {
        return {
          type:
            cap.type === 'FULL_DOCUMENT'
              ? 'SUGGEST_FULL_DOCUMENT'
              : 'SUGGEST_TARGETED_CAPTURE',
          actionId: accepted.id,
          documentType: cap.documentType,
          entityType: cap.entityType,
          ...(accepted.entityId ? { entityId: accepted.entityId } : {}),
          coveredMissingDatapoints: covered.map((item) => item.key),
          questionsPotentiallyAvoided: covered.length,
          required: false,
          accepted: true,
        };
      }
    }
    if (capability) {
      const { cap, covered } = capability;
      const actionType = actionTypeFor(cap);
      const existing = attempts.find(
        (a) =>
          a.status === CollectionAttemptStatus.PROPOSED &&
          a.capabilityId === cap.id,
      );
      const actionId =
        existing?.id ??
        (
          await this.prisma.collectionAttempt.create({
            data: {
              leadId,
              actionType,
              capabilityId: cap.id,
              documentType: cap.documentType,
              entityType: cap.entityType,
              entityId: covered[0]?.entityId,
              product,
              metadata: { coveredMissingDatapoints: covered.map((m) => m.key) },
            },
          })
        ).id;
      if (!existing) await this.audit('COLLECTION_ACTION_PROPOSED', leadId);
      await this.audit('NEXT_ACTION_SELECTED', leadId);
      return {
        type:
          actionType === CollectionActionType.SUGGEST_FULL_DOCUMENT
            ? 'SUGGEST_FULL_DOCUMENT'
            : 'SUGGEST_TARGETED_CAPTURE',
        actionId,
        documentType: cap.documentType,
        entityType: cap.entityType,
        ...(covered[0]?.entityId ? { entityId: covered[0].entityId } : {}),
        coveredMissingDatapoints: covered.map((m) => m.key),
        questionsPotentiallyAvoided: covered.length,
        required: false,
      };
    }
    const lastDeclinedCapability = COLLECTION_CAPABILITIES.find(
      (cap) =>
        cap.id ===
        attempts.find(
          (attempt) =>
            attempt.status === CollectionAttemptStatus.DECLINED &&
            attempt.capabilityId,
        )?.capabilityId,
    );
    const item =
      completeness.missing.find((missing) =>
        lastDeclinedCapability?.providesDatapoints.includes(missing.key),
      ) ??
      completeness.missing.find(
        (missing) => missing.reason === 'CONDITIONAL',
      ) ??
      completeness.missing[0];
    const definition = definitions.find((d) => d.key === item.key);
    if (!definition)
      throw new NotFoundException(`Definition not found for ${item.key}`);
    const input = buildInputContract(definition);
    const attempt = await this.prisma.collectionAttempt.create({
      data: {
        leadId,
        actionType: CollectionActionType.ASK_DATAPOINT,
        entityType: item.entityType as EntityType,
        entityId: item.entityId,
        product,
        metadata: { key: item.key },
      },
    });
    const action = {
      type: 'ASK_DATAPOINT' as const,
      actionId: attempt.id,
      datapoint: {
        key: item.key,
        entityType: item.entityType as `${EntityType}`,
        ...(item.entityId ? { entityId: item.entityId } : {}),
        ...(definition?.label ? { label: definition.label } : {}),
        ...(definition?.description
          ? { description: definition.description }
          : {}),
      },
      input,
    };
    await this.audit('NEXT_ACTION_SELECTED', leadId);
    return action;
  }

  async respond(
    leadId: string,
    actionId: string,
    decision: 'ACCEPTED' | 'DECLINED' | 'SKIPPED',
  ) {
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: { id: actionId, leadId },
    });
    if (!attempt) throw new NotFoundException('Collection action not found');
    await this.prisma.collectionAttempt.update({
      where: { id: attempt.id },
      data: { status: decision, resolvedAt: new Date() },
    });
    await this.audit(`COLLECTION_ACTION_${decision}`, leadId);
    const product = attempt.product as SelectedProduct;
    const completeness = await this.datapoints.completeness(leadId, product);
    const nextAction = await this.select(leadId, product, completeness);
    return {
      nextAction,
      metrics: {
        fullDocumentDeclines:
          decision === 'DECLINED' &&
          attempt.actionType === CollectionActionType.SUGGEST_FULL_DOCUMENT
            ? 1
            : 0,
        targetedCaptureDeclines:
          decision === 'DECLINED' &&
          attempt.actionType === CollectionActionType.SUGGEST_TARGETED_CAPTURE
            ? 1
            : 0,
      },
    };
  }

  async answer(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
      },
    });
    if (!attempt) throw new NotFoundException('Collection action not found');
    if (attempt.actionType === CollectionActionType.ASK_ADD_ANOTHER_ENTITY) {
      return this.answerAddAnother(leadId, attempt.id, value, message);
    }
    if (attempt.actionType === CollectionActionType.REVIEW_SECTION) {
      await this.reviews?.confirm(leadId, attempt.id, value, message);
      return {
        nextAction: await this.selectForLead(leadId),
      };
    }
    if (attempt.actionType !== CollectionActionType.ASK_DATAPOINT) {
      throw new NotFoundException('Datapoint action not found');
    }
    const metadata = (attempt.metadata ?? {}) as { key?: string };
    if (!metadata.key || !attempt.entityType)
      throw new NotFoundException('Datapoint action is incomplete');
    if (message) await this.conversations.addCustomerMessage(leadId, message);
    const datapoint = await this.datapoints.upsert(leadId, {
      key: metadata.key,
      value,
      entityType: attempt.entityType,
      entityId: attempt.entityId ?? undefined,
      sourceType: 'CUSTOMER_FORM',
      collectionMethod: 'MANUAL_QUESTION',
      sourceReferenceId: actionId,
    });
    await this.prisma.collectionAttempt.update({
      where: { id: actionId },
      data: {
        status: CollectionAttemptStatus.COMPLETED,
        resolvedAt: new Date(),
      },
    });
    const completeness = await this.datapoints.completeness(
      leadId,
      attempt.product as SelectedProduct,
    );
    return {
      datapoint,
      completeness,
      nextAction: await this.select(
        leadId,
        attempt.product as SelectedProduct,
        completeness,
      ),
    };
  }

  private audit(action: string, leadId: string) {
    return this.prisma.auditEvent.create({
      data: { action, entityType: 'Lead', entityId: leadId },
    });
  }

  private async loopAction(
    leadId: string,
    product: SelectedProduct,
    completeness: CompletenessResponse,
  ): Promise<NextAction | undefined> {
    const loops = await this.entities.openLoopsForLead(leadId);
    for (const loop of loops) {
      const currentEntity = await this.currentLoopEntity(leadId, loop);
      if (!currentEntity) continue;
      const missing = completeness.missing.find(
        (item) => item.entityId === currentEntity.id,
      );
      if (missing) {
        return this.askDatapoint(leadId, product, missing);
      }
      return this.askAddAnother(leadId, product, loop);
    }
    return undefined;
  }

  private async currentLoopEntity(leadId: string, loop: CollectionLoop) {
    return this.prisma.dossierEntity.findFirst({
      where: {
        customerFolder: { leadId },
        entityType: loop.entityType,
        role: loop.role,
        domain: loop.domain,
        ordinal: loop.currentOrdinal,
      },
    });
  }

  private async askDatapoint(
    leadId: string,
    product: SelectedProduct,
    item: CompletenessResponse['missing'][number],
  ): Promise<NextAction> {
    const definitions = await this.profiles.forProduct(product);
    const definition = definitions.find((d) => d.key === item.key);
    if (!definition)
      throw new NotFoundException(`Definition not found for ${item.key}`);
    const input = buildInputContract(definition);
    const attempt = await this.prisma.collectionAttempt.create({
      data: {
        leadId,
        actionType: CollectionActionType.ASK_DATAPOINT,
        entityType: item.entityType as EntityType,
        entityId: item.entityId,
        product,
        metadata: { key: item.key },
      },
    });
    await this.audit('NEXT_ACTION_SELECTED', leadId);
    return {
      type: 'ASK_DATAPOINT',
      actionId: attempt.id,
      datapoint: {
        key: item.key,
        entityType: item.entityType as `${EntityType}`,
        ...(item.entityId ? { entityId: item.entityId } : {}),
        ...(definition?.label ? { label: definition.label } : {}),
        ...(definition?.description
          ? { description: definition.description }
          : {}),
      },
      input,
    };
  }

  private async askAddAnother(
    leadId: string,
    product: SelectedProduct,
    loop: CollectionLoop,
  ): Promise<NextAction> {
    const existing = await this.prisma.collectionAttempt.findFirst({
      where: {
        leadId,
        actionType: CollectionActionType.ASK_ADD_ANOTHER_ENTITY,
        status: CollectionAttemptStatus.PROPOSED,
        metadata: { path: ['loopId'], equals: loop.id },
      },
      orderBy: { createdAt: 'desc' },
    });
    const attempt =
      existing ??
      (await this.prisma.collectionAttempt.create({
        data: {
          leadId,
          actionType: CollectionActionType.ASK_ADD_ANOTHER_ENTITY,
          entityType: loop.entityType,
          product,
          metadata: {
            loopId: loop.id,
            entityType: loop.entityType,
            role: loop.role,
            domain: loop.domain,
            ordinal: loop.currentOrdinal,
          },
        },
      }));
    return {
      type: 'ASK_ADD_ANOTHER_ENTITY',
      actionId: attempt.id,
      entityType: loop.entityType,
      domain: loop.domain === EntityDomain.NONE ? undefined : loop.domain,
      loopId: loop.id,
      ordinal: loop.currentOrdinal,
      label: this.loopLabel(loop),
      question: this.loopQuestion(loop),
      input: { type: 'YES_NO' },
    };
  }

  private async answerAddAnother(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    if (typeof value !== 'boolean')
      throw new NotFoundException('Add-another answer must be true or false');
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
        actionType: CollectionActionType.ASK_ADD_ANOTHER_ENTITY,
      },
    });
    if (!attempt) throw new NotFoundException('Add-another action not found');
    const metadata = (attempt.metadata ?? {}) as {
      loopId?: string;
      answer?: boolean;
    };
    if (!metadata.loopId)
      throw new NotFoundException('Add-another action is incomplete');
    if (attempt.status !== CollectionAttemptStatus.PROPOSED) {
      return {
        nextAction: await this.selectForLead(leadId),
      };
    }
    if (message) await this.conversations.addCustomerMessage(leadId, message);
    if (value) {
      await this.entities.createNextLoopEntity(
        leadId,
        metadata.loopId,
        actionId,
      );
    } else {
      await this.entities.closeCollectionLoop(
        leadId,
        metadata.loopId,
        actionId,
      );
      await this.prisma.collectionAttempt.update({
        where: { id: actionId },
        data: {
          metadata: { ...metadata, answer: false },
        },
      });
    }
    await this.prisma.collectionAttempt.update({
      where: { id: actionId },
      data: {
        status: CollectionAttemptStatus.COMPLETED,
        resolvedAt: new Date(),
      },
    });
    return {
      nextAction: await this.selectForLead(leadId),
    };
  }

  private loopQuestion(loop: CollectionLoop) {
    if (loop.entityType === EntityType.DRIVER) {
      return 'Do you want to add another driver?';
    }
    return 'Do you want to add another claim?';
  }

  private loopLabel(loop: CollectionLoop) {
    if (loop.entityType === EntityType.DRIVER) {
      return `Additional driver ${Math.max(1, loop.currentOrdinal - 1)}`;
    }
    const domain =
      loop.domain === EntityDomain.AUTO
        ? 'Auto'
        : loop.domain === EntityDomain.HOME
          ? 'Home'
          : '';
    return `${domain} claim ${loop.currentOrdinal}`.trim();
  }
}
