import type {
  CompletenessResponse,
  IntelligenceResult,
  NextAction,
  SelectableProduct,
} from '@nova/shared-types';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
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
  interaction: (leadId: string, message: string) =>
    request<InteractionResponse>(`/leads/${leadId}/interactions`, {
      method: 'POST',
      body: JSON.stringify({ message }),
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
  answer: (leadId: string, actionId: string, value: unknown, message: string) =>
    request<{ nextAction: NextAction; completeness: CompletenessResponse }>(
      `/leads/${leadId}/collection-actions/${actionId}/answer`,
      { method: 'POST', body: JSON.stringify({ value, message }) },
    ),
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
      throw new Error(body?.message ?? `Upload failed (${response.status})`);
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
