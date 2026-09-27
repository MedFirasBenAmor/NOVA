import {
  CollectionMethod,
  DatapointStatus,
  EntityType,
  Product,
  RequirementType,
  type DatapointDefinition,
  type DatapointValue,
  type Prisma,
} from '@prisma/client';
import type { CompletenessResponse, MissingReason } from '@nova/shared-types';
import { type ScopedEntityMap } from './entity-lifecycle.service';

type Definition = Pick<
  DatapointDefinition,
  | 'id'
  | 'key'
  | 'product'
  | 'entityType'
  | 'requirementType'
  | 'requiredWhen'
  | 'appliesToAdditionalEntities'
  | 'preferredCollectionMethods'
>;
type Value = Pick<
  DatapointValue,
  'definitionId' | 'entityType' | 'entityId' | 'value' | 'status'
> & { definition: Pick<DatapointDefinition, 'key'> };

type Condition = {
  key: string;
  operator: 'EQ' | 'IN';
  value: Prisma.JsonValue;
};

const usableStatuses = new Set<DatapointStatus>([
  DatapointStatus.CANDIDATE,
  DatapointStatus.EXTRACTED,
  DatapointStatus.INFERRED,
  DatapointStatus.ENRICHED,
  DatapointStatus.CONFIRMED,
  DatapointStatus.VALIDATED,
]);
const scopedEntities = new Set<EntityType>([
  EntityType.VEHICLE,
  EntityType.DRIVER,
  EntityType.PROPERTY,
  EntityType.CLAIM,
  EntityType.CO_APPLICANT,
]);

function isUsable(value: Value | undefined) {
  return Boolean(
    value && value.value !== null && usableStatuses.has(value.status),
  );
}

function isManuallyAskable(definition: Definition) {
  return (definition.preferredCollectionMethods ?? []).includes(
    CollectionMethod.MANUAL_QUESTION,
  );
}

function scopesFor(
  definition: Definition,
  values: Value[],
  scopedEntityIds: ScopedEntityMap,
) {
  if (!scopedEntities.has(definition.entityType)) return [undefined];
  const configuredIds = scopedEntityIds[definition.entityType];
  const canonicalIds =
    typeof configuredIds === 'string' ? [configuredIds] : configuredIds;
  if (canonicalIds?.length) {
    if (definition.entityType === EntityType.CLAIM) {
      return canonicalIds.filter(
        (entityId) =>
          scopedEntityIds.__claimDomains?.[entityId] === definition.product,
      );
    }
    if (
      definition.entityType === EntityType.DRIVER &&
      !definition.appliesToAdditionalEntities
    ) {
      // Primary driver only: the datapoint is not applicable to
      // additional/repeatable driver entities.
      return [canonicalIds[0]];
    }
    return canonicalIds;
  }
  const ids = [
    ...new Set(
      values
        .filter((value) => value.entityType === definition.entityType)
        .map((value) => value.entityId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  return ids.length ? ids : [undefined];
}

function conditionMatches(
  condition: Condition,
  definition: Definition,
  entityId: string | undefined,
  values: Value[],
) {
  const candidates = values.filter(
    (value) => value.definition.key === condition.key && isUsable(value),
  );
  const observed =
    candidates.find(
      (value) =>
        value.entityType === definition.entityType &&
        value.entityId === entityId,
    ) ??
    candidates.find((value) => value.entityId === null) ??
    candidates[0];
  if (!observed) return false;
  if (condition.operator === 'EQ') return observed.value === condition.value;
  return (
    Array.isArray(condition.value) && condition.value.includes(observed.value)
  );
}

export function resolveCompleteness(
  product: Product,
  definitions: Definition[],
  values: Value[],
  scopedEntityIds: ScopedEntityMap = {},
): CompletenessResponse {
  const known = values.filter(isUsable).map((value) => ({
    key: value.definition.key,
    entityType: value.entityType,
    ...(value.entityId ? { entityId: value.entityId } : {}),
  }));
  const missing: CompletenessResponse['missing'] = [];
  const conditionalRequired: CompletenessResponse['conditionalRequired'] = [];
  let requiredCount = 0;
  let knownRequiredCount = 0;

  for (const definition of definitions) {
    for (const entityId of scopesFor(definition, values, scopedEntityIds)) {
      let reason: MissingReason | undefined;
      let triggeredBy: string | undefined;

      if (definition.requirementType === RequirementType.REQUIRED) {
        reason = 'REQUIRED';
      } else if (definition.requirementType === RequirementType.OPTIONAL) {
        // Controlled askability: an OPTIONAL datapoint only reaches the
        // customer when the catalog explicitly allows manual questioning.
        // Otherwise it stays non-blocking and is left to extraction/derivation.
        reason = isManuallyAskable(definition) ? 'OPTIONAL' : undefined;
      } else if (
        definition.requirementType === RequirementType.CONDITIONAL &&
        definition.requiredWhen
      ) {
        const condition = definition.requiredWhen as unknown as Condition;
        if (conditionMatches(condition, definition, entityId, values)) {
          reason = 'CONDITIONAL';
          triggeredBy = condition.key;
          conditionalRequired.push({
            key: definition.key,
            entityType: definition.entityType,
            ...(entityId ? { entityId } : {}),
            triggeredBy,
          });
        }
      }

      if (!reason) continue;
      const current = values.find(
        (value) =>
          value.definitionId === definition.id &&
          value.entityId === (entityId ?? null),
      );
      if (current?.status === DatapointStatus.NOT_APPLICABLE) continue;

      // OPTIONAL askable datapoints are surfaced to the customer but never
      // block the completeness percentage: they are not counted as required.
      if (reason === 'OPTIONAL') {
        if (!isUsable(current)) {
          missing.push({
            key: definition.key,
            entityType: definition.entityType,
            ...(entityId ? { entityId } : {}),
            reason,
          });
        }
        continue;
      }

      requiredCount += 1;
      if (isUsable(current)) {
        knownRequiredCount += 1;
      } else {
        missing.push({
          key: definition.key,
          entityType: definition.entityType,
          ...(entityId ? { entityId } : {}),
          reason,
          ...(triggeredBy ? { triggeredBy } : {}),
        });
      }
    }
  }

  return {
    product,
    completeness:
      requiredCount === 0
        ? 100
        : Math.round((knownRequiredCount / requiredCount) * 100),
    known,
    missing,
    conditionalRequired,
  };
}
