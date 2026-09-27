import { DriverLicenseExtractor } from './driver-license.extractor';

describe('DriverLicenseExtractor', () => {
  it('extracts only evidence-backed driver license fields', () => {
    const candidates = new DriverLicenseExtractor().extract({
      textBlocks: [
        { text: 'SURNAME: TREMBLAY', confidence: 0.99, page: 1 },
        { text: 'GIVEN NAME: ALEX', confidence: 0.98, page: 1 },
        { text: 'DOB: 1990-05-17', confidence: 0.97, page: 1 },
        { text: 'CLASS 5', confidence: 0.96, page: 1 },
      ],
    });
    expect(candidates.map((candidate) => candidate.key)).toEqual([
      'driver.last_name',
      'driver.first_name',
      'driver.date_of_birth',
    ]);
    expect(candidates).not.toContainEqual(
      expect.objectContaining({ key: 'driver.license_type' }),
    );
  });
});
