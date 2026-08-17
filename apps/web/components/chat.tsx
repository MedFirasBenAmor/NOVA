'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowUp,
  Check,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { NextAction, SelectableProduct } from '@nova/shared-types';
import { api, type InteractionResponse } from '../lib/api';

const SESSION_KEY = 'nova.leadId';
const PROCESSING_KEY = 'nova.processingDocument';

function display(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value)
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function actionKey(action: NextAction | undefined) {
  return action
    ? 'actionId' in action
      ? action.actionId
      : action.documentId
    : undefined;
}

type ActionProps = {
  action: NextAction;
  onAnswer: (value: unknown, message: string) => void;
  onDecision: (decision: 'ACCEPTED' | 'DECLINED' | 'SKIPPED') => void;
  onUpload?: (file: File) => void;
  busy: boolean;
};

export function NextActionRenderer({
  action,
  onAnswer,
  onDecision,
  onUpload,
  busy,
}: ActionProps) {
  if (action.type === 'COMPLETE')
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <Check className="mb-2 size-5 text-emerald-700" />
        <p className="font-medium">
          Great — NOVA has the information currently required for this step.
        </p>
        <p className="mt-1 text-emerald-800/70">
          This is a completeness milestone, not an eligibility or approval
          decision.
        </p>
      </div>
    );
  if (action.type === 'SELECT_PRODUCT')
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <p className="font-medium">Choose what you want to insure</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {action.options.map((option) => (
            <button
              key={option.value}
              disabled={busy}
              onClick={() => onAnswer(option.value, option.label)}
              className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  if (action.type === 'WAIT_FOR_PROCESSING')
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <FileText className="mb-2 size-5 text-blue-700" />
        <p className="font-medium">Document received.</p>
        <p className="mt-1 text-blue-900/70">
          NOVA will analyze it before asking for information that may already be
          present.
        </p>
      </div>
    );
  if (
    action.type === 'ASK_CURRENT_INSURANCE' ||
    action.type === 'ASK_POLICY_DOCUMENT' ||
    action.type === 'ASK_ADD_ANOTHER_ENTITY'
  )
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <p className="font-medium">{action.question}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            disabled={busy}
            onClick={() => onAnswer(true, 'Yes')}
            className="min-h-12 rounded-xl border border-[var(--border)] px-4 text-left text-sm font-medium hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            Yes
          </button>
          <button
            disabled={busy}
            onClick={() => onAnswer(false, 'No')}
            className="min-h-12 rounded-xl border border-[var(--border)] px-4 text-left text-sm font-medium hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            No
          </button>
        </div>
      </div>
    );
  if (
    action.type === 'SUGGEST_FULL_DOCUMENT' ||
    action.type === 'SUGGEST_TARGETED_CAPTURE'
  ) {
    const full = action.type === 'SUGGEST_FULL_DOCUMENT';
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <FileText className="mt-0.5 size-5 text-[var(--accent)]" />
          <div>
            <p className="font-medium">
              {full
                ? 'Share a document to avoid several questions'
                : 'Share only the useful section'}
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {full
                ? 'You can optionally share your driver’s licence so NOVA can pre-fill some missing information.'
                : 'No problem — you do not need to share the entire document. You can photograph only the part containing the information NOVA needs.'}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              This could avoid around {action.questionsPotentiallyAvoided}{' '}
              manual questions.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {action.accepted ? (
            <label className="min-h-11 cursor-pointer rounded-xl bg-[var(--accent)] px-4 py-3 text-center text-sm font-medium text-white">
              Choose a file
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                capture="environment"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && onUpload) onUpload(file);
                }}
              />
            </label>
          ) : (
            <button
              disabled={busy}
              onClick={() => onDecision('ACCEPTED')}
              className="min-h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {full
                ? 'Add my driver’s licence'
                : 'Photograph the useful section'}
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => onDecision('DECLINED')}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            {full ? 'Continue without document' : 'Enter information manually'}
          </button>
        </div>
      </div>
    );
  }
  if (action.type === 'ASK_GROUPED_DATAPOINTS')
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="mb-3 font-medium">A few details together</p>
        {action.datapoints.map((point) => (
          <p key={point.key} className="text-sm text-zinc-600">
            {point.label ?? display(point.key)}
          </p>
        ))}
      </div>
    );
  if (action.type === 'CONFIRM_DATAPOINT')
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="font-medium">Is this still correct?</p>
        <p className="mt-2 text-sm text-zinc-600">
          {action.datapoint.label ?? display(action.datapoint.key)}:{' '}
          <strong>{display(action.datapoint.value)}</strong>
        </p>
        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() =>
              onAnswer(action.datapoint.value, 'Yes, that is correct')
            }
            className="min-h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white"
          >
            Yes, correct
          </button>
          <button
            disabled={busy}
            onClick={() => onAnswer('', 'I need to change that')}
            className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium"
          >
            Change
          </button>
        </div>
      </div>
    );
  return <AskDatapoint action={action} onAnswer={onAnswer} busy={busy} />;
}

