export type HealthResponse = { status: 'ok' };

export type DatapointProduct = 'COMMON' | 'AUTO' | 'HOME' | 'AUTO_HOME';
export type SelectableProduct = 'AUTO' | 'HOME' | 'AUTO_HOME';
export type ProductDomain = 'AUTO' | 'HOME';
export type MissingReason = 'REQUIRED' | 'CONDITIONAL';

export type CompletenessItem = {
  key: string;
  entityType: string;
  entityId?: string;
};

export type MissingDatapoint = CompletenessItem & {
  reason: MissingReason;
  triggeredBy?: string;
};

export type CompletenessResponse = {
  product: DatapointProduct;
  completeness: number;
  known: CompletenessItem[];
  missing: MissingDatapoint[];
  conditionalRequired: Array<CompletenessItem & { triggeredBy: string }>;
};

export type ChoiceOption = {
  value: string;
  label: string;
};

export type InputContract =
  | { type: 'YES_NO' }
  | { type: 'SINGLE_CHOICE'; options: ChoiceOption[] }
  | { type: 'MULTI_CHOICE'; options: ChoiceOption[] }
  | { type: 'TEXT' }
  | { type: 'NUMBER' }
  | { type: 'DATE' }
  | { type: 'BUSINESS_VALIDATION_REQUIRED'; reason: string };

export type ReviewSectionItem = {
  kind: 'DATAPOINT' | 'INTAKE_FACT';
  key: string;
  label: string;
  value: unknown;
  displayValue: string;
  entityType?: IntelligenceEntityType;
  entityId?: string;
  entityLabel?: string;
  editable: boolean;
  input?: InputContract;
};

export type ReviewSectionGroup = {
  label: string;
  items: ReviewSectionItem[];
};

export type IntelligenceIntentType =
  | 'INSURANCE_SHOPPING'
  | 'NEW_ACQUISITION'
  | 'RENEWAL'
  | 'COMMERCIAL_VEHICLE_USE'
  | 'CLAIM_MENTIONED'
  | 'DOCUMENT_REFUSAL'
  | 'GENERAL_INQUIRY';

export type IntelligenceProductType = 'COMMON' | 'AUTO' | 'HOME' | 'AUTO_HOME';

export type IntelligenceEventType =
  | 'VEHICLE_PURCHASE'
  | 'COMMERCIAL_USE'
  | 'RENEWAL_MENTIONED'
  | 'CLAIM_MENTIONED'
  | 'DOCUMENT_UPLOAD_REFUSED';

export type IntelligenceExtractionMethod =
  'EXTRACTED' | 'ENRICHED' | 'INFERRED';
export type IntelligenceEntityType =
  | 'CUSTOMER'
  | 'VEHICLE'
  | 'DRIVER'
  | 'PROPERTY'
  | 'CLAIM'
  | 'CO_APPLICANT'
  | 'REQUEST';

export type IntelligenceCatalogItem = {
  key: string;
  label: string;
  dataType: string;
  entityType: IntelligenceEntityType;
  allowedValues?: unknown[];
};

export type IntelligenceKnownDatapoint = {
  key: string;
  value: unknown;
  entityType: IntelligenceEntityType;
  entityId?: string;
};

export type IntelligenceInput = {
  message: string;
  currentProduct?: IntelligenceProductType;
  entityContext?: {
    vehicleId?: string;
    driverId?: string;
    claimId?: string;
  };
  knownDatapoints: IntelligenceKnownDatapoint[];
  catalog: IntelligenceCatalogItem[];
};

export type IntelligenceCandidateDatapoint = {
  key: string;
  value: unknown;
  entityType: IntelligenceEntityType;
  entityId?: string;
  method: IntelligenceExtractionMethod;
  confidence: number;
  evidence?: string;
};

export type IntelligenceConfidence = { confidence: number };

export type IntelligenceResult = {
  intent: IntelligenceConfidence & { type: IntelligenceIntentType };
  product: IntelligenceConfidence & { type: IntelligenceProductType };
  events: Array<IntelligenceConfidence & { type: IntelligenceEventType }>;
  candidateDatapoints: IntelligenceCandidateDatapoint[];
};

export type NextAction =
  | {
      type: 'SUGGEST_FULL_DOCUMENT';
      actionId: string;
      documentType: string;
      entityType: IntelligenceEntityType;
      entityId?: string;
      coveredMissingDatapoints: string[];
      questionsPotentiallyAvoided: number;
      required: boolean;
      accepted?: boolean;
    }
  | {
      type: 'SUGGEST_TARGETED_CAPTURE';
      actionId: string;
      documentType: string;
      entityType: IntelligenceEntityType;
      entityId?: string;
      coveredMissingDatapoints: string[];
      questionsPotentiallyAvoided: number;
      required: boolean;
      accepted?: boolean;
    }
  | {
      type: 'ASK_DATAPOINT';
      actionId: string;
      datapoint: {
        key: string;
        entityType: IntelligenceEntityType;
        entityId?: string;
        label?: string;
        description?: string;
      };
      input: InputContract;
    }
  | {
      type: 'ASK_GROUPED_DATAPOINTS';
      actionId: string;
      datapoints: Array<{
        key: string;
        entityType: IntelligenceEntityType;
        entityId?: string;
        label?: string;
      }>;
    }
  | {
      type: 'CONFIRM_DATAPOINT';
      actionId: string;
      datapoint: {
        key: string;
        entityType: IntelligenceEntityType;
        entityId?: string;
        value: unknown;
        label?: string;
      };
    }
  | {
      type: 'WAIT_FOR_PROCESSING';
      documentId: string;
      documentType: string;
      status: 'UPLOADED' | 'PROCESSING';
    }
  | {
      type: 'SELECT_PRODUCT';
      actionId: string;
      options: Array<{ value: SelectableProduct; label: string }>;
    }
  | {
      type: 'ASK_CURRENT_INSURANCE';
      actionId: string;
      productDomain: ProductDomain;
      question: string;
      input: { type: 'YES_NO' };
    }
  | {
      type: 'ASK_POLICY_DOCUMENT';
      actionId: string;
      productDomain: ProductDomain;
      question: string;
      input: { type: 'YES_NO' };
    }
  | {
      type: 'ASK_ADD_ANOTHER_ENTITY';
      actionId: string;
      entityType: IntelligenceEntityType;
      domain?: ProductDomain;
      loopId: string;
      ordinal: number;
      label?: string;
      question: string;
      input: { type: 'YES_NO' };
    }
  | {
      type: 'REVIEW_SECTION';
      actionId: string;
      confirmationId: string;
      sectionCode: string;
      title: string;
      snapshotHash: string;
      groups: ReviewSectionGroup[];
    }
  | { type: 'COMPLETE'; actionId: string };
