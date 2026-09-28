import { EntityRelationType, EntityType } from '@prisma/client';
import type { InputContract } from '@nova/shared-types';

export type AutoFlowCard = {
  cardId: string;
  question: string;
  entityType: EntityType;
  datapointKeys: string[];
  input?: InputContract;
  groupedFields?: Array<{
    key: string;
    label: string;
    input: InputContract;
    optional?: boolean;
  }>;
  condition?: {
    key: string;
    operator: 'EQ' | 'IN';
    value: unknown;
  };
};

export const AUTO_CLOSING_TEXT =
  'Parfait, merci beaucoup pour votre temps et pour les informations.\n\nLe courtier va maintenant analyser votre dossier et comparer plusieurs assureurs afin de trouver les protections les mieux adaptées à votre situation.\n\nIl prendra le soin de vérifier les différentes options disponibles et communiquera avec vous rapidement pour vous présenter les résultats et répondre à vos questions.\n\nMerci encore de votre confiance et au plaisir de vous accompagner dans vos assurances.';

export const AUTO_ALLOWED_CUSTOMER_QUESTIONS = [
  'Quel est votre nom complet ?',
  'Quelle est votre adresse principale ?',
  'Quel est votre état civil ?',
  'Quelle est votre occupation principale ?',
  'À quelle date souhaitez-vous que votre assurance débute ?',
  'Quel est votre assureur automobile actuel ?',
  'Depuis combien de temps êtes-vous avec cet assureur ?',
  'Avez-vous le numéro de série du véhicule (NIV) ?',
  'Pouvez-vous me donner le numéro de série (17 caractères) ?',
  'Quelle est la marque du véhicule ?',
  'Quel est le modèle du véhicule ?',
  'Quelle est l’année du véhicule ?',
  'À quelle date avez-vous acheté ce véhicule ?',
  'Le véhicule était-il neuf ou usagé ?',
  'Quel était le kilométrage du véhicule à l’achat ?',
  'Quelle est la valeur approximative du véhicule ?',
  'Le véhicule est-il :',
  'Quel est le taux de financement ?',
  'Quel est le terme de la location ?',
  'Qui est le créancier ou locateur ?',
  'Quel est l’usage principal du véhicule ?',
  'Utilisez-vous le véhicule pour des activités commerciales ?',
  'Combien de kilomètres par année pour l’usage commercial ?',
  'Quel est le kilométrage annuel approximatif ?',
  'Le véhicule est-il utilisé à l’extérieur du Québec ?',
  'Le véhicule possède-t-il un système antivol ( TAG Sherlock,..) ?',
  'Avez-vous un deuxième véhicule à assurer ?',
  'Quel type de permis possède le conducteur principal ?',
  'Age de début de conduire au Québec ?',
  'Avez-vous eu une suspension de permis dans les 3 dernières années ?',
  'Y a-t-il eu une interruption d’assurance automobile ? ( règle depuis 6 mois non assuré en auto = interruption d’assurance)',
  'Une compagnie d’assurance vous a-t-elle déjà refusé ou annulé une police ?',
  'Avez-vous des antécédents criminels ?',
  'Avez-vous eu des sinistres automobiles dans les 6 dernières années ?',
  'Type de sinistre',
  'Année du sinistre',
  'Montant du sinistre',
  'Responsabilité',
  'Qui conduit principalement le véhicule 1 ?',
  'Quelles protections souhaitez-vous comparer ?',
  'Disposez-vous de l’assurance de remplacement ?',
  'Afin de préparer votre soumission et vérifier les protections disponibles, veuillez confirmer les autorisations suivantes.',
] as const;

const yesNo: InputContract = { type: 'YES_NO' };
const text: InputContract = { type: 'TEXT' };
const number: InputContract = { type: 'NUMBER' };
const date: InputContract = { type: 'DATE' };

const choice = (options: Array<string | [string, string]>): InputContract => ({
  type: 'SINGLE_CHOICE',
  options: options.map((option) =>
    Array.isArray(option)
      ? { value: option[0], label: option[1] }
      : { value: option, label: option },
  ),
});

const multiChoice = (
  options: Array<string | [string, string]>,
): InputContract => ({
  type: 'MULTI_CHOICE',
  options: options.map((option) =>
    Array.isArray(option)
      ? { value: option[0], label: option[1] }
      : { value: option, label: option },
  ),
});

