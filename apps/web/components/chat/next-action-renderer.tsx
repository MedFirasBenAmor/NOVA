'use client';

import { FormEvent, useState } from 'react';
import { Check, FileText, Loader2, ScanLine } from 'lucide-react';
import type { NextAction, ReviewSectionItem } from '@nova/shared-types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { display } from '@/lib/chat-helpers';
import { cn } from '@/lib/utils';

export type ActionProps = {
  action: NextAction;
  onAnswer: (value: unknown, message: string) => void;
  onDecision: (decision: 'ACCEPTED' | 'DECLINED' | 'SKIPPED') => void;
  onReviewEdit?: (item: ReviewSectionItem, value: unknown) => void;
  onUpload?: (file: File) => void;
  busy: boolean;
};

export function NextActionRenderer({
  action,
  onAnswer,
  onDecision,
  onReviewEdit,
  onUpload,
  busy,
}: ActionProps) {
  if (action.type === 'COMPLETE')
    return (
      <Card
        surface="secondary"
        padding="lg"
        className="border-emerald-200 bg-nova-success-bg"
      >
        <Check className="mb-2 size-5 text-nova-success" aria-hidden="true" />
        <p className="font-medium text-nova-navy">
          Great — NOVA has the information currently required for this step.
        </p>
        <p className="mt-1 text-sm text-nova-success">
          This is a completeness milestone, not an eligibility or approval
          decision.
        </p>
      </Card>
    );

  if (action.type === 'SELECT_PRODUCT')
    return (
      <Card padding="lg">
        <p className="font-medium text-nova-navy">
          Choose what you want to insure
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {action.options.map((option) => (
            <Button
              key={option.value}
              variant="secondary"
              size="md"
              disabled={busy}
              onClick={() => onAnswer(option.value, option.label)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>
    );

  if (action.type === 'WAIT_FOR_PROCESSING')
    return <ProcessingCard action={action} />;

  if (action.type === 'REVIEW_SECTION')
    return (
      <ReviewSection
        action={action}
        onAnswer={onAnswer}
        onReviewEdit={onReviewEdit}
        busy={busy}
      />
    );

  if (
    action.type === 'ASK_CURRENT_INSURANCE' ||
    action.type === 'ASK_POLICY_DOCUMENT' ||
    action.type === 'ASK_ADD_ANOTHER_ENTITY'
  ) {
    const isVehicleAddAnother =
      action.type === 'ASK_ADD_ANOTHER_ENTITY' &&
      action.entityType === 'VEHICLE';
    const yesLabel = isVehicleAddAnother ? 'Oui' : 'Yes';
    const noLabel = isVehicleAddAnother ? 'Non' : 'No';
    return (
      <Card padding="lg">
        {isVehicleAddAnother && action.ordinal > 1 && action.label ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-nova-muted">
            {action.label}
          </p>
        ) : null}
        <p className="font-medium text-nova-navy">{action.question}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => onAnswer(true, yesLabel)}
          >
            {yesLabel}
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => onAnswer(false, noLabel)}
          >
            {noLabel}
          </Button>
        </div>
      </Card>
    );
  }

  if (action.type === 'ASSIGN_ENTITY_RELATION')
    return (
      <Card padding="lg">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-nova-muted">
          {action.vehicleLabel}
        </p>
        <p className="font-medium text-nova-navy">{action.question}</p>
        {action.input.type === 'YES_NO' ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              size="md"
              disabled={busy}
              onClick={() => onAnswer(true, 'Oui')}
            >
              Oui
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={busy}
              onClick={() => onAnswer(false, 'Non')}
            >
              Non
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2">
            {(action.options ?? []).map((option) => (
              <Button
                key={option.entityId}
                variant="secondary"
                size="md"
                disabled={busy}
                onClick={() => onAnswer(option.entityId, option.label)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </Card>
    );

  if (
    action.type === 'SUGGEST_FULL_DOCUMENT' ||
    action.type === 'SUGGEST_TARGETED_CAPTURE'
  ) {
    const full = action.type === 'SUGGEST_FULL_DOCUMENT';
    return (
      <Card padding="lg" className="border-nova-purple/25">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-nova-purple-bg text-nova-purple">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-medium text-nova-navy">
              {full
                ? 'Share a document to avoid several questions'
                : 'Share only the useful section'}
            </p>
            <p className="mt-1 text-sm leading-6 text-nova-muted">
              {full
                ? 'You can optionally share your driver’s licence so NOVA can pre-fill some missing information.'
                : 'No problem — you do not need to share the entire document. You can photograph only the part containing the information NOVA needs.'}
            </p>
            <p className="mt-2 text-xs text-nova-muted">
              This could avoid around {action.questionsPotentiallyAvoided}{' '}
              manual questions.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {action.accepted ? (
            <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-nova-blue px-5 text-sm font-semibold text-white shadow-token-sm transition-colors hover:bg-nova-blue-strong focus-within:outline-none focus-within:ring-2 focus-within:ring-nova-blue focus-within:ring-offset-2">
              Choose a file
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.heic,.pdf"
                capture="environment"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && onUpload) onUpload(file);
                  event.target.value = '';
                }}
              />
            </label>
          ) : (
            <Button
              size="md"
              disabled={busy}
              onClick={() => onDecision('ACCEPTED')}
            >
              {full
                ? 'Add my driver’s licence'
                : 'Photograph the useful section'}
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => onDecision('DECLINED')}
          >
            {full ? 'Continue without document' : 'Enter information manually'}
          </Button>
        </div>
      </Card>
    );
  }

  if (action.type === 'ASK_GROUPED_DATAPOINTS')
    return (
      <GroupedDatapoints
        action={action}
        onAnswer={onAnswer}
        busy={busy}
      />
    );

  if (action.type === 'CONFIRM_DATAPOINT')
    return (
      <Card padding="lg">
        <p className="font-medium text-nova-navy">Is this still correct?</p>
        <p className="mt-2 text-sm text-nova-muted">
          {action.datapoint.label ?? display(action.datapoint.key)}:{' '}
          <strong className="text-nova-navy">
            {display(action.datapoint.value)}
          </strong>
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            size="md"
            disabled={busy}
            onClick={() =>
              onAnswer(action.datapoint.value, 'Yes, that is correct')
            }
          >
            Yes, correct
          </Button>
          <Button
            variant="secondary"
            size="md"
            disabled={busy}
            onClick={() => onAnswer('', 'I need to change that')}
          >
            Change
          </Button>
        </div>
      </Card>
    );

  return <AskDatapoint action={action} onAnswer={onAnswer} busy={busy} />;
}

function GroupedDatapoints({
  action,
  onAnswer,
  busy,
}: {
  action: Extract<NextAction, { type: 'ASK_GROUPED_DATAPOINTS' }>;
  onAnswer: ActionProps['onAnswer'];
  busy: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const fields = action.datapoints;
  const complete = fields.every((field) => (values[field.key] ?? '').trim());
  const submit = async () => {
    if (!complete || busy) return;
    setSubmitting(true);
    await onAnswer(values, action.title ?? 'Identité du conducteur');
    setSubmitting(false);
  };
  return (
    <Card padding="lg">
      <p className="mb-3 font-medium text-nova-navy">
        {action.title ?? 'A few details together'}
      </p>
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label
              className="block text-sm font-medium text-nova-navy"
              htmlFor={`grouped-${field.key}`}
            >
              {field.label ?? display(field.key)}
            </label>
            <input
              id={`grouped-${field.key}`}
              type={
                field.input?.type === 'NUMBER'
                  ? 'number'
                  : field.input?.type === 'DATE'
                    ? 'date'
                    : 'text'
              }
              value={values[field.key] ?? ''}
              disabled={busy || submitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value,
                }))
              }
              className="mt-1 h-12 w-full rounded-2xl border border-nova-border px-3 text-sm text-nova-navy outline-none focus:border-nova-blue focus:ring-2 focus:ring-nova-blue/15"
            />
          </div>
        ))}
      </div>
      <Button
        size="md"
        disabled={busy || submitting || !complete}
        onClick={submit}
        className="mt-4"
      >
        Continue
      </Button>
    </Card>
  );
}

