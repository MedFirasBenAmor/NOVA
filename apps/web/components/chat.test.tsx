import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextAction } from '@nova/shared-types';
import ChatShell, { NextActionRenderer } from './chat';

const handlers = { onAnswer: vi.fn(), onDecision: vi.fn(), busy: false };
const response = (body: unknown) =>
  Promise.resolve({ ok: true, json: async () => body } as Response);

describe('NextActionRenderer', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it.each([
    [
      'SINGLE_CHOICE',
      [
        { value: 'PLEASURE', label: 'Pleasure' },
        { value: 'WORK', label: 'Work' },
      ],
      'Pleasure',
    ],
    ['YES_NO', undefined, 'Yes'],
  ] as const)(
    'renders %s choices from backend metadata',
    (inputType, options, expected) => {
      const action: NextAction = {
        type: 'ASK_DATAPOINT',
        actionId: 'a',
        datapoint: {
          key: 'vehicle.primary_use',
          entityType: 'VEHICLE',
          label: 'Primary use',
        },
        input:
          inputType === 'SINGLE_CHOICE'
            ? { type: inputType, options: [...(options ?? [])] }
            : { type: inputType },
      };
      render(<NextActionRenderer action={action} {...handlers} />);
      fireEvent.click(screen.getByRole('button', { name: expected }));
      expect(handlers.onAnswer).toHaveBeenCalled();
    },
  );

  it('renders vehicle add-another actions with French labels and vehicle context', () => {
    const action: NextAction = {
      type: 'ASK_ADD_ANOTHER_ENTITY',
      actionId: 'add-vehicle',
      entityType: 'VEHICLE',
      domain: 'AUTO',
      loopId: 'loop-1',
      ordinal: 2,
      label: 'Véhicule 2',
      question: 'Voulez-vous ajouter un autre véhicule ?',
      input: { type: 'YES_NO' },
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    expect(screen.getByText('Véhicule 2')).toBeInTheDocument();
    expect(
      screen.getByText('Voulez-vous ajouter un autre véhicule ?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
    expect(handlers.onAnswer).toHaveBeenCalledWith(true, 'Oui');
    expect(screen.getByRole('button', { name: 'Non' })).toBeInTheDocument();
  });

  it('renders repeatable vehicle context on datapoint actions', () => {
    const action: NextAction = {
      type: 'ASK_DATAPOINT',
      actionId: 'vehicle-2-vin',
      datapoint: {
        key: 'vehicle.vin',
        entityType: 'VEHICLE',
        entityId: '00000000-0000-4000-8000-000000000022',
        entityLabel: 'Véhicule 2',
        label: 'VIN',
      },
      input: { type: 'TEXT' },
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    expect(screen.getByText('Véhicule 2')).toBeInTheDocument();
    expect(screen.getByLabelText('VIN?')).toBeInTheDocument();
  });

  it('renders driver assignment options and submits the selected principal driver', () => {
    const action: NextAction = {
      type: 'ASSIGN_ENTITY_RELATION',
      actionId: 'assign-v1',
      relationType: 'DRIVER_VEHICLE_PRIMARY',
      prompt: 'PRIMARY_DRIVER',
      sourceEntityType: 'DRIVER',
      targetEntityType: 'VEHICLE',
      targetEntityId: 'vehicle-1',
      vehicleOrdinal: 1,
      vehicleLabel: 'Véhicule 1',
      question: 'Qui conduit principalement le véhicule 1 ?',
      options: [
        { entityId: 'driver-a', label: 'Ahmed Ben Ali' },
        { entityId: 'driver-b', label: 'Sarah Ben Ali' },
      ],
      input: { type: 'SINGLE_CHOICE' },
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    expect(screen.getByText('Véhicule 1')).toBeInTheDocument();
    expect(
      screen.getByText('Qui conduit principalement le véhicule 1 ?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sarah Ben Ali' }));
    expect(handlers.onAnswer).toHaveBeenCalledWith('driver-b', 'Sarah Ben Ali');
  });

  it('renders resumed assignment at the first missing vehicle', () => {
    const action: NextAction = {
      type: 'ASSIGN_ENTITY_RELATION',
      actionId: 'assign-v2',
      relationType: 'DRIVER_VEHICLE_PRIMARY',
      prompt: 'PRIMARY_DRIVER',
      sourceEntityType: 'DRIVER',
      targetEntityType: 'VEHICLE',
      targetEntityId: 'vehicle-2',
      vehicleOrdinal: 2,
      vehicleLabel: 'Véhicule 2',
      question: 'Qui conduit principalement le véhicule 2 ?',
      options: [{ entityId: 'driver-b', label: 'Sarah Ben Ali' }],
      input: { type: 'SINGLE_CHOICE' },
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    expect(screen.queryByText('Véhicule 1')).not.toBeInTheDocument();
    expect(screen.getByText('Véhicule 2')).toBeInTheDocument();
    expect(
      screen.getByText('Qui conduit principalement le véhicule 2 ?'),
    ).toBeInTheDocument();
  });

  it('renders occasional driver yes/no assignment prompt', () => {
    const action: NextAction = {
      type: 'ASSIGN_ENTITY_RELATION',
      actionId: 'assign-occasional',
      relationType: 'DRIVER_VEHICLE_OCCASIONAL',
      prompt: 'OCCASIONAL_DRIVER_EXISTS',
      sourceEntityType: 'DRIVER',
      targetEntityType: 'VEHICLE',
      targetEntityId: 'vehicle-1',
      vehicleOrdinal: 1,
      vehicleLabel: 'Véhicule 1',
      question:
        'Y a-t-il un autre conducteur qui utilise occasionnellement ce véhicule ?',
      input: { type: 'YES_NO' },
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: 'Oui' }));
    expect(handlers.onAnswer).toHaveBeenCalledWith(true, 'Oui');
    expect(screen.getByRole('button', { name: 'Non' })).toBeInTheDocument();
  });

  it.each([
    ['NUMBER', 'number'],
    ['DATE', 'date'],
    ['TEXT', 'text'],
  ] as const)('renders a native %s input', (inputType, type) => {
    const action: NextAction = {
      type: 'ASK_DATAPOINT',
      actionId: 'a',
      datapoint: { key: 'driver.date_of_birth', entityType: 'DRIVER' },
      input: { type: inputType },
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    expect(screen.getByLabelText(/Driver Date Of Birth/i)).toHaveAttribute(
      'type',
      type,
    );
  });

  it('renders grouped, confirmation, and complete contracts without eligibility claims', () => {
    const { rerender } = render(
      <NextActionRenderer
        action={{
          type: 'ASK_GROUPED_DATAPOINTS',
          actionId: 'a',
          title: 'Identité du conducteur',
          datapoints: [
            {
              key: 'driver.first_name',
              entityType: 'DRIVER',
              input: { type: 'TEXT' },
            },
            {
              key: 'driver.last_name',
              entityType: 'DRIVER',
              input: { type: 'TEXT' },
            },
            {
              key: 'driver.date_of_birth',
              entityType: 'DRIVER',
              input: { type: 'DATE' },
            },
          ],
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText('Identité du conducteur')).toBeInTheDocument();
    expect(screen.getByText('Driver First Name')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Driver First Name'), {
      target: { value: 'Ahmed' },
    });
    fireEvent.change(screen.getByLabelText('Driver Last Name'), {
      target: { value: 'Ben Ali' },
    });
    fireEvent.change(screen.getByLabelText('Driver Date Of Birth'), {
      target: { value: '1988-04-12' },
    });
    fireEvent.click(screen.getByText('Continue'));
    expect(handlers.onAnswer).toHaveBeenCalledWith(
      {
        'driver.first_name': 'Ahmed',
        'driver.last_name': 'Ben Ali',
        'driver.date_of_birth': '1988-04-12',
      },
      'Identité du conducteur',
    );
    rerender(
      <NextActionRenderer
        action={{
          type: 'CONFIRM_DATAPOINT',
          actionId: 'b',
          datapoint: {
            key: 'vehicle.model',
            entityType: 'VEHICLE',
            value: 'RAV4',
          },
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText(/Rav4/i)).toBeInTheDocument();
    rerender(
      <NextActionRenderer
        action={{ type: 'COMPLETE', actionId: 'c' }}
        {...handlers}
      />,
    );
    expect(
      screen.getByText(/information currently required/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/you are eligible|application is approved/i),
    ).not.toBeInTheDocument();
  });

  it('renders document value and sends decline decisions', () => {
    const action: NextAction = {
      type: 'SUGGEST_FULL_DOCUMENT',
      actionId: 'a',
      documentType: 'DRIVER_LICENSE',
      entityType: 'DRIVER',
      coveredMissingDatapoints: ['a', 'b', 'c'],
      questionsPotentiallyAvoided: 3,
      required: false,
    };
    render(<NextActionRenderer action={action} {...handlers} />);
    expect(screen.getByText(/around 3 manual questions/)).toBeInTheDocument();
    expect(screen.queryByText(/minutes/)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Continue without document/ }),
    );
    expect(handlers.onDecision).toHaveBeenCalledWith('DECLINED');
  });

  it('renders REVIEW_SECTION groups and submits explicit confirmation', () => {
    const onReviewEdit = vi.fn();
    const action: NextAction = {
      type: 'REVIEW_SECTION',
      actionId: 'review-1',
      confirmationId: 'confirmation-1',
      sectionCode: 'AUTO_DRIVER',
      title: 'Drivers',
      snapshotHash: 'hash-1',
      groups: [
        {
          label: 'Primary driver',
          items: [
            {
              kind: 'DATAPOINT',
              key: 'driver.first_name',
              label: 'First name',
              value: 'Alice',
              displayValue: 'Alice',
              entityType: 'DRIVER',
              entityId: '00000000-0000-4000-8000-000000000001',
              entityLabel: 'Primary driver',
              editable: true,
              input: { type: 'TEXT' },
            },
          ],
        },
      ],
    };
    render(
      <NextActionRenderer
        action={action}
        {...handlers}
        onReviewEdit={onReviewEdit}
      />,
    );
    expect(screen.getByText('Drivers')).toBeInTheDocument();
    expect(screen.getByText('Primary driver')).toBeInTheDocument();
    expect(screen.queryByText(/00000000/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('First name'), {
      target: { value: 'Alicia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onReviewEdit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'driver.first_name' }),
      'Alicia',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'These details are correct' }),
    );
    expect(handlers.onAnswer).toHaveBeenCalledWith(
      { snapshotHash: 'hash-1' },
      'These details are correct',
    );
  });

  it('preselects review edit values and submits canonical choice values', () => {
    const onReviewEdit = vi.fn();
    const action: NextAction = {
      type: 'REVIEW_SECTION',
      actionId: 'review-2',
      confirmationId: 'confirmation-2',
      sectionCode: 'AUTO_ACQUISITION',
      title: 'Vehicle acquisition',
      snapshotHash: 'hash-2',
      groups: [
        {
          label: 'Vehicle',
          items: [
            {
              kind: 'DATAPOINT',
              key: 'vehicle.financing_status',
              label: 'Financing status',
              value: 'LEASED',
              displayValue: 'Leased',
              entityType: 'VEHICLE',
              entityId: '00000000-0000-4000-8000-000000000010',
              entityLabel: 'Vehicle',
              editable: true,
              input: {
                type: 'SINGLE_CHOICE',
                options: [
                  { value: 'FINANCED', label: 'Financed' },
                  { value: 'LEASED', label: 'Leased' },
                ],
              },
            },
            {
              kind: 'DATAPOINT',
              key: 'vehicle.purchase_or_lease_date',
              label: 'Purchase date',
              value: '2026-08-19',
              displayValue: '2026-08-19',
              entityType: 'VEHICLE',
              entityId: '00000000-0000-4000-8000-000000000010',
              entityLabel: 'Vehicle',
              editable: true,
              input: { type: 'DATE' },
            },
          ],
        },
      ],
    };
    render(
      <NextActionRenderer
        action={action}
        {...handlers}
        onReviewEdit={onReviewEdit}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(screen.getByLabelText('Financing status')).toHaveValue('LEASED');
    fireEvent.change(screen.getByLabelText('Financing status'), {
      target: { value: 'FINANCED' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onReviewEdit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'vehicle.financing_status' }),
      'FINANCED',
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
    expect(screen.getByLabelText('Purchase date')).toHaveValue('2026-08-19');
  });

  it('selects an accepted document file and renders WAIT_FOR_PROCESSING', () => {
    const onUpload = vi.fn();
    const action: NextAction = {
      type: 'SUGGEST_TARGETED_CAPTURE',
      actionId: 'a',
      documentType: 'DRIVER_LICENSE',
      entityType: 'DRIVER',
      coveredMissingDatapoints: ['driver.first_name'],
      questionsPotentiallyAvoided: 1,
      required: false,
      accepted: true,
    };
    const { rerender } = render(
      <NextActionRenderer action={action} {...handlers} onUpload={onUpload} />,
    );
    const file = new File(['image'], 'target.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Choose a file'), {
      target: { files: [file] },
    });
    expect(onUpload).toHaveBeenCalledWith(file);
    rerender(
      <NextActionRenderer
        action={{
          type: 'WAIT_FOR_PROCESSING',
          documentId: 'd',
          documentType: 'DRIVER_LICENSE',
          status: 'UPLOADED',
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText('Document received.')).toBeInTheDocument();
    expect(screen.queryByText(/extracted/i)).not.toBeInTheDocument();
  });
});

describe('ChatShell', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => cleanup());

  it('turns a quick reply into a user bubble and renders the next assistant action below it', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ id: 'lead-1' }))
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'NEW_ACQUISITION', confidence: 1 },
            product: { type: 'AUTO', confidence: 1 },
            events: [],
            candidateDatapoints: [],
          },
          completeness: {
            product: 'AUTO',
            completeness: 8,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: {
            type: 'ASK_CURRENT_INSURANCE',
            actionId: 'current-auto',
            productDomain: 'AUTO',
            question: 'Avez-vous déjà une assurance auto ?',
            input: { type: 'YES_NO' },
          },
          metrics: { acceptedCandidateDatapoints: 0 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<ChatShell />);
    await screen.findByText('Comment voulez-vous commencer ?');
    fireEvent.click(screen.getByText('J’ai une nouvelle voiture'));

    expect(
      await screen.findByText('J’ai une nouvelle voiture'),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Avez-vous déjà une assurance auto ?'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Comment voulez-vous commencer ?'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('creates an anonymous lead and submits customer text to intelligence', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ id: 'lead-1' }))
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'NEW_ACQUISITION', confidence: 1 },
            product: { type: 'AUTO', confidence: 1 },
            events: [],
            candidateDatapoints: [],
          },
          completeness: {
            product: 'AUTO',
            completeness: 16,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: { type: 'COMPLETE', actionId: 'done' },
          metrics: { acceptedCandidateDatapoints: 4 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    const composer = await screen.findByLabelText('Message');
    fireEvent.change(composer, { target: { value: 'I bought a RAV4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('I bought a RAV4')).toBeInTheDocument();
    expect(
      await screen.findByText(/capture several details/),
    ).toBeInTheDocument();
    expect(screen.getByText('16%')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/leads'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/interactions'),
      expect.objectContaining({
        body: JSON.stringify({ message: 'I bought a RAV4' }),
      }),
    );
  });

  it('passes the current datapoint context with free-text chat answers', async () => {
    const claimAction = {
      type: 'ASK_DATAPOINT' as const,
      actionId: 'action-1',
      datapoint: {
        key: 'claim.description',
        entityType: 'CLAIM' as const,
        entityId: '00000000-0000-4000-8000-000000000123',
        label: 'Claim description',
      },
      input: { type: 'TEXT' as const },
    };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ id: 'lead-1' }))
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'GENERAL_INQUIRY', confidence: 1 },
            product: { type: 'AUTO', confidence: 1 },
            events: [],
            candidateDatapoints: [],
          },
          completeness: {
            product: 'AUTO',
            completeness: 16,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: claimAction,
          metrics: { acceptedCandidateDatapoints: 0 },
        }),
      )
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'CLAIM_MENTIONED', confidence: 1 },
            product: { type: 'AUTO', confidence: 1 },
            events: [],
            candidateDatapoints: [],
          },
          completeness: {
            product: 'AUTO',
            completeness: 20,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: { type: 'COMPLETE', actionId: 'done' },
          metrics: { acceptedCandidateDatapoints: 0 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    const composer = await screen.findByLabelText('Message');
    fireEvent.change(composer, { target: { value: 'continue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Claim description?');
    fireEvent.change(composer, { target: { value: 'Small windshield claim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByText('Small windshield claim');
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/interactions'),
      expect.objectContaining({
        body: JSON.stringify({
          message: 'Small windshield claim',
          entityContext: {
            claimId: '00000000-0000-4000-8000-000000000123',
            currentDatapoint: {
              key: 'claim.description',
              label: 'Claim description',
              entityType: 'CLAIM',
              entityId: '00000000-0000-4000-8000-000000000123',
            },
          },
        }),
      }),
    );
  });

  it('summarizes extracted vehicle facts and invites corrections', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ id: 'lead-1' }))
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'NEW_ACQUISITION', confidence: 1 },
            product: { type: 'AUTO', confidence: 1 },
            events: [],
            candidateDatapoints: [
              {
                key: 'vehicle.year',
                value: 2024,
                entityType: 'VEHICLE',
                method: 'EXTRACTED',
                confidence: 0.99,
              },
              {
                key: 'vehicle.make',
                value: 'TOYOTA',
                entityType: 'VEHICLE',
                method: 'EXTRACTED',
                confidence: 0.99,
              },
              {
                key: 'vehicle.model',
                value: 'RAV4',
                entityType: 'VEHICLE',
                method: 'EXTRACTED',
                confidence: 0.99,
              },
            ],
          },
          completeness: {
            product: 'AUTO',
            completeness: 16,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: { type: 'COMPLETE', actionId: 'done' },
          metrics: { acceptedCandidateDatapoints: 3 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    const composer = await screen.findByLabelText('Message');
    fireEvent.change(composer, {
      target: { value: 'I drive a 2024 Toyota RAV4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(
      await screen.findByText(/So I have a 2024 Toyota Rav4/),
    ).toBeInTheDocument();
    expect(screen.getByText(/If anything is wrong/)).toBeInTheDocument();
  });

  it('answers a greeting even when no dossier facts are extracted', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ id: 'lead-1' }))
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'GENERAL_INQUIRY', confidence: 1 },
            product: { type: 'COMMON', confidence: 0.7 },
            events: [],
            candidateDatapoints: [],
          },
          completeness: {
            product: 'COMMON',
            completeness: 0,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: {
            type: 'SELECT_PRODUCT',
            actionId: 'select-product',
            options: [
              { value: 'AUTO', label: 'Auto' },
              { value: 'HOME', label: 'Home' },
              { value: 'AUTO_HOME', label: 'Auto + Home' },
            ],
          },
          metrics: { acceptedCandidateDatapoints: 0 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    const composer = await screen.findByLabelText('Message');
    fireEvent.change(composer, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(await screen.findByText(/Hi — I’m here/)).toBeInTheDocument();
    expect(
      screen.getByText('Choose what you want to insure'),
    ).toBeInTheDocument();
  });

  it('renders structured API validation errors as readable text', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ id: 'lead-1' }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            message: [
              {
                property: 'entityContext',
                constraints: {
                  whitelistValidation:
                    'entityContext contains an unsupported field',
                },
              },
            ],
          }),
        } as Response),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    const composer = await screen.findByLabelText('Message');
    fireEvent.change(composer, { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(
      await screen.findByText('entityContext contains an unsupported field'),
    ).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('recovers from a stale anonymous session during message send', async () => {
    localStorage.setItem('nova.leadId', 'lead-existing');
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ messages: [] }))
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({ message: 'Invalid anonymous session' }),
        } as Response),
      )
      .mockImplementationOnce(() => response({ id: 'lead-new' }))
      .mockImplementationOnce(() =>
        response({
          intelligence: {
            intent: { type: 'GENERAL_INQUIRY', confidence: 1 },
            product: { type: 'COMMON', confidence: 0.5 },
            events: [],
            candidateDatapoints: [],
          },
          completeness: {
            product: 'COMMON',
            completeness: 0,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: {
            type: 'SELECT_PRODUCT',
            actionId: 'select-product',
            options: [{ value: 'AUTO', label: 'Auto' }],
          },
          metrics: { acceptedCandidateDatapoints: 0 },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    const composer = await screen.findByLabelText('Message');
    fireEvent.change(composer, { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText(/Hi — I’m here/)).toBeInTheDocument();
    expect(
      screen.getByText('Choose what you want to insure'),
    ).toBeInTheDocument();
    expect(localStorage.getItem('nova.leadId')).toBe('lead-new');
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('/leads/lead-new/interactions'),
      expect.objectContaining({ body: JSON.stringify({ message: 'hi' }) }),
    );
  });

  it('reuses an existing lead and restores conversation messages', async () => {
    localStorage.setItem('nova.leadId', 'lead-existing');
    const fetchMock = vi.fn(() =>
      response({
        messages: [
          {
            id: 'm1',
            role: 'CUSTOMER',
            content: 'Existing message',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    expect(await screen.findByText('Existing message')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/leads/lead-existing/conversation'),
      expect.anything(),
    );
  });

  it('creates a new folder and resets the chat from an existing lead', async () => {
    localStorage.setItem('nova.leadId', 'lead-existing');
    localStorage.setItem(
      'nova.processingDocument',
      '{"type":"WAIT_FOR_PROCESSING"}',
    );
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        response({
          messages: [
            {
              id: 'm1',
              role: 'CUSTOMER',
              content: 'Existing message',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      )
      .mockImplementationOnce(() => response({ id: 'lead-new' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    expect(await screen.findByText('Existing message')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /New folder/i }));
    expect(
      await screen.findByText(
        'Hi! Tell me what you need help with, in your own words.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Existing message')).not.toBeInTheDocument();
    expect(localStorage.getItem('nova.leadId')).toBe('lead-new');
    expect(localStorage.getItem('nova.processingDocument')).toBeNull();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/leads'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('keeps a retryable error visible when lead creation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Backend unavailable' }),
        } as Response),
      ),
    );
    render(<ChatShell />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Backend unavailable',
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('restores processing, polls with the session cookie, and renders the updated action', async () => {
    vi.useFakeTimers();
    localStorage.setItem('nova.leadId', 'lead-existing');
    localStorage.setItem(
      'nova.processingDocument',
      JSON.stringify({
        type: 'WAIT_FOR_PROCESSING',
        documentId: 'document-1',
        documentType: 'DRIVER_LICENSE',
        status: 'UPLOADED',
      }),
    );
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => response({ messages: [] }))
      .mockImplementationOnce(() =>
        response({
          documentId: 'document-1',
          status: 'PROCESSED',
          completeness: {
            product: 'AUTO',
            completeness: 42,
            known: [],
            missing: [],
            conditionalRequired: [],
          },
          nextAction: { type: 'COMPLETE', actionId: 'done' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<ChatShell />);
    await act(async () => Promise.resolve());
    expect(screen.getByText('Document received.')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(
      screen.getByText(/information currently required/),
    ).toBeInTheDocument();
    expect(localStorage.getItem('nova.processingDocument')).toBeNull();
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/documents/document-1/status'),
      expect.objectContaining({ credentials: 'include' }),
    );
    await act(async () => vi.advanceTimersByTime(3000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('renders a non-blocking fallback when document processing fails', async () => {
    vi.useFakeTimers();
    localStorage.setItem('nova.leadId', 'lead-existing');
    localStorage.setItem(
      'nova.processingDocument',
      JSON.stringify({
        type: 'WAIT_FOR_PROCESSING',
        documentId: 'document-1',
        documentType: 'DRIVER_LICENSE',
        status: 'PROCESSING',
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() => response({ messages: [] }))
        .mockImplementationOnce(() =>
          response({
            documentId: 'document-1',
            status: 'FAILED',
            failureReason: 'OCR_FAILED',
            completeness: {
              product: 'AUTO',
              completeness: 10,
              known: [],
              missing: [],
              conditionalRequired: [],
            },
            nextAction: { type: 'COMPLETE', actionId: 'fallback' },
          }),
        ),
    );
    render(<ChatShell />);
    await act(async () => Promise.resolve());
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.getByText(/couldn't read this document automatically/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/information currently required/),
    ).toBeInTheDocument();
  });
});