export const AUTO_CUSTOMER_CARDS: AutoFlowCard[] = [
  {
    cardId: 'CARD_2',
    question: 'Quel est votre nom complet ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['customer.first_name', 'customer.last_name'],
    groupedFields: [
      { key: 'customer.first_name', label: 'Prénom', input: text },
      { key: 'customer.last_name', label: 'Nom de famille', input: text },
    ],
  },
  {
    cardId: 'CARD_3',
    question: 'Quelle est votre adresse principale ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: [
      'customer.address.civic_number',
      'customer.address.street',
      'customer.address.apartment',
      'customer.address.city',
      'customer.address.region',
      'customer.address.postal_code',
    ],
    groupedFields: [
      {
        key: 'customer.address.civic_number',
        label: 'Numéro civique',
        input: text,
      },
      { key: 'customer.address.street', label: 'Rue', input: text },
      {
        key: 'customer.address.apartment',
        label: 'Appartement (optionnel)',
        input: text,
        optional: true,
      },
      { key: 'customer.address.city', label: 'Ville', input: text },
      { key: 'customer.address.region', label: 'Province', input: text },
      {
        key: 'customer.address.postal_code',
        label: 'Code postal',
        input: text,
      },
    ],
  },
  {
    cardId: 'CARD_4',
    question: 'Quel est votre état civil ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['customer.marital_status'],
    input: choice([
      'Célibataire',
      'Marié',
      'Conjoint de fait',
      'Divorcé',
      'Séparé',
      'Veuf / Veuve',
    ]),
  },
  {
    cardId: 'CARD_5',
    question: 'Quelle est votre occupation principale ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['customer.occupation'],
    input: choice([
      'Administratif / Bureau',
      'Commerce de détail',
      'Construction / Métier manuel',
      'Éducation',
      'Étudiant',
      'Finance / Assurance',
      'Gestion / Direction',
      'Gouvernement',
      'Manufacturier',
      'Professionnel (comptable / avocat / ingénieur)',
      'Restauration / Hôtellerie',
      'Retraité',
      'Santé',
      'Sans emploi',
      'Technologie / Informatique',
      'Transport / Livraison',
      'Travailleur autonome',
      'Vente / Service clientèle',
      'Autre',
    ]),
  },
  {
    cardId: 'CARD_6',
    question: 'À quelle date souhaitez-vous que votre assurance débute ?',
    entityType: EntityType.REQUEST,
    datapointKeys: ['request.desired_coverage_date'],
    input: {
      type: 'DATE_CHOICE',
      options: [
        { value: 'TODAY', label: 'Aujourd’hui' },
        { value: 'FEW_DAYS', label: 'Dans quelques jours' },
        { value: 'SPECIFIC', label: 'Date spécifique' },
      ],
    },
  },
  {
    cardId: 'CARD_7',
    question: 'Quel est votre assureur automobile actuel ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['auto.current_insurer'],
    input: choice([
      'Intact',
      'Desjardins',
      'Beneva',
      'Promutuel',
      'Aviva',
      'Belairdirect',
      'Allstate',
      'TD Assurance',
      'Co-operators',
      'Economical',
      'Wawanesa',
      'Banque Nationale',
      'April',
      'Echelon',
      'Pafco',
      'Aucun actuellement',
      'Je ne sais pas',
    ]),
  },
  {
    cardId: 'CARD_8',
    question: 'Depuis combien de temps êtes-vous avec cet assureur ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['auto.current_insurer_tenure_band'],
    input: choice([
      ['LESS_THAN_1_YEAR', 'Moins de 1 an'],
      ['YEARS_1_TO_3', '1 à 3 ans'],
      ['YEARS_3_TO_5', '3 à 5 ans'],
      ['YEARS_5_PLUS', '5 ans et plus'],
    ]),
  },
];

