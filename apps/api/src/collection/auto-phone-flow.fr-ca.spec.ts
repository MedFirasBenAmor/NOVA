import {
  AUTO_ALLOWED_CUSTOMER_QUESTIONS,
  AUTO_CLAIM_CARDS,
  AUTO_CONSENT_CARD,
  AUTO_CUSTOMER_CARDS,
  AUTO_DRIVER_CARDS,
  AUTO_PROTECTION_CARDS,
  AUTO_VEHICLE_CARDS,
} from './auto-phone-flow.fr-ca';

function labels(cardId: string) {
  const card = [
    ...AUTO_CUSTOMER_CARDS,
    ...AUTO_VEHICLE_CARDS,
    ...AUTO_DRIVER_CARDS,
    ...AUTO_CLAIM_CARDS,
    ...AUTO_PROTECTION_CARDS,
    AUTO_CONSENT_CARD,
  ].find((candidate) => candidate.cardId === cardId);
  if (!card?.input || !('options' in card.input)) return [];
  return card.input.options.map((option) => option.label);
}

function values(cardId: string) {
  const card = [
    ...AUTO_CUSTOMER_CARDS,
    ...AUTO_VEHICLE_CARDS,
    ...AUTO_DRIVER_CARDS,
    ...AUTO_CLAIM_CARDS,
    ...AUTO_PROTECTION_CARDS,
    AUTO_CONSENT_CARD,
  ].find((candidate) => candidate.cardId === cardId);
  if (!card?.input || !('options' in card.input)) return [];
  return card.input.options.map((option) => option.value);
}

