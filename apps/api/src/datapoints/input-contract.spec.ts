import { readFileSync } from 'node:fs';
import { DataType } from '@prisma/client';
import {
  buildInputContract,
  validateValueAgainstInputContract,
} from './input-contract';

function count(pattern: RegExp) {
  return (readFileSync('prisma/seed.ts', 'utf8').match(pattern) ?? []).length;
}

describe('InputContractBuilder', () => {
  it('classifies the complete R6 catalog shape explicitly', () => {
    const total = count(/dataType: DataType\./g);
    const boolean = count(/dataType: DataType\.BOOLEAN/g);
    const text = count(/dataType: DataType\.STRING/g);
    const number = count(/dataType: DataType\.NUMBER/g);
    const date = count(/dataType: DataType\.DATE/g);
    const enums = count(/dataType: DataType\.ENUM/g);
    const finiteEnums = count(/allowedValues:/g);
    const object = count(/dataType: DataType\.OBJECT/g);

    expect(total).toBe(164);
    expect(boolean).toBe(44);
    expect(text).toBe(48);
    expect(number).toBe(27);
    expect(date).toBe(11);
    expect(enums).toBe(29);
    expect(finiteEnums).toBe(29);
    expect(object).toBe(5);
    expect(enums - finiteEnums + object).toBe(5);
  });

  it('builds deterministic contracts for every supported datatype', () => {
    expect(
      buildInputContract({
        key: 'boolean',
        dataType: DataType.BOOLEAN,
        validationRules: null,
      }),
    ).toEqual({ type: 'YES_NO' });
    expect(
      buildInputContract({
        key: 'choice',
        dataType: DataType.ENUM,
        validationRules: { allowedValues: ['FINANCED'] },
      }),
    ).toEqual({
      type: 'SINGLE_CHOICE',
      options: [{ value: 'FINANCED', label: 'Financed' }],
    });
    expect(
      buildInputContract({
        key: 'multi',
        dataType: DataType.ENUM,
        validationRules: { allowedValues: ['A'], allowMultiple: true },
      }),
    ).toEqual({
      type: 'MULTI_CHOICE',
      options: [{ value: 'A', label: 'A' }],
    });
    expect(
      buildInputContract({
        key: 'date',
        dataType: DataType.DATE,
        validationRules: null,
      }),
    ).toEqual({ type: 'DATE' });
    expect(
      buildInputContract({
        key: 'number',
        dataType: DataType.NUMBER,
        validationRules: null,
      }),
    ).toEqual({ type: 'NUMBER' });
    expect(
      buildInputContract({
        key: 'text',
        dataType: DataType.STRING,
        validationRules: null,
      }),
    ).toEqual({ type: 'TEXT' });
  });

  it('classifies empty enums and object fields as business validation required', () => {
    expect(
      buildInputContract({
        key: 'customer.gender',
        dataType: DataType.ENUM,
        validationRules: null,
      }),
    ).toMatchObject({ type: 'BUSINESS_VALIDATION_REQUIRED' });
    expect(
      buildInputContract({
        key: 'vehicle.requested_coverages',
        dataType: DataType.OBJECT,
        validationRules: null,
      }),
    ).toMatchObject({ type: 'BUSINESS_VALIDATION_REQUIRED' });
  });

  it('rejects non-canonical booleans and finite choices', () => {
    const boolean = {
      key: 'bool',
      dataType: DataType.BOOLEAN,
      validationRules: null,
    };
    expect(() =>
      validateValueAgainstInputContract(boolean, true),
    ).not.toThrow();
    expect(() =>
      validateValueAgainstInputContract(boolean, false),
    ).not.toThrow();
    expect(() => validateValueAgainstInputContract(boolean, 'true')).toThrow();
    expect(() => validateValueAgainstInputContract(boolean, 'yes')).toThrow();
    expect(() => validateValueAgainstInputContract(boolean, 1)).toThrow();

    const choice = {
      key: 'vehicle.financing_status',
      dataType: DataType.ENUM,
      validationRules: { allowedValues: ['FINANCED', 'LEASED', 'PAID'] },
    };
    expect(() =>
      validateValueAgainstInputContract(choice, 'FINANCED'),
    ).not.toThrow();
    expect(() =>
      validateValueAgainstInputContract(choice, 'SOMETHING_NOT_IN_CATALOG'),
    ).toThrow();
    expect(() =>
      validateValueAgainstInputContract(choice, 'Financed'),
    ).toThrow();
  });

  it('validates date and number canonical transport values', () => {
    expect(() =>
      validateValueAgainstInputContract(
        { key: 'date', dataType: DataType.DATE, validationRules: null },
        '2026-08-19',
      ),
    ).not.toThrow();
    expect(() =>
      validateValueAgainstInputContract(
        { key: 'date', dataType: DataType.DATE, validationRules: null },
        '08/19/2026',
      ),
    ).toThrow();
    expect(() =>
      validateValueAgainstInputContract(
        { key: 'number', dataType: DataType.NUMBER, validationRules: null },
        12,
      ),
    ).not.toThrow();
    expect(() =>
      validateValueAgainstInputContract(
        { key: 'number', dataType: DataType.NUMBER, validationRules: null },
        '12',
      ),
    ).toThrow();
  });

  it('exposes an OBJECT datapoint with supportedCodes as a multi-choice contract', () => {
    const contract = buildInputContract({
      key: 'vehicle.requested_coverages',
      dataType: DataType.OBJECT,
      validationRules: {
        supportedCodes: ['collision', 'comprehensive', 'liability'],
      },
    });
    expect(contract.type).toBe('MULTI_CHOICE');
    expect(contract).toHaveProperty('options');
    const options = (contract as { options: { value: string }[] }).options;
    expect(options.map((option) => option.value)).toEqual([
      'collision',
      'comprehensive',
      'liability',
    ]);
  });

  it('validates multi-choice object selections against supportedCodes', () => {
    const definition = {
      key: 'vehicle.requested_coverages',
      dataType: DataType.OBJECT,
      validationRules: {
        supportedCodes: ['collision', 'comprehensive', 'liability'],
      },
    };
    expect(() =>
      validateValueAgainstInputContract(definition, ['collision', 'liability']),
    ).not.toThrow();
    expect(() =>
      validateValueAgainstInputContract(definition, ['collision', 'gap']),
    ).toThrow();
    expect(() =>
      validateValueAgainstInputContract(definition, 'collision'),
    ).toThrow();
  });

  it('flags an OBJECT datapoint without supportedCodes as business validation', () => {
    const contract = buildInputContract({
      key: 'vehicle.requested_coverages',
      dataType: DataType.OBJECT,
      validationRules: null,
    });
    expect(contract.type).toBe('BUSINESS_VALIDATION_REQUIRED');
  });
});
