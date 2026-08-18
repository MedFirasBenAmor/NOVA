import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionActionType,
  CollectionAttemptStatus,
  DataType,
  EntityDomain,
  EntityRole,
  EntityType,
  Product,
  SectionConfirmationStatus,
  type DatapointDefinition,
  type DatapointValue,
  type DossierEntity,
} from '@prisma/client';
import type {
  DatapointInputMetadata,
  NextAction,
  ProductDomain,
  ReviewSectionGroup,
  ReviewSectionItem,
} from '@nova/shared-types';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  RequirementProfileService,
  type SelectedProduct,
} from './requirement-profile.service';

export type ReviewSectionCode =
  | 'PERSONAL'
  | 'CONTACT_ADDRESS'
  | 'REQUEST_CONSENTS'
  | 'AUTO_CURRENT_INSURANCE'
  | 'AUTO_VEHICLE_IDENTIFICATION'
  | 'AUTO_ACQUISITION'
  | 'AUTO_USE_PROTECTION'
  | 'AUTO_DRIVER'
  | 'AUTO_CLAIMS'
  | 'HOME_CURRENT_INSURANCE'
  | 'HOME_PROPERTY_BASICS'
  | 'HOME_BUILDING_SYSTEMS'
  | 'HOME_SAFETY_LIFESTYLE'
  | 'HOME_CLAIMS'
  | 'HOME_CO_APPLICANT'
  | 'HOME_DECLARATIONS';

type SectionDefinition = {
  code: ReviewSectionCode;
  title: string;
  product: 'COMMON' | 'AUTO' | 'HOME';
  order: number;
};

type ReviewLead = {
  id: string;
  selectedProduct: Product | null;
  currentAutoInsured: boolean | null;
  currentHomeInsured: boolean | null;
  currentAutoPolicyAvailable: boolean | null;
  currentHomePolicyAvailable: boolean | null;
};

type ValueWithDefinition = DatapointValue & {
  definition: DatapointDefinition;
};

const sections: SectionDefinition[] = [
  { code: 'PERSONAL', title: 'Personal details', product: 'COMMON', order: 10 },
  {
    code: 'CONTACT_ADDRESS',
    title: 'Contact and address',
    product: 'COMMON',
    order: 20,
  },
  {
    code: 'REQUEST_CONSENTS',
    title: 'Request and consents',
    product: 'COMMON',
    order: 30,
  },
  {
    code: 'AUTO_CURRENT_INSURANCE',
    title: 'Current auto insurance',
    product: 'AUTO',
    order: 100,
  },
  {
    code: 'AUTO_VEHICLE_IDENTIFICATION',
    title: 'Vehicle identification',
    product: 'AUTO',
    order: 110,
  },
  {
    code: 'AUTO_ACQUISITION',
    title: 'Vehicle acquisition',
    product: 'AUTO',
    order: 120,
  },
  {
    code: 'AUTO_USE_PROTECTION',
    title: 'Vehicle use and protection',
    product: 'AUTO',
    order: 130,
  },
  { code: 'AUTO_DRIVER', title: 'Drivers', product: 'AUTO', order: 140 },
  { code: 'AUTO_CLAIMS', title: 'Auto claims', product: 'AUTO', order: 150 },
  {
    code: 'HOME_CURRENT_INSURANCE',
    title: 'Current home insurance',
    product: 'HOME',
    order: 200,
  },
  {
    code: 'HOME_PROPERTY_BASICS',
    title: 'Property basics',
    product: 'HOME',
    order: 210,
  },
  {
    code: 'HOME_BUILDING_SYSTEMS',
    title: 'Building and systems',
    product: 'HOME',
    order: 220,
  },
  {
    code: 'HOME_SAFETY_LIFESTYLE',
    title: 'Safety and lifestyle',
    product: 'HOME',
    order: 230,
  },
  { code: 'HOME_CLAIMS', title: 'Home claims', product: 'HOME', order: 240 },
  {
    code: 'HOME_CO_APPLICANT',
    title: 'Co-applicant',
    product: 'HOME',
    order: 250,
  },
  {
    code: 'HOME_DECLARATIONS',
    title: 'Home declarations',
    product: 'HOME',
    order: 260,
  },
];

