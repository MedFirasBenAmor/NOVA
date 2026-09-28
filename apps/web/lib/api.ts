import type {
  CompletenessResponse,
  IntelligenceInput,
  IntelligenceResult,
  NextAction,
  SelectableProduct,
} from '@nova/shared-types';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: {
      endpoint: string;
      body: unknown;
      requestBody?: unknown;
    },
  ) {
    super(message);
  }
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    const parts = message
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const constraints = (item as { constraints?: unknown }).constraints;
          if (constraints && typeof constraints === 'object')
            return Object.values(constraints).filter(
              (value): value is string => typeof value === 'string',
            );
        }
        return undefined;
      })
      .flat()
      .filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  if (message && typeof message === 'object') {
    const constraints = (message as { constraints?: unknown }).constraints;
    if (constraints && typeof constraints === 'object') {
      const parts = Object.values(constraints).filter(
        (value): value is string => typeof value === 'string',
      );
      if (parts.length) return parts.join(' ');
    }
  }
  return fallback;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  debug?: { datapointKey?: string },
): Promise<T> {
  const requestBody = parseRequestBody(init?.body);
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    console.warn('NOVA API request failed', {
      endpoint: `${baseUrl}${path}`,
      status: response.status,
      backend: body,
      datapointKey:
        debug?.datapointKey ?? datapointKeyFromRequestBody(requestBody),
      submittedValue: submittedValueFromRequestBody(requestBody),
    });
    throw new ApiError(
      errorMessage(body, `Request failed (${response.status})`),
      response.status,
      { endpoint: `${baseUrl}${path}`, body, requestBody },
    );
  }
  return response.json() as Promise<T>;
}

function parseRequestBody(body: BodyInit | null | undefined) {
  if (typeof body !== 'string') return undefined;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function submittedValueFromRequestBody(body: unknown) {
  return body && typeof body === 'object'
    ? (body as { value?: unknown }).value
    : undefined;
}

function datapointKeyFromRequestBody(body: unknown) {
  if (!body || typeof body !== 'object') return undefined;
  return (body as { key?: unknown }).key;
}

export type ConversationMessage = {
  id: string;
  role: 'CUSTOMER' | 'NOVA' | 'SYSTEM';
  content: string;
  createdAt: string;
};

export type InteractionResponse = {
  intelligence: IntelligenceResult;
  completeness: CompletenessResponse;
  nextAction: NextAction;
  metrics: { acceptedCandidateDatapoints: number; [key: string]: number };
};

export type DocumentUploadResponse = {
  document: {
    id: string;
    documentType: string;
    collectionMode: string;
    status: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
  };
  nextAction: NextAction;
};

export const api = {
  createLead: () =>
    request<{ id: string }>('/leads', { method: 'POST', body: '{}' }),
  conversation: (leadId: string) =>
    request<{ messages: ConversationMessage[] }>(
      `/leads/${leadId}/conversation`,
    ),
  interaction: (
    leadId: string,
    message: string,
    entityContext?: IntelligenceInput['entityContext'],
  ) =>
    request<InteractionResponse>(`/leads/${leadId}/interactions`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        ...(entityContext ? { entityContext } : {}),
      }),
    }),
  selectProduct: (leadId: string, product: SelectableProduct) =>
    request<{ selectedProduct: SelectableProduct; nextAction: NextAction }>(
      `/leads/${leadId}/product`,
      { method: 'POST', body: JSON.stringify({ product }) },
    ),
  respond: (
    leadId: string,
    actionId: string,
    decision: 'ACCEPTED' | 'DECLINED' | 'SKIPPED',
  ) =>
    request<{ nextAction: NextAction }>(
      `/leads/${leadId}/collection-actions/${actionId}/respond`,
      { method: 'POST', body: JSON.stringify({ decision }) },
    ),
  answer: (
    leadId: string,
    actionId: string,
    value: unknown,
    message: string,
    datapointKey?: string,
  ) =>
    request<{ nextAction: NextAction; completeness: CompletenessResponse }>(
      `/leads/${leadId}/collection-actions/${actionId}/answer`,
      { method: 'POST', body: JSON.stringify({ value, message }) },
      { datapointKey },
    ),
  currentAction: (leadId: string) =>
    request<{ nextAction: NextAction }>(
      `/leads/${leadId}/collection-actions/current`,
    ),
  updateDatapoint: (
    leadId: string,
    body: {
      key: string;
      value: unknown;
      entityType?: string;
      entityId?: string;
      sourceReferenceId?: string;
    },
  ) =>
    request(`/leads/${leadId}/datapoints`, {
      method: 'PUT',
      body: JSON.stringify({
        ...body,
        sourceType: 'CUSTOMER_FORM',
        collectionMethod: 'MANUAL_ENTRY',
      }),
    }),
  upload: async (leadId: string, actionId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('collectionActionId', actionId);
    const response = await fetch(`${baseUrl}/leads/${leadId}/documents`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        errorMessage(body, `Upload failed (${response.status})`),
        response.status,
        { endpoint: `${baseUrl}/leads/${leadId}/documents`, body },
      );
    }
    return response.json() as Promise<DocumentUploadResponse>;
  },
  documentStatus: (leadId: string, documentId: string) =>
    request<{
      documentId: string;
      status: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
      failureReason?: string;
      completeness?: CompletenessResponse;
      nextAction?: NextAction;
    }>(`/leads/${leadId}/documents/${documentId}/status`),
};
