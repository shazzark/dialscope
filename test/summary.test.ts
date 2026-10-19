import { describe, expect, it } from 'vitest';
import { lookupPhoneNumber } from '../src/lookup.js';
import { summarizeBatch } from '../src/summary.js';

describe('batch summary', () => {
  it('defines empty input as zero counts and empty breakdowns', () => {
    expect(summarizeBatch([])).toEqual({
      totalDataRows:0, validCount:0, invalidCount:0, uniqueValidNumberIdentities:0,
      duplicateRowCount:0, duplicateGroupCount:0, countryBreakdown:{}, numberTypeBreakdown:{},
      missingCarrierCount:0, missingAreaCount:0, missingTimeZoneCount:0,
    });
  });

  it('counts only valid rows in metadata and missing-field breakdowns', async () => {
    const result = await lookupPhoneNumber('08031234567');
    const invalid = await lookupPhoneNumber('bad');
    expect(summarizeBatch([
      {result,identity:'+2348031234567;ext='},
      {result,identity:'+2348031234567;ext=42'},
      {result:invalid,identity:null},
    ])).toMatchObject({
      totalDataRows:3, validCount:2, invalidCount:1, uniqueValidNumberIdentities:2,
      duplicateRowCount:0, duplicateGroupCount:0, countryBreakdown:{Nigeria:2},
      numberTypeBreakdown:{mobile:2},
    });
  });
});
