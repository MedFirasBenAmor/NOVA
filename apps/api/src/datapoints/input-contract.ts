import { BadRequestException } from '@nestjs/common';
import { DataType, type DatapointDefinition } from '@prisma/client';
import type { ChoiceOption, InputContract } from '@nova/shared-types';

type Rules = {
  allowedValues?: unknown[];
  allowMultiple?: boolean;
  labels?: Record<string, string>;
};

export type ContractClassification =
  | 'YES_NO'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'BUSINESS_VALIDATION_REQUIRED';

export function buildInputContract(
  definition: Pick<DatapointDefinition, 'dataType' | 'validationRules' | 'key'>,
): InputContract {
  const rules = definition.validationRules as Rules | null;
  if (definition.dataType === DataType.BOOLEAN) return { type: 'YES_NO' };
  if (definition.dataType === DataType.STRING) return { type: 'TEXT' };
  if (definition.dataType === DataType.NUMBER) return { type: 'NUMBER' };
  if (definition.dataType === DataType.DATE) return { type: 'DATE' };
  if (definition.dataType === DataType.ENUM) {
    const options = choiceOptions(rules);
    if (!options.length) {
      return {
        type: 'BUSINESS_VALIDATION_REQUIRED',
        reason: `${definition.key} is ENUM but has no authoritative allowedValues`,
      };
    }
    return rules?.allowMultiple
      ? { type: 'MULTI_CHOICE', options }
      : { type: 'SINGLE_CHOICE', options };
  }
  return {
    type: 'BUSINESS_VALIDATION_REQUIRED',
    reason: `${definition.key} uses unsupported data type ${definition.dataType}`,
  };
}

export function classifyInputContract(
  definition: Pick<DatapointDefinition, 'dataType' | 'validationRules' | 'key'>,
): ContractClassification {
  return buildInputContract(definition).type;
}

export function validateValueAgainstInputContract(
  definition: Pick<DatapointDefinition, 'key' | 'dataType' | 'validationRules'>,
  value: unknown,
) {
  const input = buildInputContract(definition);
  if (input.type === 'BUSINESS_VALIDATION_REQUIRED') {
    throw new BadRequestException(input.reason);
  }
  if (input.type === 'YES_NO') {
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`${definition.key} requires true or false`);
    }
    return;
  }
  if (input.type === 'TEXT') {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${definition.key} requires text`);
    }
    return;
  }
  if (input.type === 'NUMBER') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${definition.key} requires a number`);
    }
    return;
  }
  if (input.type === 'DATE') {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
    ) {
      throw new BadRequestException(
        `${definition.key} requires an ISO date in YYYY-MM-DD format`,
      );
    }
    return;
  }
  if (input.type === 'SINGLE_CHOICE') {
    if (
      typeof value !== 'string' ||
      !input.options.some((option) => option.value === value)
    ) {
      throw new BadRequestException(
        `${definition.key} must be one of the catalog choices`,
      );
    }
    return;
  }
  if (input.type === 'MULTI_CHOICE') {
    if (
      !Array.isArray(value) ||
      value.some(
        (item) =>
          typeof item !== 'string' ||
          !input.options.some((option) => option.value === item),
      )
    ) {
      throw new BadRequestException(
        `${definition.key} must contain only catalog choices`,
      );
    }
  }
}

function choiceOptions(rules: Rules | null): ChoiceOption[] {
  return (rules?.allowedValues ?? [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => ({
      value,
      label: rules?.labels?.[value] ?? humanize(value),
    }));
}

function humanize(value: string) {
  return value
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (text) => text.toUpperCase());
}