function AskDatapoint({
  action,
  onAnswer,
  busy,
}: {
  action: Extract<NextAction, { type: 'ASK_DATAPOINT' }>;
  onAnswer: ActionProps['onAnswer'];
  busy: boolean;
}) {
  const [value, setValue] = useState('');
  const label = action.datapoint.label ?? display(action.datapoint.key);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim())
      onAnswer(action.ui.inputType === 'NUMBER' ? Number(value) : value, value);
  };
  if (
    action.ui.inputType === 'SINGLE_CHOICE' ||
    action.ui.inputType === 'YES_NO'
  )
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
        <p className="font-medium">{label}?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(
            action.ui.options ??
            (action.ui.inputType === 'YES_NO' ? [true, false] : [])
          ).map((option) => (
            <button
              key={String(option)}
              disabled={busy}
              onClick={() => onAnswer(option, display(option))}
              className="min-h-12 rounded-xl border border-[var(--border)] px-4 text-left text-sm font-medium hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {display(option)}
            </button>
          ))}
        </div>
      </div>
    );
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[var(--border)] bg-white p-4"
    >
      <label className="block font-medium" htmlFor="datapoint-answer">
        {label}?
      </label>
      <input
        id="datapoint-answer"
        type={
          action.ui.inputType === 'NUMBER'
            ? 'number'
            : action.ui.inputType === 'DATE'
              ? 'date'
              : 'text'
        }
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-3 h-12 w-full rounded-xl border border-[var(--border)] px-3 outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]"
      />
      <button
        disabled={busy || !value.trim()}
        className="mt-3 min-h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        Continue
      </button>
    </form>
  );
}

type ChatMessage = {
  id: string;
  role: 'CUSTOMER' | 'NOVA';
  content?: string;
  action?: NextAction;
};

export default function ChatShell() {
  const [leadId, setLeadId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [action, setAction] = useState<NextAction>();
  const [completeness, setCompleteness] = useState(0);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
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
            conversation.messages.map((m) => ({
              id: m.id,
              role: m.role === 'CUSTOMER' ? 'CUSTOMER' : 'NOVA',
              content: m.content,
            })),
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
              {
                id: 'welcome',
                role: 'NOVA',
                content:
                  'Hi! Tell me what you need help with, in your own words.',
              },
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
        if (result.completeness)
          setCompleteness(result.completeness.completeness);
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
  const send = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || !leadId || busy) return;
    setInput('');
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'CUSTOMER', content: message },
    ]);
    setBusy(true);
    setError(undefined);
    try {
      const response: InteractionResponse = await api.interaction(
        leadId,
        message,
      );
      setCompleteness(response.completeness.completeness);
      setAction(response.nextAction);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'NOVA',
          content:
            response.metrics.acceptedCandidateDatapoints > 1
              ? 'Great — I was able to capture several details from that.'
              : 'Thanks — I have noted that.',
          action: response.nextAction,
        },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'That message could not be processed.',
      );
    } finally {
      setBusy(false);
    }
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
          : await api.answer(leadId, action.actionId, value, message);
      if ('completeness' in response)
        setCompleteness(response.completeness.completeness);
      setAction(response.nextAction);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'NOVA',
          content: 'Thanks — NOVA updated your dossier.',
          action: response.nextAction,
        },
      ]);
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
  if (loading)
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center">
        <Loader2
          className="animate-spin text-[var(--accent)]"
          aria-label="Loading NOVA"
        />
      </main>
    );
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col px-0 sm:px-6 sm:py-8">
      <section className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col overflow-hidden bg-white sm:min-h-[720px] sm:rounded-2xl sm:border sm:border-[var(--border)]">
        <header className="border-b border-[var(--border)] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
              <Sparkles className="size-4" /> NOVA
            </p>
            <span className="text-xs text-zinc-500">Auto insurance</span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <span className="text-xs text-zinc-500">{completeness}%</span>
          </div>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.role === 'CUSTOMER'
                  ? 'ml-auto max-w-[88%]'
                  : 'max-w-[92%]'
              }
            >
              <div
                className={
                  message.role === 'CUSTOMER'
                    ? 'rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-3 text-sm leading-6 text-white'
                    : 'rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 text-sm leading-6'
                }
              >
                {message.content}
              </div>
              {message.action &&
                actionKey(message.action) === actionKey(action) && (
                  <div className="mt-2">
                    <NextActionRenderer
                      action={message.action}
                      onAnswer={answer}
                      onDecision={decide}
                      onUpload={upload}
                      busy={busy}
                    />
                  </div>
                )}
            </div>
          ))}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
              <button
                onClick={() => void start()}
                className="ml-2 font-medium underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>
        <form
          onSubmit={send}
          className="sticky bottom-0 border-t border-[var(--border)] bg-white p-3 sm:p-4"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] p-2 focus-within:border-[var(--accent)]">
            <textarea
              aria-label="Message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              disabled={busy || !leadId}
              rows={1}
              placeholder="Tell NOVA in your own words…"
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
            />
            <button
              aria-label="Send message"
              disabled={busy || !input.trim() || !leadId}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="size-3.5" /> You stay in control of what you
            share.
          </p>
        </form>
      </section>
    </main>
  );
}
