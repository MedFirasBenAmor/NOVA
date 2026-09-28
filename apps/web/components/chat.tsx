'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import type {
  ReviewSectionItem,
  CompletenessResponse,
  NextAction,
  SelectableProduct,
} from '@nova/shared-types';
import { api, type InteractionResponse } from '../lib/api';
import { PROCESSING_KEY, SESSION_KEY } from '@/lib/session';
import {
  assistantInteractionReply,
  conversationStage,
  display,
  entityContextFromAction,
  isForbiddenApiError,
  isRemovedAutoChatter,
  type ChatMessage,
} from '@/lib/chat-helpers';
import { Transcript } from '@/components/chat/transcript';
import { MessageComposer } from '@/components/chat/message-composer';
import { ProgressStepper } from '@/components/chat/progress-stepper';
import { ChatSidePanel } from '@/components/chat/chat-side-panel';

// Preserved export for consumers/tests: renderers live in their own module now.
export { NextActionRenderer } from '@/components/chat/next-action-renderer';

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'NOVA',
  content: '',
};

function cleanMessages(messages: ChatMessage[]) {
  return messages.filter((message) => !isRemovedAutoChatter(message.content));
}

function isAutoResponse(
  response:
    | InteractionResponse
    | { selectedProduct: SelectableProduct; nextAction: NextAction }
    | { nextAction: NextAction; completeness?: CompletenessResponse },
) {
  if ('selectedProduct' in response) return response.selectedProduct === 'AUTO';
  if ('completeness' in response) return response.completeness?.product === 'AUTO';
  return false;
}

function appendAssistantAction(
  current: ChatMessage[],
  response:
    | InteractionResponse
    | { selectedProduct: SelectableProduct; nextAction: NextAction }
    | { nextAction: NextAction; completeness?: CompletenessResponse },
  content = '',
) {
  const base = isAutoResponse(response) ? cleanMessages(current) : current;
  return [
    ...base,
    {
      id: crypto.randomUUID(),
      role: 'NOVA' as const,
      content,
      action: response.nextAction,
    },
  ];
}

function actionDatapointKey(action: NextAction) {
  if (action.type === 'ASK_DATAPOINT') return action.datapoint.key;
  if (action.type === 'ASK_GROUPED_DATAPOINTS')
    return action.datapoints.map((datapoint) => datapoint.key).join(',');
  return undefined;
}

