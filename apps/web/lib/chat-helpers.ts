import type {
  IntelligenceInput,
  NextAction,
} from '@nova/shared-types';
import { ApiError, type InteractionResponse } from './api';

export function display(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value)
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function actionKey(action: NextAction | undefined) {
  return action
    ? 'actionId' in action
      ? action.actionId
      : action.documentId
    : undefined;
}

export function entityContextFromAction(
  action: NextAction | undefined,
): IntelligenceInput['entityContext'] | undefined {
  if (action?.type !== 'ASK_DATAPOINT') return undefined;
  const { datapoint } = action;
  const currentDatapoint = {
    key: datapoint.key,
    label: datapoint.label,
    entityType: datapoint.entityType,
    ...(datapoint.entityId ? { entityId: datapoint.entityId } : {}),
  };
  if (!datapoint.entityId) return { currentDatapoint };
  if (datapoint.entityType === 'VEHICLE')
    return { vehicleId: datapoint.entityId, currentDatapoint };
  if (datapoint.entityType === 'DRIVER')
    return { driverId: datapoint.entityId, currentDatapoint };
  if (datapoint.entityType === 'PROPERTY')
    return { propertyId: datapoint.entityId, currentDatapoint };
  if (datapoint.entityType === 'CLAIM')
    return { claimId: datapoint.entityId, currentDatapoint };
  if (datapoint.entityType === 'CO_APPLICANT')
    return { coApplicantId: datapoint.entityId, currentDatapoint };
  return { currentDatapoint };
}

export function formatCandidateValue(value: unknown) {
  if (typeof value === 'string') return display(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return display(value);
  return JSON.stringify(value);
}

function extractedSummary(response: InteractionResponse) {
  const candidates = response.intelligence.candidateDatapoints;
  if (!candidates.length || response.metrics.acceptedCandidateDatapoints < 1)
    return undefined;
  const byKey = new Map(
    candidates.map((candidate) => [candidate.key, candidate]),
  );
  const year = byKey.get('vehicle.year')?.value;
  const make = byKey.get('vehicle.make')?.value;
  const model = byKey.get('vehicle.model')?.value;
  const vehicle = [year, make, model]
    .filter((value) => value !== undefined && value !== null)
    .map(formatCandidateValue)
    .join(' ');
  const used = new Set<string>();
  const parts: string[] = [];
  if (vehicle) {
    parts.push(vehicle.toLowerCase().includes('vehicle') ? vehicle : 'a ' + vehicle);
    used.add('vehicle.year');
    used.add('vehicle.make');
    used.add('vehicle.model');
  }
  for (const candidate of candidates) {
    if (used.has(candidate.key)) continue;
    parts.push(display(candidate.key) + ': ' + formatCandidateValue(candidate.value));
    if (parts.length >= 5) break;
  }
  if (!parts.length) return undefined;
  return 'So I have ' + parts.join(', ') + '. If anything is wrong, tell me and I’ll correct it.';
}

export function assistantInteractionReply(response: InteractionResponse) {
  const summary = extractedSummary(response);
  if (summary) return summary;
  if (response.metrics.acceptedCandidateDatapoints > 1)
    return 'Great — I was able to capture several details from that.';
  if (response.metrics.acceptedCandidateDatapoints === 1)
    return 'Thanks — I captured one detail from that. If it is wrong, tell me and I’ll correct it.';
  if (response.intelligence.intent.type === 'GENERAL_INQUIRY')
    return "Hi — I’m here. Tell me what you want to insure, or choose one of the options below.";
  return 'Thanks — I have noted that.';
}

export function isForbiddenApiError(cause: unknown) {
  return (
    (cause instanceof ApiError && cause.status === 403) ||
    (cause &&
      typeof cause === 'object' &&
      (cause as { status?: unknown }).status === 403)
  );
}

export type ChatMessage = {
  id: string;
  role: 'CUSTOMER' | 'NOVA';
  content?: string;
  action?: NextAction;
};

export function conversationStage(
  messages: ChatMessage[],
  action: NextAction | undefined,
  completeness: number,
): 1 | 2 | 3 {
  if (action?.type === 'COMPLETE' || completeness >= 100) return 3;
  if (messages.length <= 1) return 1;
  return 2;
}
