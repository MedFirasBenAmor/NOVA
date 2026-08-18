import { readFileSync } from 'node:fs';
import { Product, RequirementType } from '@prisma/client';
import { validate } from 'class-validator';
import { CollectionStrategyService } from '../collection/collection-strategy.service';
import { SelectProductDto } from '../leads/dto/select-product.dto';
import { RequirementProfileService } from './requirement-profile.service';

const seed = () => readFileSync('prisma/seed.ts', 'utf8');
const productCount = (product: Product) =>
  (
    seed().match(new RegExp('product:\\s*Product\\.' + product + '\\b', 'g')) ??
    []
  ).length;
const requirementCount = (type: RequirementType) =>
  (
    seed().match(
      new RegExp('requirementType:\\s*RequirementType\\.' + type + '\\b', 'g'),
    ) ?? []
  ).length;
const keysFor = (product: Product) => {
  const source = seed();
  const matches = [
    ...source.matchAll(/key: '([^']+)'[\s\S]*?product: Product\.([A-Z_]+)/g),
  ];
  return matches.filter(([, , p]) => p === product).map(([, key]) => key);
};

describe('RequirementProfileService catalog contract', () => {
  it('matches exact R1 catalog counts and requirement breakdown', () => {
    expect(productCount(Product.COMMON)).toBe(20);
    expect(productCount(Product.AUTO)).toBe(48);
    expect(productCount(Product.HOME)).toBe(71);
    expect(
      productCount(Product.COMMON) +
        productCount(Product.AUTO) +
        productCount(Product.HOME),
    ).toBe(139);
    expect(requirementCount(RequirementType.REQUIRED)).toBe(79);
    expect(requirementCount(RequirementType.OPTIONAL)).toBe(34);
    expect(requirementCount(RequirementType.CONDITIONAL)).toBe(26);
  });

  it('keeps canonical keys unique so seed upserts remain idempotent', () => {
    const source = seed();
    const explicit = [
      ...source.matchAll(/^\s*\{ key: '([^']+)'.*product: Product\./gm),
    ].map(([, key]) => key);
    const verbose = [...source.matchAll(/definition\(\n\s*'([^']+)'/g)].map(
      ([, key]) => key,
    );
    const keys = [...verbose, ...explicit];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('composes profiles without duplicating COMMON', () => {
    const service = new RequirementProfileService({} as never);
    expect(service.productsFor(Product.AUTO)).toEqual([
      Product.COMMON,
      Product.AUTO,
    ]);
    expect(service.productsFor(Product.HOME)).toEqual([
      Product.COMMON,
      Product.HOME,
    ]);
    expect(service.productsFor(Product.AUTO_HOME)).toEqual([
      Product.COMMON,
      Product.AUTO,
      Product.HOME,
    ]);
    expect(
      service
        .productsFor(Product.AUTO_HOME)
        .filter((p) => p === Product.COMMON),
    ).toHaveLength(1);
    expect(20 + 48).toBe(68);
    expect(20 + 71).toBe(91);
    expect(20 + 48 + 71).toBe(139);
  });

  it('keeps AUTO and HOME product-only requirements isolated', () => {
    const autoKeys = keysFor(Product.AUTO);
    const homeKeys = keysFor(Product.HOME);
    expect(
      autoKeys.some(
        (key) => key.startsWith('property.') || key.startsWith('co_applicant.'),
      ),
    ).toBe(false);
    expect(
      homeKeys.some(
        (key) =>
          key.startsWith('vehicle.') ||
          key.startsWith('driver.') ||
          key.startsWith('auto.') ||
          key.startsWith('claim.') ||
          key.startsWith('home_claim.'),
      ),
    ).toBe(false);
  });

  it('keeps finite choices catalog-driven and booleans as YES_NO inputs', () => {
    const source = seed();
    expect(source).toContain("allowedValues: ['NEW', 'USED', 'DEMO']");
    expect(source).toContain("allowedValues: ['OWNER', 'TENANT', 'LANDLORD']");
    const strategy = new CollectionStrategyService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { openLoopsForLead: jest.fn().mockResolvedValue([]) } as never,
    );
    expect(strategy['ui']({ dataType: 'BOOLEAN' } as never)).toEqual({
      inputType: 'YES_NO',
    });
    expect(
      strategy['ui']({
        dataType: 'ENUM',
        validationRules: { allowedValues: ['A', 'B'] },
      } as never),
    ).toEqual({ inputType: 'SINGLE_CHOICE', options: ['A', 'B'] });
  });

  it('validates backend product selection enum contract', async () => {
    const valid = new SelectProductDto();
    valid.product = Product.AUTO_HOME;
    await expect(validate(valid)).resolves.toHaveLength(0);

    const invalid = new SelectProductDto();
    invalid.product = Product.COMMON as never;
    expect(await validate(invalid)).not.toHaveLength(0);
  });

  it('returns SELECT_PRODUCT when product is unknown', () => {
    const strategy = new CollectionStrategyService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { openLoopsForLead: jest.fn().mockResolvedValue([]) } as never,
    );
    expect(strategy.productSelectionAction()).toEqual({
      type: 'SELECT_PRODUCT',
      actionId: 'select-product',
      options: [
        { value: 'AUTO', label: 'Auto' },
        { value: 'HOME', label: 'Home' },
        { value: 'AUTO_HOME', label: 'Auto + Home' },
      ],
    });
  });
});