export const AUTO_VEHICLE_CARDS: AutoFlowCard[] = [
  {
    cardId: 'CARD_9',
    question: 'Avez-vous le numéro de série du véhicule (NIV) ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.vin_available'],
    input: yesNo,
  },
  {
    cardId: 'CARD_10',
    question: 'Pouvez-vous me donner le numéro de série (17 caractères) ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.vin'],
    input: text,
    condition: { key: 'vehicle.vin_available', operator: 'EQ', value: true },
  },
  {
    cardId: 'CARD_11',
    question: 'Quelle est la marque du véhicule ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.make'],
    input: choice([
      'Toyota',
      'Honda',
      'Hyundai',
      'Kia',
      'Ford',
      'Chevrolet',
      'Nissan',
      'Mazda',
      'Volkswagen',
      'Subaru',
      'BMW',
      'Mercedes',
      'Audi',
      'Tesla',
      'Jeep',
      'Dodge',
      'GMC',
      'Autre',
    ]),
  },
  {
    cardId: 'CARD_12',
    question: 'Quel est le modèle du véhicule ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.model'],
    input: text,
  },
  {
    cardId: 'CARD_13',
    question: 'Quelle est l’année du véhicule ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.year'],
    input: number,
  },
  {
    cardId: 'CARD_14',
    question: 'À quelle date avez-vous acheté ce véhicule ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.purchase_or_lease_date'],
    input: date,
  },
  {
    cardId: 'CARD_15',
    question: 'Le véhicule était-il neuf ou usagé ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.acquisition_condition'],
    input: choice(['Neuf', 'Usagé', 'Démonstrateur']),
  },
  {
    cardId: 'CARD_16',
    question: 'Quel était le kilométrage du véhicule à l’achat ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.odometer_at_acquisition'],
    input: number,
  },
  {
    cardId: 'CARD_17',
    question: 'Quelle est la valeur approximative du véhicule ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.value_before_tax'],
    input: number,
  },
  {
    cardId: 'CARD_18',
    question: 'Le véhicule est-il :',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.financing_status'],
    input: choice(['Financé', 'Loué', 'Payé']),
  },
  {
    cardId: 'CARD_19',
    question: 'Quel est le taux de financement ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.financing_interest_rate'],
    input: number,
    condition: {
      key: 'vehicle.financing_status',
      operator: 'EQ',
      value: 'Financé',
    },
  },
  {
    cardId: 'CARD_20',
    question: 'Quel est le terme de la location ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.financing_term_months'],
    input: choice(['24 mois', '36 mois', '48 mois', '60 mois']),
    condition: {
      key: 'vehicle.financing_status',
      operator: 'EQ',
      value: 'Loué',
    },
  },
  {
    cardId: 'CARD_21',
    question: 'Qui est le créancier ou locateur ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.creditor_or_lessor_name'],
    input: choice([
      'BMO',
      'RBC',
      'TD',
      'CIBC',
      'Banque Nationale',
      'Scotia',
      'Toyota Finance',
      'Honda Finance',
      'Hyundai Finance',
      'Kia Finance',
      'Nissan Finance',
      'IA Financement Auto',
      'Ally Crédit',
      'OCM Auto Financing',
      'CreditFix',
      'Autre',
    ]),
    condition: {
      key: 'vehicle.financing_status',
      operator: 'IN',
      value: ['Financé', 'Loué'],
    },
  },
  {
    cardId: 'CARD_22',
    question: 'Quel est l’usage principal du véhicule ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.primary_use'],
    input: choice(['Promenade', 'Travail', 'École', 'Affaires']),
  },
  {
    cardId: 'CARD_23',
    question: 'Utilisez-vous le véhicule pour des activités commerciales ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.commercial_use_type'],
    input: choice(['Non', 'Uber', 'Livraison', 'Turo', 'Autre']),
  },
  {
    cardId: 'CARD_24',
    question: 'Combien de kilomètres par année pour l’usage commercial ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.commercial_annual_mileage'],
    input: number,
    condition: {
      key: 'vehicle.commercial_use_type',
      operator: 'IN',
      value: ['Uber', 'Livraison'],
    },
  },
  {
    cardId: 'CARD_25',
    question: 'Quel est le kilométrage annuel approximatif ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.annual_mileage_band'],
    input: choice([
      'Moins de 5 000 km',
      '5 000 à 10 000 km',
      '10 000 à 15 000 km',
      '15 000 à 20 000 km',
      '20 000 km +',
    ]),
  },
  {
    cardId: 'CARD_26',
    question: 'Le véhicule est-il utilisé à l’extérieur du Québec ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.used_outside_quebec'],
    input: yesNo,
  },
  {
    cardId: 'CARD_27',
    question:
      'Le véhicule possède-t-il un système antivol ( TAG Sherlock,..) ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.tracking_or_antitheft_system'],
    input: yesNo,
  },
];

