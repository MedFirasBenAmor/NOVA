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

    expect(total).toBe(139);
    expect(boolean).toBe(36);
    expect(text).toBe(46);
    expect(number).toBe(25);
    expect(date).toBe(10);
    expect(enums).toBe(18);
    expect(finiteEnums).toBe(16);
    expect(object).toBe(4);
    expect(enums - finiteEnums + object).toBe(6);
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
});
