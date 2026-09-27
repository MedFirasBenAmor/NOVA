'use client';

import { useEffect, useRef } from 'react';
import type { NextAction } from '@nova/shared-types';
import { AssistantMessage } from './assistant-message';
import { UserMessage } from './user-message';
import { SuggestionChips } from './suggestion-chips';
import { AnalysisProgressCard } from './analysis-progress-card';
import {
  NextActionRenderer,
  type ActionProps,
} from './next-action-renderer';
import { actionKey, type ChatMessage } from '@/lib/chat-helpers';

export type TranscriptProps = Omit<ActionProps, 'action'> & {
  action?: NextAction;
  messages: ChatMessage[];
  analyzing: boolean;
  error?: string;
  onRetry: () => void;
  onPickSuggestion: (suggestion: string) => void;
};

export function Transcript({
  messages,
  action,
  analyzing,
  error,
  onRetry,
  onPickSuggestion,
  onAnswer,
  onDecision,
  onReviewEdit,
  onUpload,
  busy,
}: TranscriptProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const mountedRef = useRef(false);
  const lastMessageCountRef = useRef(0);

  const updateNearBottom = () => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < 140;
    isNearBottomRef.current = nearBottom;
    return nearBottom;
  };

  const scrollToBottom = (behavior: ScrollBehavior) => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  };

  const afterRender = (callback: () => void) => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(callback);
      return;
    }
    window.setTimeout(callback, 0);
  };

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastMessageCountRef.current = messages.length;
      afterRender(() => scrollToBottom('auto'));
      return;
    }

    const messageAdded = messages.length > lastMessageCountRef.current;
    const lastMessage = messages[messages.length - 1];
    const shouldForce =
      messageAdded && lastMessage?.role === 'CUSTOMER';
    const shouldFollow = shouldForce || isNearBottomRef.current;

    lastMessageCountRef.current = messages.length;
    if (shouldFollow) {
      afterRender(() => scrollToBottom('smooth'));
    }
  }, [messages, action, analyzing, error]);

  const showSuggestions = messages.length <= 1 && !action;

  return (
    <div
      ref={scrollContainerRef}
      data-testid="conversation-scroll"
      onScroll={updateNearBottom}
      className="nova-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
    >
      {messages.map((message) => {
        const isCustomer = message.role === 'CUSTOMER';
        return (
          <div key={message.id} className={isCustomer ? 'flex justify-end' : ''}>
            {isCustomer ? (
              <UserMessage>{message.content}</UserMessage>
            ) : (
              <AssistantMessage>
                <div className="whitespace-pre-line">{message.content}</div>
                {message.action &&
                  actionKey(message.action) === actionKey(action) && (
                    <div className="mt-3">
                      <NextActionRenderer
                        action={message.action}
                        onAnswer={onAnswer}
                        onDecision={onDecision}
                        onReviewEdit={onReviewEdit}
                        onUpload={onUpload}
                        busy={busy}
                      />
                    </div>
                  )}
              </AssistantMessage>
            )}
          </div>
        );
      })}

      {analyzing && (
        <div className="flex items-start gap-2.5 sm:gap-3">
          <AnalysisProgressCard />
        </div>
      )}

      {showSuggestions && (
        <AssistantMessage>
          <div className="space-y-3">
            <p className="text-sm font-medium text-nova-navy">
              Comment voulez-vous commencer ?
            </p>
            <SuggestionChips onPick={onPickSuggestion} disabled={busy} />
          </div>
        </AssistantMessage>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
          <button
            type="button"
            onClick={onRetry}
            className="ml-2 font-medium underline"
          >
            Retry
          </button>
        </div>
      )}

      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
}
