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
          datapoints: [
            { key: 'driver.first_name', entityType: 'DRIVER' },
            { key: 'driver.last_name', entityType: 'DRIVER' },
          ],
        }}
        {...handlers}
      />,
    );
    expect(screen.getByText('Driver First Name')).toBeInTheDocument();
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
