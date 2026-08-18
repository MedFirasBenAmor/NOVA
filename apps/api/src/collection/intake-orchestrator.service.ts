import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionActionType,
  CollectionAttemptStatus,
  IntakePhase,
  Product,
  type Lead,
} from '@prisma/client';
import type { NextAction, ProductDomain } from '@nova/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { DatapointsService } from '../datapoints/datapoints.service';
import {
  RequirementProfileService,
  type SelectedProduct,
} from '../datapoints/requirement-profile.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CollectionStrategyService } from './collection-strategy.service';

type IntakeLead = Pick<
  Lead,
  | 'id'
  | 'selectedProduct'
  | 'intakePhase'
  | 'currentAutoInsured'
  | 'currentHomeInsured'
  | 'currentAutoPolicyAvailable'
  | 'currentHomePolicyAvailable'
>;

type ExpectedIntakeAction = {
  actionType: Extract<
    CollectionActionType,
    'ASK_CURRENT_INSURANCE' | 'ASK_POLICY_DOCUMENT'
  >;
  domain: ProductDomain;
  phase: Extract<IntakePhase, 'CURRENT_INSURANCE' | 'CURRENT_POLICY_DOCUMENT'>;
};

const intakeActionTypes = new Set<CollectionActionType>([
  CollectionActionType.ASK_CURRENT_INSURANCE,
  CollectionActionType.ASK_POLICY_DOCUMENT,
]);