describe('AUTO canonical phone flow fr-CA', () => {
  it('keeps the customer-visible AUTO questions inside the PDF allow-list', () => {
    const emittedQuestions = [
      ...AUTO_CUSTOMER_CARDS,
      ...AUTO_VEHICLE_CARDS,
      {
        cardId: 'CARD_28',
        question: 'Avez-vous un deuxième véhicule à assurer ?',
      },
      ...AUTO_DRIVER_CARDS,
      ...AUTO_CLAIM_CARDS,
      {
        cardId: 'CARD_51',
        question: 'Qui conduit principalement le véhicule 1 ?',
      },
      ...AUTO_PROTECTION_CARDS,
      AUTO_CONSENT_CARD,
    ].map((card) => card.question);

    const extraQuestions = emittedQuestions.filter(
      (question) =>
        !AUTO_ALLOWED_CUSTOMER_QUESTIONS.some(
          (allowed) =>
            allowed === question ||
            (allowed === 'Qui conduit principalement le véhicule 1 ?' &&
              /^Qui conduit principalement le véhicule \d+ \?$/.test(question)),
        ),
    );

    expect(extraQuestions).toEqual([]);
  });

  it('orders the canonical AUTO cards according to the PDF sequence', () => {
    expect(AUTO_CUSTOMER_CARDS.map((card) => card.cardId)).toEqual([
      'CARD_2',
      'CARD_3',
      'CARD_4',
      'CARD_5',
      'CARD_6',
      'CARD_7',
      'CARD_8',
    ]);
    expect(AUTO_VEHICLE_CARDS.map((card) => card.cardId)).toEqual([
      'CARD_9',
      'CARD_10',
      'CARD_11',
      'CARD_12',
      'CARD_13',
      'CARD_14',
      'CARD_15',
      'CARD_16',
      'CARD_17',
      'CARD_18',
      'CARD_19',
      'CARD_20',
      'CARD_21',
      'CARD_22',
      'CARD_23',
      'CARD_24',
      'CARD_25',
      'CARD_26',
      'CARD_27',
    ]);
    expect(AUTO_DRIVER_CARDS.map((card) => card.cardId)).toEqual([
      'CARD_29',
      'CARD_30',
      'CARD_31',
      'CARD_32',
      'CARD_33',
      'CARD_34',
      'CARD_35',
    ]);
    expect(AUTO_CLAIM_CARDS.map((card) => card.cardId)).toEqual([
      'CARD_36',
      'CARD_37',
      'CARD_38',
      'CARD_39',
    ]);
    expect(AUTO_PROTECTION_CARDS.map((card) => card.cardId)).toEqual([
      'CARD_53',
      'CARD_54',
    ]);
  });

  it('matches exact options for representative branch cards', () => {
    expect(labels('CARD_4')).toEqual([
      'Célibataire',
      'Marié',
      'Conjoint de fait',
      'Divorcé',
      'Séparé',
      'Veuf / Veuve',
    ]);
    expect(labels('CARD_23')).toEqual([
      'Non',
      'Uber',
      'Livraison',
      'Turo',
      'Autre',
    ]);
    expect(labels('CARD_25')).toEqual([
      'Moins de 5 000 km',
      '5 000 à 10 000 km',
      '10 000 à 15 000 km',
      '15 000 à 20 000 km',
      '20 000 km +',
    ]);
    expect(labels('CARD_54')).toEqual([
      'Valeur a neuf FAQ 43',
      'Assurance remplacement FPQ5',
      'Aucune',
    ]);
  });

  it('keeps CARD 8 as exact visible labels backed by lossless tenure-band values', () => {
    const card = AUTO_CUSTOMER_CARDS.find(
      (candidate) => candidate.cardId === 'CARD_8',
    );
    expect(card?.question).toBe(
      'Depuis combien de temps êtes-vous avec cet assureur ?',
    );
    expect(card?.datapointKeys).toEqual(['auto.current_insurer_tenure_band']);
    expect(labels('CARD_8')).toEqual([
      'Moins de 1 an',
      '1 à 3 ans',
      '3 à 5 ans',
      '5 ans et plus',
    ]);
    expect(values('CARD_8')).toEqual([
      'LESS_THAN_1_YEAR',
      'YEARS_1_TO_3',
      'YEARS_3_TO_5',
      'YEARS_5_PLUS',
    ]);
    expect(values('CARD_8').every((value) => typeof value === 'string')).toBe(
      true,
    );
  });

  it.each([
    ['CARD_9', 'vehicle.vin_available'],
    ['CARD_26', 'vehicle.used_outside_quebec'],
    ['CARD_27', 'vehicle.tracking_or_antitheft_system'],
    ['CARD_31', 'driver.license_suspended_last_3_years'],
    ['CARD_32', 'auto.insurance_interruption_last_6_months'],
    ['CARD_33', 'auto.cancelled_or_refused_last_3_years'],
    ['CARD_34', 'customer.has_criminal_record'],
    ['CARD_35', 'auto.has_claims_last_6_years'],
  ])('keeps %s as a canonical boolean Oui/Non card', (cardId, key) => {
    const card = [
      ...AUTO_CUSTOMER_CARDS,
      ...AUTO_VEHICLE_CARDS,
      ...AUTO_DRIVER_CARDS,
      ...AUTO_CLAIM_CARDS,
      ...AUTO_PROTECTION_CARDS,
      AUTO_CONSENT_CARD,
    ].find((candidate) => candidate.cardId === cardId);
    expect(card?.datapointKeys).toEqual([key]);
    expect(card?.input).toEqual({ type: 'YES_NO' });
  });

  it('does not map canonical semantic booleans to narrower legacy fields', () => {
    const card26 = AUTO_VEHICLE_CARDS.find(
      (candidate) => candidate.cardId === 'CARD_26',
    );
    const card32 = AUTO_DRIVER_CARDS.find(
      (candidate) => candidate.cardId === 'CARD_32',
    );
    expect(card26?.datapointKeys).toEqual(['vehicle.used_outside_quebec']);
    expect(card26?.datapointKeys).not.toContain(
      'vehicle.outside_quebec_more_than_30_days',
    );
    expect(card32?.datapointKeys).toEqual([
      'auto.insurance_interruption_last_6_months',
    ]);
    expect(card32?.datapointKeys).not.toContain(
      'auto.interruption_for_non_payment',
    );
  });

  it('marks only the apartment field optional on the grouped address card', () => {
    const card = AUTO_CUSTOMER_CARDS.find(
      (candidate) => candidate.cardId === 'CARD_3',
    );
    expect(card?.question).toBe('Quelle est votre adresse principale ?');
    expect(card?.groupedFields?.filter((field) => field.optional)).toEqual([
      expect.objectContaining({ key: 'customer.address.apartment' }),
    ]);
    expect(
      card?.groupedFields
        ?.filter((field) => !field.optional)
        .map((field) => field.key),
    ).toEqual([
      'customer.address.civic_number',
      'customer.address.street',
      'customer.address.city',
      'customer.address.region',
      'customer.address.postal_code',
    ]);
  });

  it('does not include known non-PDF NOVA questions in the canonical config', () => {
    const serialized = JSON.stringify({
      AUTO_CUSTOMER_CARDS,
      AUTO_VEHICLE_CARDS,
      AUTO_DRIVER_CARDS,
      AUTO_CLAIM_CARDS,
      AUTO_PROTECTION_CARDS,
      AUTO_CONSENT_CARD,
    });
    expect(serialized).not.toContain('Request type');
    expect(serialized).not.toContain('First name');
    expect(serialized).not.toContain('Last name');
    expect(serialized).not.toContain('Do you want to add another driver');
    expect(serialized).not.toContain('Do you want to add another claim');
    expect(serialized).not.toContain('Winter tires');
    expect(serialized).not.toContain('Garage location');
    expect(serialized).not.toContain('Claim description');
  });
});