function ProcessingCard({
  action,
}: {
  action: Extract<NextAction, { type: 'WAIT_FOR_PROCESSING' }>;
}) {
  // The card title already reads "Document received."; the pipeline below
  // starts at the OCR step to avoid duplicating that string in the DOM.
  const steps = [
    {
      label: 'Reading the document (OCR)',
      done: action.status === 'PROCESSING',
    },
    { label: 'Extracting key information', done: false },
  ];
  return (
    <Card padding="lg" className="border-nova-purple/25">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-nova-purple-bg text-nova-purple">
          {action.status === 'PROCESSING' ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ScanLine className="size-5" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="font-medium text-nova-navy">Document received.</p>
          <p className="mt-0.5 text-sm text-nova-muted">
            NOVA will analyze it before asking for information that may already
            be present.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full text-white',
                step.done ? 'bg-nova-success' : 'bg-nova-border',
              )}
              aria-hidden="true"
            >
              {step.done && <Check className="size-3" />}
            </span>
            <span className={step.done ? 'text-nova-navy' : 'text-nova-muted'}>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReviewSection({
  action,
  onAnswer,
  onReviewEdit,
  busy,
}: {
  action: Extract<NextAction, { type: 'REVIEW_SECTION' }>;
  onAnswer: ActionProps['onAnswer'];
  onReviewEdit?: ActionProps['onReviewEdit'];
  busy: boolean;
}) {
  const [editing, setEditing] = useState<string>();
  const [draft, setDraft] = useState('');
  const startEdit = (item: ReviewSectionItem) => {
    setEditing(`${item.key}:${item.entityId ?? 'ROOT'}`);
    setDraft(String(item.value ?? ''));
  };
  const submitEdit = (event: FormEvent, item: ReviewSectionItem) => {
    event.preventDefault();
    if (!onReviewEdit) return;
    const value =
      item.input?.type === 'NUMBER'
        ? Number(draft)
        : item.input?.type === 'YES_NO'
          ? draft === 'true'
          : draft;
    onReviewEdit(item, value);
    setEditing(undefined);
  };
  return (
    <Card padding="lg">
      <p className="text-base font-semibold text-nova-navy">{action.title}</p>
      <div className="mt-4 space-y-4">
        {action.groups.map((group) => (
          <div key={group.label} className="border-t border-nova-border pt-3">
            <p className="text-xs font-semibold uppercase text-nova-muted">
              {group.label}
            </p>
            <div className="mt-2 space-y-2">
              {group.items.map((item) => {
                const editKey = `${item.key}:${item.entityId ?? 'ROOT'}`;
                const isEditing = editing === editKey;
                return (
                  <div
                    key={editKey}
                    className="rounded-2xl border border-nova-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-nova-navy">
                          {item.label}
                        </p>
                        {!isEditing && (
                          <p className="mt-1 text-sm text-nova-muted">
                            {item.displayValue}
                          </p>
                        )}
                      </div>
                      {item.editable && onReviewEdit && !isEditing && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    {isEditing && (
                      <form
                        className="mt-3 flex flex-col gap-2 sm:flex-row"
                        onSubmit={(event) => submitEdit(event, item)}
                      >
                        <ReviewEditInput
                          item={item}
                          value={draft}
                          onChange={setDraft}
                        />
                        <Button type="submit" size="md" disabled={busy}>
                          Save
                        </Button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button
        variant="navy"
        size="lg"
        disabled={busy}
        onClick={() =>
          onAnswer(
            { snapshotHash: action.snapshotHash },
            'These details are correct',
          )
        }
        className="mt-4 w-full"
      >
        These details are correct
      </Button>
    </Card>
  );
}

function ReviewEditInput({
  item,
  value,
  onChange,
}: {
  item: ReviewSectionItem;
  value: string;
  onChange: (value: string) => void;
}) {
  const className =
    'min-h-10 flex-1 rounded-2xl border border-nova-border px-3 text-sm text-nova-navy outline-none focus:border-nova-blue focus:ring-2 focus:ring-nova-blue/15';
  if (item.input?.type === 'YES_NO')
    return (
      <select
        aria-label={item.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  if (item.input?.type === 'SINGLE_CHOICE')
    return (
      <select
        aria-label={item.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {item.input.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  if (item.input?.type === 'BUSINESS_VALIDATION_REQUIRED')
    return (
      <p role="alert" className="text-sm text-red-700">
        This field needs catalog configuration before it can be edited.
      </p>
    );
  return (
    <input
      aria-label={item.label}
      type={
        item.input?.type === 'NUMBER'
          ? 'number'
          : item.input?.type === 'DATE'
            ? 'date'
            : 'text'
      }
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
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
  const [multiValue, setMultiValue] = useState<string[]>([]);
  const label = action.datapoint.label ?? display(action.datapoint.key);
  const entityLabel = action.datapoint.entityLabel ? (
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-nova-muted">
      {action.datapoint.entityLabel}
    </p>
  ) : null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim())
      onAnswer(action.input.type === 'NUMBER' ? Number(value) : value, value);
  };
  if (action.input.type === 'BUSINESS_VALIDATION_REQUIRED')
    return (
      <Card padding="lg" className="border-red-200 bg-red-50">
        <p role="alert" className="text-sm text-red-800">
          This question needs catalog configuration before NOVA can ask it.
        </p>
      </Card>
    );
  if (action.input.type === 'MULTI_CHOICE')
    return (
      <Card padding="lg">
        {entityLabel}
        <p className="font-medium text-nova-navy">{label}?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {action.input.options.map((option) => {
            const checked = multiValue.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-colors',
                  checked
                    ? 'border-nova-blue bg-nova-blue-light text-nova-blue'
                    : 'border-nova-border text-nova-navy hover:border-nova-blue',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  className="accent-nova-blue"
                  onChange={(event) =>
                    setMultiValue((current) =>
                      event.target.checked
                        ? [...current, option.value]
                        : current.filter((value) => value !== option.value),
                    )
                  }
                />
                {option.label}
              </label>
            );
          })}
        </div>
        <Button
          size="md"
          disabled={busy}
          onClick={() => onAnswer(multiValue, multiValue.join(', '))}
          className="mt-3"
        >
          Continue
        </Button>
      </Card>
    );
  if (action.input.type === 'SINGLE_CHOICE' || action.input.type === 'YES_NO')
    return (
      <Card padding="lg">
        {entityLabel}
        <p className="font-medium text-nova-navy">{label}?</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(action.input.type === 'YES_NO'
            ? [
                { value: true, label: 'Yes' },
                { value: false, label: 'No' },
              ]
            : action.input.options
          ).map((option) => (
            <Button
              key={String(option.value)}
              variant="secondary"
              size="md"
              disabled={busy}
              onClick={() => onAnswer(option.value, option.label)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </Card>
    );
  return (
    <form onSubmit={submit}>
      <Card padding="lg">
        {entityLabel}
        <label
          className="block font-medium text-nova-navy"
          htmlFor="datapoint-answer"
        >
          {label}?
        </label>
        <input
          id="datapoint-answer"
          type={
            action.input.type === 'NUMBER'
              ? 'number'
              : action.input.type === 'DATE'
                ? 'date'
                : 'text'
          }
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-3 h-12 w-full rounded-2xl border border-nova-border px-3 text-sm text-nova-navy outline-none focus:border-nova-blue focus:ring-2 focus:ring-nova-blue/15"
        />
        <Button
          type="submit"
          size="md"
          disabled={busy || !value.trim()}
          className="mt-3"
        >
          Continue
        </Button>
      </Card>
    </form>
  );
}
