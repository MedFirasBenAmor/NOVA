import { readFileSync } from 'node:fs';
import {
  DataType,
  EntityType,
  Product,
  SectionConfirmationStatus,
} from '@prisma/client';
import { SectionReviewService } from './section-review.service';

const leadId = '00000000-0000-4000-8000-000000000001';
const folderId = '00000000-0000-4000-8000-000000000002';
const confirmationId = '00000000-0000-4000-8000-000000000003';
const vehicleId = '00000000-0000-4000-8000-000000000004';

const definition = {
  id: '00000000-0000-4000-8000-000000000005',
  key: 'vehicle.make',
  label: 'Vehicle make',
  category: 'VEHICLE_IDENTIFICATION',
  product: Product.AUTO,
  entityType: EntityType.VEHICLE,
  dataType: DataType.STRING,
  validationRules: null,
};

function seedCategories() {
  const source = readFileSync('prisma/seed.ts', 'utf8');
  return [...source.matchAll(/category: '([^']+)'/g)].map(([, category]) => ({
    category,
  }));
}

function setup(options: { existingHash?: string; value?: unknown } = {}) {
  const updates: unknown[] = [];
  const prisma = {
    datapointDefinition: {
      findMany: jest.fn().mockResolvedValue(seedCategories()),
    },
    lead: {
      findUnique: jest.fn().mockResolvedValue({
        id: leadId,
        selectedProduct: Product.AUTO,
        currentAutoInsured: true,
        currentHomeInsured: null,
        currentAutoPolicyAvailable: false,
        currentHomePolicyAvailable: null,
      }),
    },
    customerFolder: {
      upsert: jest.fn().mockResolvedValue({ id: folderId }),
    },
    datapointValue: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'value-1',
          definitionId: definition.id,
          definition,
          entityType: EntityType.VEHICLE,
          entityId: vehicleId,
          value: options.value ?? 'Toyota',
        },
      ]),
    },
    dossierEntity: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: vehicleId,
          entityType: EntityType.VEHICLE,
          role: 'PRIMARY',
          domain: 'NONE',
          ordinal: 1,
        },
      ]),
    },
    sectionConfirmation: {
      findUnique: jest.fn().mockResolvedValue(
        options.existingHash
          ? {
              id: confirmationId,
              status: SectionConfirmationStatus.CONFIRMED,
              snapshotHash: options.existingHash,
            }
          : null,
      ),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: confirmationId,
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) => {
        updates.push(data);
        return Promise.resolve({
          id: confirmationId,
          ...data,
        });
      }),
    },
    collectionAttempt: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: '00000000-0000-4000-8000-000000000006',
          ...data,
        }),
      ),
    },
  };
  const service = new SectionReviewService(
    prisma as never,
    {
      forProduct: jest.fn().mockResolvedValue([definition]),
    } as never,
  );
  return { service, prisma, updates };
}

describe('SectionReviewService', () => {
  it('assigns every current catalog definition category exactly once', async () => {
    const { service } = setup();
    const audit = await service.assignmentAudit();
    expect(audit.assignedExactlyOnce).toBe(139);
    expect(audit.unassigned).toHaveLength(0);
    expect(audit.duplicateAssignments).toHaveLength(0);
  });

  it('returns REVIEW_SECTION before COMPLETE when data is complete but unconfirmed', async () => {
    const { service, prisma } = setup();
    const action = await service.nextReviewAction(leadId, Product.AUTO);
    expect(action).toMatchObject({
      type: 'REVIEW_SECTION',
      sectionCode: 'PERSONAL',
    });
    expect(prisma.collectionAttempt.create).toHaveBeenCalled();
  });

  it('keeps a confirmed section when the visible snapshot is unchanged', async () => {
    const baseline = setup();
    const first = await baseline.service.buildReviewSection(
      leadId,
      Product.AUTO,
      'AUTO_VEHICLE_IDENTIFICATION',
    );
    const { service, updates } = setup({ existingHash: first.snapshotHash });
    const second = await service.buildReviewSection(
      leadId,
      Product.AUTO,
      'AUTO_VEHICLE_IDENTIFICATION',
    );
    expect(second.status).toBe(SectionConfirmationStatus.CONFIRMED);
    expect(updates).toHaveLength(0);
  });

  it('requires reconfirmation when the visible value changes', async () => {
    const baseline = setup();
    const first = await baseline.service.buildReviewSection(
      leadId,
      Product.AUTO,
      'AUTO_VEHICLE_IDENTIFICATION',
    );
    const { service, updates } = setup({
      existingHash: first.snapshotHash,
      value: 'Honda',
    });
    const changed = await service.buildReviewSection(
      leadId,
      Product.AUTO,
      'AUTO_VEHICLE_IDENTIFICATION',
    );
    expect(changed.status).toBe(SectionConfirmationStatus.NEEDS_RECONFIRMATION);
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: SectionConfirmationStatus.NEEDS_RECONFIRMATION,
      }),
    );
  });
});