export default function ChatShell() {
  const [leadId, setLeadId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [action, setAction] = useState<NextAction>();
  const [completeness, setCompleteness] = useState(0);
  const [completenessDetail, setCompletenessDetail] =
    useState<CompletenessResponse>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string>();

  const start = async () => {
    setLoading(true);
    setError(undefined);
    try {
      let id = window.localStorage.getItem(SESSION_KEY);
      if (id) {
        try {
          const conversation = await api.conversation(id);
          setMessages(
            cleanMessages(
              conversation.messages.map((m) => ({
                id: m.id,
                role: m.role === 'CUSTOMER' ? 'CUSTOMER' : 'NOVA',
                content: m.content,
              })),
            ),
          );
        } catch {
          window.localStorage.removeItem(SESSION_KEY);
          window.localStorage.removeItem(PROCESSING_KEY);
          id = null;
        }
      }
      if (!id) {
        id = (await api.createLead()).id;
        window.localStorage.setItem(SESSION_KEY, id);
      }
      const savedProcessing = window.localStorage.getItem(PROCESSING_KEY);
      let restoredAction: Extract<
        NextAction,
        { type: 'WAIT_FOR_PROCESSING' }
      > | null = null;
      if (savedProcessing) {
        try {
          const parsed = JSON.parse(savedProcessing) as Partial<NextAction>;
          if (
            parsed.type === 'WAIT_FOR_PROCESSING' &&
            typeof parsed.documentId === 'string' &&
            typeof parsed.documentType === 'string'
          )
            restoredAction = {
              type: 'WAIT_FOR_PROCESSING',
              documentId: parsed.documentId,
              documentType: parsed.documentType,
              status:
                parsed.status === 'PROCESSING' ? 'PROCESSING' : 'UPLOADED',
            };
        } catch {
          window.localStorage.removeItem(PROCESSING_KEY);
        }
      }
      setLeadId(id);
      if (restoredAction) setAction(restoredAction);
      setMessages((current) =>
        current.length
          ? restoredAction
            ? [
                ...current,
                {
                  id: `processing-${restoredAction.documentId}`,
                  role: 'NOVA',
                  content: 'Document received. Processing is continuing.',
                  action: restoredAction,
                },
              ]
            : current
          : [
              ...(WELCOME.content ? [WELCOME] : []),
              ...(restoredAction
                ? [
                    {
                      id: `processing-${restoredAction.documentId}`,
                      role: 'NOVA' as const,
                      content: 'Document received. Processing is continuing.',
                      action: restoredAction,
                    },
                  ]
                : []),
            ],
      );
      const pendingMessage = new URLSearchParams(window.location.search).get(
        'message',
      );
      if (pendingMessage) {
        setInput(pendingMessage);
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'NOVA is unavailable right now.',
      );
    } finally {
      setLoading(false);
    }
  };

  const newFolder = async () => {
    if (busy || loading) return;
    setBusy(true);
    setError(undefined);
    try {
      window.localStorage.removeItem(PROCESSING_KEY);
      const id = (await api.createLead()).id;
      window.localStorage.setItem(SESSION_KEY, id);
      setLeadId(id);
      setAction(undefined);
      setCompleteness(0);
      setCompletenessDetail(undefined);
      setInput('');
      setAnalyzing(false);
      setMessages(WELCOME.content ? [WELCOME] : []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'A new folder could not be created.',
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void start();
  }, []);
  useEffect(() => {
    if (action && action.type !== 'WAIT_FOR_PROCESSING')
      window.localStorage.removeItem(PROCESSING_KEY);
  }, [action]);
  useEffect(() => {
    if (!leadId || action?.type !== 'WAIT_FOR_PROCESSING') return;
    window.localStorage.setItem(PROCESSING_KEY, JSON.stringify(action));
    let stopped = false;
    let polls = 0;
    const timer = window.setInterval(async () => {
      if (stopped || polls++ >= 30) {
        window.clearInterval(timer);
        window.localStorage.removeItem(PROCESSING_KEY);
        return;
      }
      try {
        const result = await api.documentStatus(leadId, action.documentId);
        if (result.status === 'UPLOADED' || result.status === 'PROCESSING')
          return;
        window.clearInterval(timer);
        if (result.completeness) {
          setCompleteness(result.completeness.completeness);
          setCompletenessDetail(result.completeness);
        }
        if (result.nextAction) {
          setAction(result.nextAction);
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: 'NOVA',
              content:
                result.status === 'FAILED'
                  ? "We couldn't read this document automatically. We'll continue another way."
                  : 'Document processing is complete. NOVA updated your dossier.',
              action: result.nextAction,
            },
          ]);
        }
      } catch {
        // Transient polling errors do not destroy the chat state.
      }
    }, 1500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [action, leadId]);

  const sendText = async (text: string) => {
    const message = text.trim();
    if (!message || !leadId || busy) return;
    setInput('');
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'CUSTOMER', content: message },
    ]);
    setBusy(true);
    setAnalyzing(true);
    setError(undefined);
    try {
      let activeLeadId = leadId;
      let response: InteractionResponse;
      try {
        response = await api.interaction(
          activeLeadId,
          message,
          entityContextFromAction(action),
        );
      } catch (cause) {
        if (!isForbiddenApiError(cause)) throw cause;
        window.localStorage.removeItem(SESSION_KEY);
        window.localStorage.removeItem(PROCESSING_KEY);
        activeLeadId = (await api.createLead()).id;
        window.localStorage.setItem(SESSION_KEY, activeLeadId);
        setLeadId(activeLeadId);
        setAction(undefined);
        setCompleteness(0);
        setCompletenessDetail(undefined);
        response = await api.interaction(activeLeadId, message);
      }
      setCompleteness(response.completeness.completeness);
      setCompletenessDetail(response.completeness);
      setAction(response.nextAction);
      setMessages((current) =>
        appendAssistantAction(
          current,
          response,
          assistantInteractionReply(response),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'That message could not be processed.',
      );
    } finally {
      setBusy(false);
      setAnalyzing(false);
    }
  };

  const send = (event: FormEvent) => {
    event.preventDefault();
    void sendText(input);
  };

  const answer = async (value: unknown, message: string) => {
    if (!leadId || !action || !('actionId' in action) || busy) return;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'CUSTOMER', content: message },
    ]);
    setBusy(true);
    setError(undefined);
    try {
      const response =
        action.type === 'SELECT_PRODUCT'
          ? await api.selectProduct(leadId, value as SelectableProduct)
          : await api.answer(
              leadId,
              action.actionId,
              value,
              message,
              actionDatapointKey(action),
            );
      if ('completeness' in response) {
        setCompleteness(response.completeness.completeness);
        setCompletenessDetail(response.completeness);
      }
      setAction(response.nextAction);
      setMessages((current) => appendAssistantAction(current, response));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'That answer could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: 'ACCEPTED' | 'DECLINED' | 'SKIPPED') => {
    if (!leadId || !action || !('actionId' in action) || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await api.respond(leadId, action.actionId, decision);
      setAction(response.nextAction);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'NOVA',
          content:
            decision === 'ACCEPTED'
              ? 'Great — choose a file when you are ready.'
              : 'No problem — we’ll continue another way.',
          action: response.nextAction,
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'That choice could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!leadId || !action || !('actionId' in action) || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const response = await api.upload(leadId, action.actionId, file);
      setAction(response.nextAction);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'NOVA',
          content: 'Document received. No information has been extracted yet.',
          action: response.nextAction,
        },
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const reviewEdit = async (item: ReviewSectionItem, value: unknown) => {
    if (!leadId || !action || !('actionId' in action) || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await api.updateDatapoint(leadId, {
        key: item.key,
        value,
        entityType: item.entityType,
        entityId: item.entityId,
        sourceReferenceId: action.actionId,
      });
      const response = await api.currentAction(leadId);
      setAction(response.nextAction);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'NOVA',
          content: 'NOVA updated this section for review.',
          action: response.nextAction,
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'That edit could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <main
        className="grid min-h-[calc(100dvh-4rem)] place-items-center"
        role="status"
        aria-busy="true"
      >
        <Loader2
          className="size-8 animate-spin text-nova-blue"
          aria-label="Loading NOVA"
        />
      </main>
    );

  const stage = conversationStage(messages, action, completeness);
  const productLabel =
    completenessDetail && completenessDetail.product !== 'COMMON'
      ? display(completenessDetail.product)
      : 'Assurance';

  return (
    <main className="mx-auto w-full max-w-6xl px-0 py-0 sm:px-6 sm:py-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <section className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-white lg:h-[calc(100dvh-8rem)] lg:min-h-[640px] lg:rounded-[20px] lg:border lg:border-nova-border lg:shadow-token">
          <header className="shrink-0 border-b border-nova-border px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void newFolder()}
                disabled={busy || loading}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-nova-border px-3 text-xs font-medium text-nova-navy transition-colors hover:border-nova-blue hover:text-nova-blue focus:outline-none focus:ring-2 focus:ring-nova-blue disabled:opacity-50"
              >
                <FolderPlus className="size-3.5" aria-hidden="true" />
                New folder
              </button>
              <span className="text-xs font-medium text-nova-muted">
                {productLabel}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-nova-surface-secondary"
                role="progressbar"
                aria-valuenow={completeness}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Dossier completeness"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-nova-blue to-nova-success transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-nova-muted">
                {completeness}%
              </span>
            </div>
            <div className="mt-4 lg:hidden">
              <ProgressStepper activeStep={stage} />
            </div>
          </header>
          <Transcript
            messages={messages}
            action={action}
            analyzing={analyzing}
            error={error}
            onRetry={() => void start()}
            onPickSuggestion={(text) => void sendText(text)}
            onAnswer={answer}
            onDecision={decide}
            onReviewEdit={reviewEdit}
            onUpload={upload}
            busy={busy}
          />
          <MessageComposer
            value={input}
            onChange={setInput}
            onSubmit={send}
            disabled={busy || !leadId}
            busy={busy}
          />
        </section>
        <ChatSidePanel
          stage={stage}
          completeness={completeness}
          completenessDetail={completenessDetail}
          action={action}
        />
      </div>
    </main>
  );
}