const categorySection: Record<string, ReviewSectionCode> = {
  CUSTOMER: 'PERSONAL',
  CONTACT: 'CONTACT_ADDRESS',
  ADDRESS: 'CONTACT_ADDRESS',
  REQUEST: 'REQUEST_CONSENTS',
  CONSENT: 'REQUEST_CONSENTS',
  CURRENT_AUTO_INSURANCE: 'AUTO_CURRENT_INSURANCE',
  VEHICLE_IDENTIFICATION: 'AUTO_VEHICLE_IDENTIFICATION',
  VEHICLE_ACQUISITION: 'AUTO_ACQUISITION',
  VEHICLE_USE: 'AUTO_USE_PROTECTION',
  VEHICLE_SECURITY: 'AUTO_USE_PROTECTION',
  AUTO_COVERAGE: 'AUTO_USE_PROTECTION',
  SPECIAL_VEHICLE_RISK: 'AUTO_USE_PROTECTION',
  DRIVER: 'AUTO_DRIVER',
  ADDITIONAL_DRIVER: 'AUTO_DRIVER',
  AUTO_CLAIMS: 'AUTO_CLAIMS',
  PROPERTY_INSURANCE: 'HOME_CURRENT_INSURANCE',
  PROPERTY_ADDRESS: 'HOME_PROPERTY_BASICS',
  PROPERTY_OCCUPANCY: 'HOME_PROPERTY_BASICS',
  PROPERTY_VALUATION: 'HOME_PROPERTY_BASICS',
  PROPERTY_FINANCE: 'HOME_PROPERTY_BASICS',
  PROPERTY_BUILDING: 'HOME_BUILDING_SYSTEMS',
  PROPERTY_SYSTEMS: 'HOME_BUILDING_SYSTEMS',
  PROPERTY_WATER: 'HOME_BUILDING_SYSTEMS',
  PROPERTY_PROTECTION: 'HOME_SAFETY_LIFESTYLE',
  PROPERTY_EXTERIOR: 'HOME_SAFETY_LIFESTYLE',
  PROPERTY_RISK: 'HOME_SAFETY_LIFESTYLE',
  PROPERTY_CONTENTS: 'HOME_SAFETY_LIFESTYLE',
  PROPERTY_CLAIMS: 'HOME_CLAIMS',
  CO_APPLICANT: 'HOME_CO_APPLICANT',
};

const booleanLabels = new Map([
  [true, 'Yes'],
  [false, 'No'],
]);