@Injectable()
export class IntakeOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datapoints: DatapointsService,
    private readonly profiles: RequirementProfileService,
    private readonly conversations: ConversationsService,
    private readonly strategy: CollectionStrategyService,
  ) {}

  productSelectionAction(): NextAction {
    return this.strategy.productSelectionAction();
  }

  async selectProduct(leadId: string, product: SelectedProduct) {
    const lead = await this.lead(leadId);
    if (lead.selectedProduct && lead.selectedProduct !== product) {
      throw new BadRequestException('Product is already selected');
    }
    await this.prisma.lead.update({
      where: { id: leadId },
      data: { selectedProduct: product },
    });
    return {
      selectedProduct: product,
      profile: await this.profiles.forProduct(product),
      nextAction: await this.currentAction(leadId),
    };
  }

  async currentAction(leadId: string): Promise<NextAction> {
    const lead = await this.lead(leadId);
    if (!lead.selectedProduct) {
      await this.ensurePhase(lead, IntakePhase.PRODUCT_SELECTION);
      return this.productSelectionAction();
    }
    const expected = this.expectedIntakeAction(lead);
    if (expected) {
      await this.ensurePhase(lead, expected.phase);
      return this.ensureAttempt(leadId, lead.selectedProduct, expected);
    }

    if (lead.intakePhase !== IntakePhase.CORE_DATA_COLLECTION) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { intakePhase: IntakePhase.CORE_DATA_COLLECTION },
      });
    }
    const nextAction = await this.strategy.selectForLead(leadId);
    if (nextAction.type === 'COMPLETE') {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { intakePhase: IntakePhase.COMPLETE },
      });
      return { type: 'COMPLETE', actionId: nextAction.actionId };
    }
    return nextAction;
  }

  async answerIntake(
    leadId: string,
    actionId: string,
    value: unknown,
    message?: string,
  ) {
    if (typeof value !== 'boolean')
      throw new BadRequestException('Intake answer must be true or false');
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: { id: actionId, leadId },
    });
    if (!attempt || !intakeActionTypes.has(attempt.actionType))
      throw new NotFoundException('Intake action not found');

    const lead = await this.lead(leadId);
    const expected = this.expectedIntakeAction(lead);
    const metadata = (attempt.metadata ?? {}) as {
      productDomain?: ProductDomain;
    };
    if (attempt.status !== CollectionAttemptStatus.PROPOSED) {
      if (
        this.isDuplicateResolvedAnswer(
          lead,
          attempt.actionType,
          metadata,
          value,
        )
      ) {
        return {
          completeness: lead.selectedProduct
            ? await this.datapoints.completeness(
                leadId,
                lead.selectedProduct as SelectedProduct,
              )
            : undefined,
          nextAction: await this.currentAction(leadId),
        };
      }
      throw new BadRequestException('Intake action is no longer current');
    }
    if (
      !expected ||
      expected.actionType !== attempt.actionType ||
      expected.domain !== metadata.productDomain
    ) {
      throw new BadRequestException('Intake action is stale');
    }
    if (message) await this.conversations.addCustomerMessage(leadId, message);

    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: this.answerData(expected, value),
      });
      await tx.collectionAttempt.update({
        where: { id: actionId },
        data: {
          status: CollectionAttemptStatus.COMPLETED,
          resolvedAt: new Date(),
          metadata: {
            ...metadata,
            answer: value,
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          action: 'INTAKE_ACTION_COMPLETED',
          entityType: 'CollectionAttempt',
          entityId: actionId,
        },
      });
    });

    const nextAction = await this.currentAction(leadId);
    const selectedProduct = (await this.profiles.selectedForLead(leadId))!;
    return {
      completeness: await this.datapoints.completeness(leadId, selectedProduct),
      nextAction,
    };
  }

  async isIntakeAction(leadId: string, actionId: string) {
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: { id: actionId, leadId },
      select: { actionType: true },
    });
    return Boolean(attempt && intakeActionTypes.has(attempt.actionType));
  }

  async selectCore(leadId: string): Promise<NextAction> {
    return this.currentAction(leadId);
  }

  private expectedIntakeAction(
    lead: IntakeLead,
  ): ExpectedIntakeAction | undefined {
    const product = lead.selectedProduct;
    if (!product || !this.profiles.isSelectable(product)) return undefined;

    if (this.requiresDomain(product, 'AUTO')) {
      if (lead.currentAutoInsured === null)
        return {
          actionType: CollectionActionType.ASK_CURRENT_INSURANCE,
          domain: 'AUTO',
          phase: IntakePhase.CURRENT_INSURANCE,
        };
      if (
        lead.currentAutoInsured === true &&
        lead.currentAutoPolicyAvailable === null
      )
        return {
          actionType: CollectionActionType.ASK_POLICY_DOCUMENT,
          domain: 'AUTO',
          phase: IntakePhase.CURRENT_POLICY_DOCUMENT,
        };
    }

    if (this.requiresDomain(product, 'HOME')) {
      if (lead.currentHomeInsured === null)
        return {
          actionType: CollectionActionType.ASK_CURRENT_INSURANCE,
          domain: 'HOME',
          phase: IntakePhase.CURRENT_INSURANCE,
        };
      if (
        lead.currentHomeInsured === true &&
        lead.currentHomePolicyAvailable === null
      )
        return {
          actionType: CollectionActionType.ASK_POLICY_DOCUMENT,
          domain: 'HOME',
          phase: IntakePhase.CURRENT_POLICY_DOCUMENT,
        };
    }

    return undefined;
  }

  private requiresDomain(product: Product, domain: ProductDomain) {
    return (
      product === Product.AUTO_HOME ||
      (domain === 'AUTO' && product === Product.AUTO) ||
      (domain === 'HOME' && product === Product.HOME)
    );
  }

  private async ensureAttempt(
    leadId: string,
    product: Product,
    expected: ExpectedIntakeAction,
  ): Promise<NextAction> {
    const attempts = await this.prisma.collectionAttempt.findMany({
      where: {
        leadId,
        actionType: expected.actionType,
        status: CollectionAttemptStatus.PROPOSED,
      },
      orderBy: { createdAt: 'desc' },
    });
    const existing = attempts.find(
      (attempt) =>
        ((attempt.metadata ?? {}) as { productDomain?: string })
          .productDomain === expected.domain,
    );
    const actionId =
      existing?.id ??
      (
        await this.prisma.collectionAttempt.create({
          data: {
            leadId,
            actionType: expected.actionType,
            product,
            metadata: { productDomain: expected.domain },
          },
        })
      ).id;
    return this.actionPayload(actionId, expected);
  }

  private actionPayload(
    actionId: string,
    expected: ExpectedIntakeAction,
  ): NextAction {
    if (expected.actionType === CollectionActionType.ASK_CURRENT_INSURANCE) {
      return {
        type: 'ASK_CURRENT_INSURANCE',
        actionId,
        productDomain: expected.domain,
        question:
          expected.domain === 'AUTO'
            ? 'Do you currently have auto insurance?'
            : 'Do you currently have home insurance?',
        input: { type: 'YES_NO' },
      };
    }
    return {
      type: 'ASK_POLICY_DOCUMENT',
      actionId,
      productDomain: expected.domain,
      question:
        expected.domain === 'AUTO'
          ? 'Do you have your current auto insurance policy available?'
          : 'Do you have your current home insurance policy available?',
      input: { type: 'YES_NO' },
    };
  }

  private answerData(expected: ExpectedIntakeAction, value: boolean) {
    if (expected.actionType === CollectionActionType.ASK_CURRENT_INSURANCE) {
      if (expected.domain === 'AUTO') return { currentAutoInsured: value };
      return { currentHomeInsured: value };
    }
    if (expected.domain === 'AUTO')
      return { currentAutoPolicyAvailable: value };
    return { currentHomePolicyAvailable: value };
  }

  private isDuplicateResolvedAnswer(
    lead: IntakeLead,
    actionType: CollectionActionType,
    metadata: { productDomain?: ProductDomain },
    value: boolean,
  ) {
    if (!metadata.productDomain) return false;
    if (actionType === CollectionActionType.ASK_CURRENT_INSURANCE) {
      return metadata.productDomain === 'AUTO'
        ? lead.currentAutoInsured === value
        : lead.currentHomeInsured === value;
    }
    if (actionType === CollectionActionType.ASK_POLICY_DOCUMENT) {
      return metadata.productDomain === 'AUTO'
        ? lead.currentAutoPolicyAvailable === value
        : lead.currentHomePolicyAvailable === value;
    }
    return false;
  }

  private async ensurePhase(lead: IntakeLead, phase: IntakePhase) {
    if (lead.intakePhase === phase) return;
    if (lead.intakePhase === IntakePhase.COMPLETE) return;
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { intakePhase: phase },
    });
  }

  private async lead(leadId: string): Promise<IntakeLead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        selectedProduct: true,
        intakePhase: true,
        currentAutoInsured: true,
        currentHomeInsured: true,
        currentAutoPolicyAvailable: true,
        currentHomePolicyAvailable: true,
      },
    });
    if (!lead) throw new NotFoundException(`Lead not found: ${leadId}`);
    return lead;
  }
}
