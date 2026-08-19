import { BadRequestException } from '@nestjs/common';
import {
  CollectionActionType,
  CollectionAttemptStatus,
  IntakePhase,
  Product,
} from '@prisma/client';
import { IntakeOrchestratorService } from './intake-orchestrator.service';

const leadId = '00000000-0000-4000-8000-000000000001';

type TestAttempt = {
  id: string;
  leadId: string;
  actionType: CollectionActionType;
  product: Product;
  status: CollectionAttemptStatus;
  metadata: { productDomain?: 'AUTO' | 'HOME'; answer?: boolean };
  resolvedAt?: Date;
  createdAt: Date;
};

type FindAttemptsArgs = {
  where: {
    id?: string;
    leadId: string;
    actionType?: CollectionActionType;
    status?: CollectionAttemptStatus;
  };
};

type CreateAttemptArgs = {
  data: Omit<TestAttempt, 'id' | 'status' | 'createdAt'> &
    Partial<Pick<TestAttempt, 'status' | 'createdAt' | 'metadata'>>;
};

type UpdateAttemptArgs = {
  where: { id: string };
  data: Partial<TestAttempt>;
};

function setup(
  options: { coreAction?: object; selectedProduct?: Product } = {},
) {
  let attemptSeq = 1;
  const lead = {
    id: leadId,
    selectedProduct: options.selectedProduct ?? null,
    intakePhase: options.selectedProduct
      ? IntakePhase.CORE_DATA_COLLECTION
      : IntakePhase.PRODUCT_SELECTION,
    currentAutoInsured: null as boolean | null,
    currentHomeInsured: null as boolean | null,
    currentAutoPolicyAvailable: null as boolean | null,
    currentHomePolicyAvailable: null as boolean | null,
  };
  const attempts: TestAttempt[] = [];
  const prisma = {
    lead: {
      findUnique: jest.fn().mockResolvedValue(lead),
      update: jest.fn().mockImplementation(({ data }) => {
        Object.assign(lead, data);
        return Promise.resolve(lead);
      }),
    },
    collectionAttempt: {
      findMany: jest
        .fn()
        .mockImplementation(({ where }: FindAttemptsArgs) =>
          Promise.resolve(
            attempts
              .filter(
                (attempt) =>
                  attempt.leadId === where.leadId &&
                  (!where.actionType ||
                    attempt.actionType === where.actionType) &&
                  (!where.status || attempt.status === where.status),
              )
              .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          ),
        ),
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: FindAttemptsArgs) =>
          Promise.resolve(
            attempts.find(
              (attempt) =>
                attempt.id === where.id &&
                attempt.leadId === where.leadId &&
                (!where.actionType || attempt.actionType === where.actionType),
            ) ?? null,
          ),
        ),
      create: jest.fn().mockImplementation(({ data }: CreateAttemptArgs) => {
        const attempt: TestAttempt = {
          id: `00000000-0000-4000-8000-${String(attemptSeq++).padStart(12, '0')}`,
          status: CollectionAttemptStatus.PROPOSED,
          createdAt: new Date(attemptSeq),
          ...data,
          metadata: data.metadata ?? {},
        };
        attempts.push(attempt);
        return Promise.resolve(attempt);
      }),
      update: jest
        .fn()
        .mockImplementation(({ where, data }: UpdateAttemptArgs) => {
          const attempt = attempts.find((item) => item.id === where.id);
          if (attempt) Object.assign(attempt, data);
          return Promise.resolve(attempt);
        }),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest
      .fn()
      .mockImplementation((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
  };
  const profiles = {
    isSelectable: jest.fn(
      (product: Product) =>
        product === Product.AUTO ||
        product === Product.HOME ||
        product === Product.AUTO_HOME,
    ),
    forProduct: jest.fn().mockResolvedValue([]),
    selectedForLead: jest
      .fn()
      .mockImplementation(() => Promise.resolve(lead.selectedProduct)),
  };
  const datapoints = {
    completeness: jest.fn().mockResolvedValue({
      product: Product.AUTO,
      completeness: 0,
      known: [],
      missing: [{ key: 'customer.first_name', entityType: 'CUSTOMER' }],
      conditionalRequired: [],
    }),
  };
  const strategy = {
    productSelectionAction: jest.fn().mockReturnValue({
      type: 'SELECT_PRODUCT',
      actionId: 'select-product',
      options: [],
    }),
    selectForLead: jest.fn().mockResolvedValue(
      options.coreAction ?? {
        type: 'ASK_DATAPOINT',
        actionId: 'core-action',
        datapoint: { key: 'customer.first_name', entityType: 'CUSTOMER' },
        input: { type: 'TEXT' },
      },
    ),
  };
  const service = new IntakeOrchestratorService(
    prisma as never,
    datapoints as never,
    profiles as never,
    { addCustomerMessage: jest.fn().mockResolvedValue({}) } as never,
    strategy as never,
  );
  return { service, lead, attempts, strategy };
}

async function answer(
  service: IntakeOrchestratorService,
  action: object,
  value: boolean,
) {
  if (!('actionId' in action) || typeof action.actionId !== 'string')
    throw new Error('Expected actionId');
  return service.answerIntake(
    leadId,
    action.actionId,
    value,
    value ? 'Yes' : 'No',
  );
}

describe('IntakeOrchestratorService', () => {
  it('runs AUTO insured NO directly to core collection and never asks HOME', async () => {
    const { service, lead } = setup();
    const selected = await service.selectProduct(leadId, Product.AUTO);
    expect(selected.nextAction).toMatchObject({
      type: 'ASK_CURRENT_INSURANCE',
      productDomain: 'AUTO',
    });
    const next = await answer(service, selected.nextAction, false);
    expect(next.nextAction.type).toBe('ASK_DATAPOINT');
    expect(lead).toMatchObject({
      intakePhase: IntakePhase.CORE_DATA_COLLECTION,
      currentAutoInsured: false,
      currentHomeInsured: null,
    });
  });

  it('runs AUTO insured YES through AUTO policy before core collection', async () => {
    const { service, lead } = setup();
    const selected = await service.selectProduct(leadId, Product.AUTO);
    const policy = await answer(service, selected.nextAction, true);
    expect(policy.nextAction).toMatchObject({
      type: 'ASK_POLICY_DOCUMENT',
      productDomain: 'AUTO',
    });
    const next = await answer(service, policy.nextAction, false);
    expect(next.nextAction.type).toBe('ASK_DATAPOINT');
    expect(lead.currentAutoPolicyAvailable).toBe(false);
  });

  it('runs AUTO policy YES deterministically without a required document action', async () => {
    const { service, lead } = setup();
    const selected = await service.selectProduct(leadId, Product.AUTO);
    const policy = await answer(service, selected.nextAction, true);
    const next = await answer(service, policy.nextAction, true);
    expect(next.nextAction.type).toBe('ASK_DATAPOINT');
    expect(lead.currentAutoPolicyAvailable).toBe(true);
  });

  it('runs HOME insured NO directly to core collection and never asks AUTO', async () => {
    const { service, lead } = setup();
    const selected = await service.selectProduct(leadId, Product.HOME);
    expect(selected.nextAction).toMatchObject({
      type: 'ASK_CURRENT_INSURANCE',
      productDomain: 'HOME',
    });
    const next = await answer(service, selected.nextAction, false);
    expect(next.nextAction.type).toBe('ASK_DATAPOINT');
    expect(lead).toMatchObject({
      intakePhase: IntakePhase.CORE_DATA_COLLECTION,
      currentAutoInsured: null,
      currentHomeInsured: false,
    });
  });

  it('runs HOME policy YES to core collection because HOME policy automation is deferred', async () => {
    const { service, lead } = setup();
    const selected = await service.selectProduct(leadId, Product.HOME);
    const policy = await answer(service, selected.nextAction, true);
    expect(policy.nextAction).toMatchObject({
      type: 'ASK_POLICY_DOCUMENT',
      productDomain: 'HOME',
    });
    const next = await answer(service, policy.nextAction, true);
    expect(next.nextAction.type).toBe('ASK_DATAPOINT');
    expect(lead.currentHomePolicyAvailable).toBe(true);
  });

  it('AUTO_HOME case 1: Auto NO, Home NO, then core collection', async () => {
    const { service } = setup();
    const auto = await service.selectProduct(leadId, Product.AUTO_HOME);
    const home = await answer(service, auto.nextAction, false);
    expect(home.nextAction).toMatchObject({
      type: 'ASK_CURRENT_INSURANCE',
      productDomain: 'HOME',
    });
    const core = await answer(service, home.nextAction, false);
    expect(core.nextAction.type).toBe('ASK_DATAPOINT');
  });

  it('AUTO_HOME case 2: Auto YES, Auto policy NO, Home NO, then core', async () => {
    const { service } = setup();
    const auto = await service.selectProduct(leadId, Product.AUTO_HOME);
    const autoPolicy = await answer(service, auto.nextAction, true);
    expect(autoPolicy.nextAction).toMatchObject({
      type: 'ASK_POLICY_DOCUMENT',
      productDomain: 'AUTO',
    });
    const home = await answer(service, autoPolicy.nextAction, false);
    expect(home.nextAction).toMatchObject({
      type: 'ASK_CURRENT_INSURANCE',
      productDomain: 'HOME',
    });
    const core = await answer(service, home.nextAction, false);
    expect(core.nextAction.type).toBe('ASK_DATAPOINT');
  });

  it('AUTO_HOME case 3: Auto NO, Home YES, Home policy NO, then core', async () => {
    const { service } = setup();
    const auto = await service.selectProduct(leadId, Product.AUTO_HOME);
    const home = await answer(service, auto.nextAction, false);
    const homePolicy = await answer(service, home.nextAction, true);
    expect(homePolicy.nextAction).toMatchObject({
      type: 'ASK_POLICY_DOCUMENT',
      productDomain: 'HOME',
    });
    const core = await answer(service, homePolicy.nextAction, false);
    expect(core.nextAction.type).toBe('ASK_DATAPOINT');
  });

  it('AUTO_HOME case 4: Auto YES policy YES still asks Home before core', async () => {
    const { service, lead } = setup();
    const auto = await service.selectProduct(leadId, Product.AUTO_HOME);
    const autoPolicy = await answer(service, auto.nextAction, true);
    const home = await answer(service, autoPolicy.nextAction, true);
    expect(home.nextAction).toMatchObject({
      type: 'ASK_CURRENT_INSURANCE',
      productDomain: 'HOME',
    });
    expect(lead.intakePhase).not.toBe(IntakePhase.CORE_DATA_COLLECTION);
    const homePolicy = await answer(service, home.nextAction, true);
    const core = await answer(service, homePolicy.nextAction, true);
    expect(core.nextAction.type).toBe('ASK_DATAPOINT');
  });

  it('AUTO_HOME case 5: Auto YES policy YES, Home NO, then core', async () => {
    const { service } = setup();
    const auto = await service.selectProduct(leadId, Product.AUTO_HOME);
    const autoPolicy = await answer(service, auto.nextAction, true);
    const home = await answer(service, autoPolicy.nextAction, true);
    const core = await answer(service, home.nextAction, false);
    expect(core.nextAction.type).toBe('ASK_DATAPOINT');
  });

  it('treats repeated identical intake answers as idempotent', async () => {
    const { service, attempts, lead } = setup();
    const selected = await service.selectProduct(leadId, Product.AUTO);
    const first = await answer(service, selected.nextAction, false);
    const second = await answer(service, selected.nextAction, false);
    expect(first.nextAction.type).toBe(second.nextAction.type);
    expect(lead.currentAutoInsured).toBe(false);
    expect(attempts).toHaveLength(1);
  });

  it('rejects wrong-domain and stale intake actions', async () => {
    const { service, attempts } = setup();
    const selected = await service.selectProduct(leadId, Product.AUTO);
    attempts[0].metadata.productDomain = 'HOME';
    await expect(answer(service, selected.nextAction, true)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects stale product selection for a different product', async () => {
    const { service } = setup({ selectedProduct: Product.AUTO });
    await expect(service.selectProduct(leadId, Product.HOME)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects policy availability before current insurance is known', async () => {
    const { service, attempts } = setup();
    await service.selectProduct(leadId, Product.AUTO);
    attempts.push({
      id: '00000000-0000-4000-8000-000000009999',
      leadId,
      actionType: CollectionActionType.ASK_POLICY_DOCUMENT,
      product: Product.AUTO,
      status: CollectionAttemptStatus.PROPOSED,
      metadata: { productDomain: 'AUTO' },
      createdAt: new Date(),
    });
    await expect(
      service.answerIntake(
        leadId,
        '00000000-0000-4000-8000-000000009999',
        true,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('persists COMPLETE when core collection returns COMPLETE and remains complete', async () => {
    const { service, lead } = setup({
      selectedProduct: Product.AUTO,
      coreAction: { type: 'COMPLETE', actionId: 'complete-action' },
    });
    lead.currentAutoInsured = false;
    const complete = await service.currentAction(leadId);
    expect(complete.type).toBe('COMPLETE');
    expect(lead.intakePhase).toBe(IntakePhase.COMPLETE);
    const again = await service.currentAction(leadId);
    expect(again.type).toBe('COMPLETE');
    expect(lead.intakePhase).toBe(IntakePhase.COMPLETE);
  });
});
