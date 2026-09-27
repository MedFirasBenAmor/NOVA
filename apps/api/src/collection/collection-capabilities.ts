import { CollectionActionType, EntityType } from '@prisma/client';

export type CollectionCapability = {
  id: string;
  type: 'FULL_DOCUMENT' | 'TARGETED_CAPTURE';
  documentType: string;
  entityType: EntityType;
  providesDatapoints: string[];
  priority: number;
  consentRequired: boolean;
};

export const COLLECTION_CAPABILITIES: CollectionCapability[] = [
  {
    id: 'CURRENT_AUTO_POLICY_FULL',
    type: 'FULL_DOCUMENT',
    documentType: 'CURRENT_AUTO_POLICY',
    // Every provided datapoint is CUSTOMER-scoped; REQUEST no longer exists as
    // a dossier entity scope for these fields.
    entityType: EntityType.CUSTOMER,
    providesDatapoints: [
      'auto.current_insurer',
      'auto.years_with_current_insurer',
      'auto.prior_policy_expiry_date',
      'auto.liability_limit_requested',
    ],
    priority: 10,
    consentRequired: true,
  },
  {
    id: 'DRIVER_LICENSE_FULL',
    type: 'FULL_DOCUMENT',
    documentType: 'DRIVER_LICENSE',
    entityType: EntityType.DRIVER,
    // driver.license_type is deliberately excluded: current OCR cannot read it
    // reliably, so the capability must not promise it. Full licence schema is
    // Phase 5.
    providesDatapoints: [
      'driver.first_name',
      'driver.last_name',
      'driver.date_of_birth',
    ],
    priority: 30,
    consentRequired: true,
  },
  {
    id: 'DRIVER_LICENSE_TARGETED',
    type: 'TARGETED_CAPTURE',
    documentType: 'DRIVER_LICENSE',
    entityType: EntityType.DRIVER,
    providesDatapoints: [
      'driver.first_name',
      'driver.last_name',
      'driver.date_of_birth',
    ],
    priority: 40,
    consentRequired: true,
  },
];

export function actionTypeFor(
  capability: CollectionCapability,
): CollectionActionType {
  return capability.type === 'FULL_DOCUMENT'
    ? CollectionActionType.SUGGEST_FULL_DOCUMENT
    : CollectionActionType.SUGGEST_TARGETED_CAPTURE;
}
