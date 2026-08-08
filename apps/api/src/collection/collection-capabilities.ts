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
    id: 'DRIVER_LICENSE_FULL',
    type: 'FULL_DOCUMENT',
    documentType: 'DRIVER_LICENSE',
    entityType: EntityType.DRIVER,
    providesDatapoints: [
      'driver.first_name',
      'driver.last_name',
      'driver.date_of_birth',
      'driver.license_type',
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