export const AUTO_DRIVER_CARDS: AutoFlowCard[] = [
  {
    cardId: 'CARD_29',
    question: 'Quel type de permis possède le conducteur principal ?',
    entityType: EntityType.DRIVER,
    datapointKeys: ['driver.license_type'],
    input: choice([
      'Permis Québec',
      'Permis probatoire',
      'Permis apprenti',
      'Permis autre province',
      'Permis international',
    ]),
  },
  {
    cardId: 'CARD_30',
    question: 'Age de début de conduire au Québec ?',
    entityType: EntityType.DRIVER,
    datapointKeys: ['driver.driving_start_age_quebec'],
    input: number,
  },
  {
    cardId: 'CARD_31',
    question:
      'Avez-vous eu une suspension de permis dans les 3 dernières années ?',
    entityType: EntityType.DRIVER,
    datapointKeys: ['driver.license_suspended_last_3_years'],
    input: yesNo,
  },
  {
    cardId: 'CARD_32',
    question:
      'Y a-t-il eu une interruption d’assurance automobile ? ( règle depuis 6 mois non assuré en auto = interruption d’assurance)',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['auto.insurance_interruption_last_6_months'],
    input: yesNo,
  },
  {
    cardId: 'CARD_33',
    question:
      'Une compagnie d’assurance vous a-t-elle déjà refusé ou annulé une police ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['auto.cancelled_or_refused_last_3_years'],
    input: yesNo,
  },
  {
    cardId: 'CARD_34',
    question: 'Avez-vous des antécédents criminels ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['customer.has_criminal_record'],
    input: yesNo,
  },
  {
    cardId: 'CARD_35',
    question:
      'Avez-vous eu des sinistres automobiles dans les 6 dernières années ?',
    entityType: EntityType.CUSTOMER,
    datapointKeys: ['auto.has_claims_last_6_years'],
    input: yesNo,
  },
];

export const AUTO_CLAIM_CARDS: AutoFlowCard[] = [
  {
    cardId: 'CARD_36',
    question: 'Type de sinistre',
    entityType: EntityType.CLAIM,
    datapointKeys: ['claim.type'],
    input: choice([
      'Collision responsable',
      'Collision non responsable',
      'Vol',
      'Vandalisme',
      'Bris de glace',
      'Grêle',
      'Incendie',
      'Autre',
    ]),
  },
  {
    cardId: 'CARD_37',
    question: 'Année du sinistre',
    entityType: EntityType.CLAIM,
    datapointKeys: ['claim.year'],
    input: choice(lastSixYears()),
  },
  {
    cardId: 'CARD_38',
    question: 'Montant du sinistre',
    entityType: EntityType.CLAIM,
    datapointKeys: ['claim.amount'],
    input: number,
  },
  {
    cardId: 'CARD_39',
    question: 'Responsabilité',
    entityType: EntityType.CLAIM,
    datapointKeys: ['claim.responsibility'],
    input: choice(['Responsable', 'Non responsable', 'Partagée']),
  },
];

export const AUTO_PROTECTION_CARDS: AutoFlowCard[] = [
  {
    cardId: 'CARD_53',
    question: 'Quelles protections souhaitez-vous comparer ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.requested_coverages'],
    input: multiChoice([
      'Responsabilité civile : 2M$ / 1M$',
      'Collision',
      'Accident sans collision',
      'Tous risques',
      'Assistance routière',
    ]),
  },
  {
    cardId: 'CARD_54',
    question: 'Disposez-vous de l’assurance de remplacement ?',
    entityType: EntityType.VEHICLE,
    datapointKeys: ['vehicle.replacement_coverage'],
    input: choice([
      'Valeur a neuf FAQ 43',
      'Assurance remplacement FPQ5',
      'Aucune',
    ]),
  },
];

export const AUTO_CONSENT_CARD: AutoFlowCard = {
  cardId: 'CARD_55',
  question:
    'Afin de préparer votre soumission et vérifier les protections disponibles, veuillez confirmer les autorisations suivantes.',
  entityType: EntityType.CUSTOMER,
  datapointKeys: [
    'consent.credit_and_claims_check',
    'consent.data_use_quote_preparation',
    'consent.privacy_collection_use',
    'consent.communication',
  ],
  groupedFields: [
    {
      key: 'consent.credit_and_claims_check',
      label:
        'Vérification de crédit et dossier de sinistres\nJ’autorise la consultation de mon dossier de crédit et du Fichier Central des Sinistres Automobiles (FCSA) aux fins de tarification.',
      input: yesNo,
    },
    {
      key: 'consent.data_use_quote_preparation',
      label:
        'Utilisation des renseignements\nJ’autorise l’utilisation des informations fournies pour l’analyse de mon dossier et la préparation de ma soumission d’assurance.',
      input: yesNo,
    },
    {
      key: 'consent.privacy_collection_use',
      label:
        'Protection des renseignements personnels\nJe consens à la collecte et à l’utilisation de mes renseignements personnels conformément aux lois applicables.',
      input: yesNo,
    },
    {
      key: 'consent.communication',
      label:
        'Communication\nJ’accepte d’être contacté par téléphone, courriel ou message texte concernant ma demande de soumission.',
      input: yesNo,
    },
  ],
};

export const AUTO_RELATION = {
  relationType: EntityRelationType.DRIVER_VEHICLE_PRIMARY,
  questionForVehicle: (ordinal: number) =>
    `Qui conduit principalement le véhicule ${ordinal} ?`,
};

function lastSixYears() {
  const year = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, index) => String(year - index));
}