@Injectable()
export class SectionReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: RequirementProfileService,
  ) {}

  sectionDefinitions() {
    return [...sections].sort((left, right) => left.order - right.order);
  }

  sectionForDefinition(definition: Pick<DatapointDefinition, 'category'>) {
    const section = categorySection[definition.category];
    if (!section)
      throw new Error(`No review section for category ${definition.category}`);
    return section;
  }

  sectionsForProduct(product: SelectedProduct) {
    const products =
      product === Product.AUTO
        ? new Set(['COMMON', 'AUTO'])
        : product === Product.HOME
          ? new Set(['COMMON', 'HOME'])
          : new Set(['COMMON', 'AUTO', 'HOME']);
    return this.sectionDefinitions().filter((section) =>
      products.has(section.product),
    );
  }

  async assignmentAudit() {
    const definitions = await this.prisma.datapointDefinition.findMany({
      where: {
        active: true,
        product: { in: [Product.COMMON, Product.AUTO, Product.HOME] },
      },
      orderBy: [{ product: 'asc' }, { key: 'asc' }],
    });
    const assignments = definitions.map((definition) => ({
      key: definition.key,
      sectionCode: this.sectionForDefinition(definition),
    }));
    return {
      assignedExactlyOnce: assignments.length,
      unassigned: [],
      duplicateAssignments: [],
      assignments,
    };
  }

  async nextReviewAction(
    leadId: string,
    product: SelectedProduct,
  ): Promise<NextAction | undefined> {
    for (const section of this.sectionsForProduct(product)) {
      const review = await this.buildReviewSection(
        leadId,
        product,
        section.code,
      );
      if (review.status !== SectionConfirmationStatus.CONFIRMED) {
        const existing = await this.prisma.collectionAttempt.findFirst({
          where: {
            leadId,
            actionType: CollectionActionType.REVIEW_SECTION,
            status: CollectionAttemptStatus.PROPOSED,
            metadata: {
              path: ['confirmationId'],
              equals: review.confirmationId,
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        const action =
          existing ??
          (await this.prisma.collectionAttempt.create({
            data: {
              leadId,
              actionType: CollectionActionType.REVIEW_SECTION,
              product,
              metadata: {
                confirmationId: review.confirmationId,
                sectionCode: review.sectionCode,
                snapshotHash: review.snapshotHash,
              },
            },
          }));
        return {
          type: 'REVIEW_SECTION',
          actionId: action.id,
          confirmationId: review.confirmationId,
          sectionCode: review.sectionCode,
          title: review.title,
          snapshotHash: review.snapshotHash,
          groups: review.groups,
        };
      }
    }
    return undefined;
  }

  async confirm(
    leadId: string,
    actionId: string,
    value: unknown,
    _message?: string,
  ) {
    void _message;
    const attempt = await this.prisma.collectionAttempt.findFirst({
      where: {
        id: actionId,
        leadId,
        actionType: CollectionActionType.REVIEW_SECTION,
      },
    });
    if (!attempt) throw new NotFoundException('Review action not found');
    const metadata = (attempt.metadata ?? {}) as {
      confirmationId?: string;
      sectionCode?: ReviewSectionCode;
      snapshotHash?: string;
    };
    if (!metadata.confirmationId || !metadata.sectionCode)
      throw new BadRequestException('Review action is incomplete');
    const rawHash =
      typeof value === 'object' && value !== null && 'snapshotHash' in value
        ? (value as { snapshotHash?: unknown }).snapshotHash
        : value;
    const suppliedHash = typeof rawHash === 'string' ? rawHash : '';
    if (!suppliedHash) throw new BadRequestException('snapshotHash required');
    if (attempt.status !== CollectionAttemptStatus.PROPOSED) {
      return;
    }

    const product = attempt.product as SelectedProduct;
    const current = await this.buildReviewSection(
      leadId,
      product,
      metadata.sectionCode,
    );
    if (
      current.confirmationId !== metadata.confirmationId ||
      current.snapshotHash !== suppliedHash ||
      metadata.snapshotHash !== suppliedHash
    ) {
      throw new ConflictException('Review snapshot is stale');
    }
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.sectionConfirmation.findFirst({
        where: {
          id: metadata.confirmationId,
          customerFolder: { leadId },
        },
      });
      if (!existing)
        throw new NotFoundException('Section confirmation not found');
      if (
        existing.status === SectionConfirmationStatus.CONFIRMED &&
        existing.snapshotHash === suppliedHash
      ) {
        return;
      }
      await tx.sectionConfirmation.update({
        where: { id: existing.id },
        data: {
          status: SectionConfirmationStatus.CONFIRMED,
          confirmedAt: new Date(),
          snapshotHash: suppliedHash,
        },
      });
      await tx.collectionAttempt.update({
        where: { id: actionId },
        data: {
          status: CollectionAttemptStatus.COMPLETED,
          resolvedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          action: 'SECTION_CONFIRMED',
          entityType: 'SectionConfirmation',
          entityId: existing.id,
        },
      });
    });
  }

  async buildReviewSection(
    leadId: string,
    product: SelectedProduct,
    sectionCode: ReviewSectionCode,
  ) {
    const lead = await this.lead(leadId);
    if (lead.selectedProduct !== product)
      throw new BadRequestException('Product does not match selected product');
    const section = this.sectionsForProduct(product).find(
      (candidate) => candidate.code === sectionCode,
    );
    if (!section) throw new BadRequestException('Section is not applicable');
    const folder = await this.folderForLead(leadId);
    const [definitions, values, entities] = await Promise.all([
      this.profiles.forProduct(product),
      this.prisma.datapointValue.findMany({
        where: { customerFolderId: folder.id },
        include: { definition: true },
      }),
      this.prisma.dossierEntity.findMany({
        where: { customerFolderId: folder.id },
        orderBy: [
          { entityType: 'asc' },
          { role: 'asc' },
          { domain: 'asc' },
          { ordinal: 'asc' },
        ],
      }),
    ]);
    const definitionIds = new Set(
      definitions
        .filter(
          (definition) => this.sectionForDefinition(definition) === sectionCode,
        )
        .map((definition) => definition.id),
    );
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const items: ReviewSectionItem[] = [
      ...this.intakeItems(lead, sectionCode),
      ...values
        .filter(
          (value) =>
            definitionIds.has(value.definitionId) && value.value !== null,
        )
        .sort((left, right) => this.sortValue(left, right, entityById))
        .map((value) =>
          this.valueItem(value, entityById.get(value.entityId ?? '')),
        ),
    ];
    const groups = this.groups(items);
    const snapshotHash = this.snapshotHash(items, entityById);
    const confirmation = await this.ensureConfirmation(
      folder.id,
      product,
      sectionCode,
      snapshotHash,
    );
    return {
      confirmationId: confirmation.id,
      sectionCode,
      title: section.title,
      status: confirmation.status,
      snapshotHash,
      groups,
    };
  }

  private async ensureConfirmation(
    customerFolderId: string,
    product: SelectedProduct,
    sectionCode: ReviewSectionCode,
    snapshotHash: string,
  ) {
    const existing = await this.prisma.sectionConfirmation.findUnique({
      where: {
        customerFolderId_product_sectionCode: {
          customerFolderId,
          product,
          sectionCode,
        },
      },
    });
    if (!existing) {
      return this.prisma.sectionConfirmation.create({
        data: {
          customerFolderId,
          product,
          sectionCode,
          status: SectionConfirmationStatus.READY_FOR_REVIEW,
          snapshotHash,
        },
      });
    }
    if (
      existing.status === SectionConfirmationStatus.CONFIRMED &&
      existing.snapshotHash === snapshotHash
    ) {
      return existing;
    }
    const status =
      existing.status === SectionConfirmationStatus.CONFIRMED
        ? SectionConfirmationStatus.NEEDS_RECONFIRMATION
        : SectionConfirmationStatus.READY_FOR_REVIEW;
    if (existing.status === status && existing.snapshotHash === snapshotHash)
      return existing;
    return this.prisma.sectionConfirmation.update({
      where: { id: existing.id },
      data: { status, snapshotHash },
    });
  }

  private intakeItems(
    lead: ReviewLead,
    sectionCode: ReviewSectionCode,
  ): ReviewSectionItem[] {
    if (sectionCode === 'AUTO_CURRENT_INSURANCE') {
      return this.domainIntakeItems(
        'AUTO',
        lead.currentAutoInsured,
        lead.currentAutoPolicyAvailable,
      );
    }
    if (sectionCode === 'HOME_CURRENT_INSURANCE') {
      return this.domainIntakeItems(
        'HOME',
        lead.currentHomeInsured,
        lead.currentHomePolicyAvailable,
      );
    }
    return [];
  }

  private domainIntakeItems(
    domain: ProductDomain,
    insured: boolean | null,
    policyAvailable: boolean | null,
  ) {
    const prefix = domain.toLowerCase();
    const label = domain === 'AUTO' ? 'auto' : 'home';
    const items: ReviewSectionItem[] = [];
    if (insured !== null) {
      items.push({
        kind: 'INTAKE_FACT',
        key: `${prefix}.current_insured`,
        label: `Currently insured for ${label}`,
        value: insured,
        displayValue: this.displayValue(insured),
        editable: false,
      });
    }
    if (policyAvailable !== null) {
      items.push({
        kind: 'INTAKE_FACT',
        key: `${prefix}.current_policy_available`,
        label: `Current ${label} policy available`,
        value: policyAvailable,
        displayValue: this.displayValue(policyAvailable),
        editable: false,
      });
    }
    return items;
  }

  private valueItem(
    value: ValueWithDefinition,
    entity: DossierEntity | undefined,
  ): ReviewSectionItem {
    return {
      kind: 'DATAPOINT',
      key: value.definition.key,
      label: value.definition.label,
      value: value.value,
      displayValue: this.displayValue(value.value),
      entityType: value.entityType,
      ...(value.entityId ? { entityId: value.entityId } : {}),
      ...(entity ? { entityLabel: this.entityLabel(entity) } : {}),
      editable: true,
      ui: this.ui(value.definition),
    };
  }

  private groups(items: ReviewSectionItem[]): ReviewSectionGroup[] {
    const grouped = new Map<string, ReviewSectionItem[]>();
    for (const item of items) {
      const label = item.entityLabel ?? 'General';
      grouped.set(label, [...(grouped.get(label) ?? []), item]);
    }
    return [...grouped.entries()].map(([label, groupItems]) => ({
      label,
      items: groupItems,
    }));
  }

  private snapshotHash(
    items: ReviewSectionItem[],
    entityById: Map<string, DossierEntity>,
  ) {
    const visible = items
      .map((item) => {
        const entity = item.entityId
          ? entityById.get(item.entityId)
          : undefined;
        return {
          kind: item.kind,
          key: item.key,
          value: item.value,
          entityType: entity?.entityType ?? item.entityType ?? null,
          domain: entity?.domain ?? null,
          role: entity?.role ?? null,
          ordinal: entity?.ordinal ?? null,
        };
      })
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
      );
    return createHash('sha256').update(JSON.stringify(visible)).digest('hex');
  }

  private entityLabel(entity: DossierEntity) {
    if (entity.entityType === EntityType.VEHICLE) return 'Vehicle';
    if (entity.entityType === EntityType.PROPERTY) return 'Property';
    if (entity.entityType === EntityType.CO_APPLICANT) return 'Co-applicant';
    if (entity.entityType === EntityType.CLAIM) {
      const domain = entity.domain === EntityDomain.HOME ? 'Home' : 'Auto';
      return `${domain} claim ${entity.ordinal}`;
    }
    if (entity.entityType === EntityType.DRIVER) {
      if (entity.role === EntityRole.PRIMARY) return 'Primary driver';
      return `Additional driver ${Math.max(1, entity.ordinal - 1)}`;
    }
    return 'General';
  }

  private sortValue(
    left: ValueWithDefinition,
    right: ValueWithDefinition,
    entityById: Map<string, DossierEntity>,
  ) {
    const leftEntity = left.entityId
      ? entityById.get(left.entityId)
      : undefined;
    const rightEntity = right.entityId
      ? entityById.get(right.entityId)
      : undefined;
    return (
      this.entityOrder(leftEntity) - this.entityOrder(rightEntity) ||
      (leftEntity?.ordinal ?? 0) - (rightEntity?.ordinal ?? 0) ||
      left.definition.key.localeCompare(right.definition.key)
    );
  }

  private entityOrder(entity: DossierEntity | undefined) {
    if (!entity) return 0;
    if (entity.entityType === EntityType.VEHICLE) return 10;
    if (
      entity.entityType === EntityType.DRIVER &&
      entity.role === EntityRole.PRIMARY
    )
      return 20;
    if (entity.entityType === EntityType.DRIVER) return 30;
    if (entity.entityType === EntityType.PROPERTY) return 40;
    if (
      entity.entityType === EntityType.CLAIM &&
      entity.domain === EntityDomain.AUTO
    )
      return 50;
    if (entity.entityType === EntityType.CLAIM) return 60;
    if (entity.entityType === EntityType.CO_APPLICANT) return 70;
    return 80;
  }

  private ui(definition: DatapointDefinition): DatapointInputMetadata {
    if (definition.dataType === DataType.ENUM)
      return {
        inputType: 'SINGLE_CHOICE',
        options:
          (definition.validationRules as { allowedValues?: unknown[] } | null)
            ?.allowedValues ?? [],
      };
    if (definition.dataType === DataType.BOOLEAN)
      return { inputType: 'YES_NO' };
    if (definition.dataType === DataType.NUMBER) return { inputType: 'NUMBER' };
    if (definition.dataType === DataType.DATE) return { inputType: 'DATE' };
    return { inputType: 'TEXT' };
  }

  private displayValue(value: unknown) {
    if (typeof value === 'boolean')
      return booleanLabels.get(value) ?? String(value);
    if (value === null || value === undefined) return '';
    const text =
      typeof value === 'object'
        ? JSON.stringify(value)
        : typeof value === 'string'
          ? value
          : typeof value === 'number'
            ? String(value)
            : '';
    return text
      .replaceAll('.', ' ')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  }

  private async folderForLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException(`Lead not found: ${leadId}`);
    return this.prisma.customerFolder.upsert({
      where: { leadId },
      update: {},
      create: { leadId },
    });
  }

  private async lead(leadId: string): Promise<ReviewLead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        selectedProduct: true,
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
